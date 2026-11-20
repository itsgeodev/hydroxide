import { ApiError, checkedFetch, endpoint, headers } from './providers.mjs';
import { providerSecrets } from '../shared/provider-headers.js';
import { inferModelKind } from '../shared/model-capabilities.js';
import { getPricing, startModelCost, tokenCounts } from './model-billing.mjs';

const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const RASTER = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif']);
const ASPECTS = new Set(['1:1', '3:2', '2:3']);

export function validateImageRequest(provider, body) {
  if (typeof body.model !== 'string' || !body.model.trim() || body.model.length > 400)
    throw new ApiError('Choose an image model before generating.');
  const model = body.model.trim();
  const configured = Array.isArray(provider.models)
    ? provider.models.find((item) => item.id === model)
    : undefined;
  if (configured?.enabled === false || provider.enabled === false)
    throw new ApiError('Enable this image model in provider settings first.');
  if (inferModelKind(configured || model) !== 'image')
    throw new ApiError(
      'Choose an image model. Chat and video models cannot generate here. You can correct its type in provider settings.',
    );
  if (typeof body.prompt !== 'string' || !body.prompt.trim() || body.prompt.length > 12000)
    throw new ApiError('Describe your image in 1 to 12,000 characters.');
  const aspectRatio = body.aspectRatio ?? '1:1';
  if (!ASPECTS.has(aspectRatio)) throw new ApiError('Choose square, landscape, or portrait.');
  if (!['auto', 'openai', 'gemini', 'openrouter', 'xai'].includes(provider.imageApi || 'auto'))
    throw new ApiError('Choose a supported image API in provider settings.');
  return { model, prompt: body.prompt.trim(), aspectRatio };
}

async function readLimited(response, maxBytes, signal) {
  const declared = Number(response.headers.get('content-length'));
  if (declared > maxBytes)
    throw new ApiError('The image response is too large to save (20 MB maximum per image).', 502);
  if (!response.body) throw new ApiError('The image provider returned an empty response.', 502);
  const reader = response.body.getReader();
  const chunks = [];
  let length = 0;
  try {
    while (true) {
      if (signal.aborted) throw signal.reason;
      const { value, done } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > maxBytes)
        throw new ApiError(
          'The image response is too large to save (20 MB maximum per image).',
          502,
        );
      chunks.push(Buffer.from(value));
    }
    return Buffer.concat(chunks, length);
  } finally {
    await reader.cancel().catch(() => {});
  }
}

function rasterType(buffer, declared) {
  const mime = typeof declared === 'string' ? declared.toLowerCase().split(';')[0].trim() : '';
  let detected;
  if (buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])))
    detected = 'image/png';
  else if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) detected = 'image/jpeg';
  else if (
    buffer.subarray(0, 4).toString() === 'RIFF' &&
    buffer.subarray(8, 12).toString() === 'WEBP'
  )
    detected = 'image/webp';
  else if (/^GIF8[79]a$/.test(buffer.subarray(0, 6).toString())) detected = 'image/gif';
  else if (
    buffer.subarray(4, 8).toString() === 'ftyp' &&
    /avif|avis/.test(buffer.subarray(8, 32).toString())
  )
    detected = 'image/avif';
  if (
    !detected ||
    (mime && mime !== 'application/octet-stream' && (!RASTER.has(mime) || mime !== detected))
  )
    throw new ApiError(
      'The provider did not return a supported raster image (PNG, JPEG, WebP, GIF, or AVIF).',
      502,
    );
  return detected;
}

async function normalizedImage(item, provider, fetchImpl, signal) {
  let bytes,
    declared = item.mimeType || item.mime_type || item.media_type;
  const encoded = item.b64_json || item.bytesBase64Encoded || item.data;
  if (typeof encoded === 'string' && encoded) {
    const inline = encoded.match(/^data:([^;,]+);base64,([\s\S]+)$/);
    const base64 = inline ? inline[2] : encoded;
    if (inline) declared = inline[1];
    if (
      base64.length > Math.ceil((MAX_IMAGE_BYTES * 4) / 3) + 100 ||
      !/^[A-Za-z0-9+/\s]*={0,2}$/.test(base64)
    )
      throw new ApiError('The image provider returned invalid or oversized image data.', 502);
    bytes = Buffer.from(base64, 'base64');
  } else if (typeof item.url === 'string') {
    let url;
    try {
      url = new URL(item.url, provider.baseUrl);
    } catch {
      throw new ApiError('The provider returned an invalid image URL.', 502);
    }
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password)
      throw new ApiError('The provider returned an unsupported image URL.', 502);
    // Signed CDN URLs must not receive provider credentials, cookies, or custom headers.
    const response = await checkedFetch(
      fetchImpl,
      url.href,
      {
        signal,
        headers: {
          ...(url.origin === new URL(provider.baseUrl).origin ? headers(provider) : {}),
          Accept: 'image/png,image/jpeg,image/webp,image/gif,image/avif',
        },
      },
      providerSecrets(provider),
    );
    declared = response.headers.get('content-type');
    bytes = await readLimited(response, MAX_IMAGE_BYTES, signal);
  } else throw new ApiError('The provider returned no image data.', 502);
  if (!bytes.length || bytes.length > MAX_IMAGE_BYTES)
    throw new ApiError('The provider returned empty or oversized image data.', 502);
  const mimeType = rasterType(bytes, declared);
  return {
    dataUrl: `data:${mimeType};base64,${bytes.toString('base64')}`,
    mimeType,
    ...(typeof item.revised_prompt === 'string'
      ? { revisedPrompt: item.revised_prompt.slice(0, 12000) }
      : {}),
  };
}

export function resolveImageApi(provider, model) {
  if (provider.imageApi && provider.imageApi !== 'auto') return provider.imageApi;
  const host = new URL(provider.baseUrl).hostname;
  if (host === 'generativelanguage.googleapis.com') return 'gemini';
  if (host === 'openrouter.ai') return 'openrouter';
  if (host === 'api.x.ai') return 'xai';
  // Gateway model names do not identify the gateway's wire protocol.
  return 'openai';
}

function geminiEndpoint(provider, model, method) {
  const url = new URL(provider.baseUrl);
  const base = url.pathname
    .replace(/\/+$/, '')
    .replace(/\/openai$/, '')
    .replace(/\/models(?:\/[^/]+(?::[^/]+)?)?$/, '');
  url.pathname = `${base || '/v1beta'}/models/${encodeURIComponent(model.replace(/^models\//, ''))}:${method}`;
  return url.href;
}

export async function generateImage(provider, request, fetchImpl, signal, emit) {
  const api = resolveImageApi(provider, request.model);
  emit({ type: 'status', message: 'Preparing your image…' });
  let url, body, requestHeaders;
  if (api === 'gemini') {
    const imagen = /(?:^|\/)imagen/i.test(request.model);
    url = geminiEndpoint(provider, request.model, imagen ? 'predict' : 'generateContent');
    body = imagen
      ? {
          instances: [{ prompt: request.prompt }],
          parameters: { sampleCount: 1, aspectRatio: request.aspectRatio },
        }
      : {
          contents: [{ role: 'user', parts: [{ text: request.prompt }] }],
          generationConfig: {
            responseModalities: ['TEXT', 'IMAGE'],
            imageConfig: { aspectRatio: request.aspectRatio },
          },
        };
    requestHeaders = headers({ ...provider, type: 'openai', apiKey: '' });
    if (
      provider.apiKey &&
      !Object.keys(requestHeaders).some((name) => name.toLowerCase() === 'x-goog-api-key')
    )
      requestHeaders['x-goog-api-key'] = provider.apiKey;
  } else if (api === 'openrouter' || api === 'xai') {
    url = endpoint(provider, api === 'openrouter' ? 'images' : 'images/generations');
    body = {
      model: request.model,
      prompt: request.prompt,
      n: 1,
      aspect_ratio: request.aspectRatio,
      ...(api === 'xai' ? { response_format: 'b64_json' } : {}),
    };
    requestHeaders = headers({ ...provider, type: 'openai' });
  } else {
    url = endpoint(provider, 'images/generations');
    const dalle3 = /dall[.-]?e[.-]?3/i.test(request.model);
    const dalle2 = /dall[.-]?e[.-]?2/i.test(request.model);
    const size =
      request.aspectRatio === '1:1' || dalle2
        ? '1024x1024'
        : request.aspectRatio === '3:2'
          ? dalle3
            ? '1792x1024'
            : '1536x1024'
          : dalle3
            ? '1024x1792'
            : '1024x1536';
    body = {
      model: request.model,
      prompt: request.prompt,
      n: 1,
      size,
      ...(/(?:gpt|chatgpt)[-_]image/i.test(request.model)
        ? { output_format: 'png' }
        : { response_format: 'b64_json' }),
    };
    requestHeaders = headers({ ...provider, type: 'openai' });
  }
  emit({ type: 'status', message: 'Generating your image…' });
  const response = await checkedFetch(
    fetchImpl,
    url,
    { method: 'POST', headers: requestHeaders, body: JSON.stringify(body), signal },
    providerSecrets(provider),
  );
  let data;
  try {
    data = JSON.parse(
      (
        await readLimited(response, Math.ceil((MAX_IMAGE_BYTES * 4) / 3) + 1024 * 1024, signal)
      ).toString('utf8'),
    );
  } catch (error) {
    if (error instanceof ApiError || signal.aborted) throw error;
    throw new ApiError('The image provider returned invalid JSON.', 502);
  }
  if (data.error)
    throw new ApiError(data.error.message || 'The image provider returned an error.', 502);
  const finishCost = startModelCost(getPricing(provider, request.model), emit);
  finishCost?.(tokenCounts(api === 'gemini' ? data.usageMetadata : data.usage, api));
  let images;
  if (api === 'gemini') {
    images =
      data.predictions ||
      data.candidates
        ?.flatMap((candidate) => candidate.content?.parts || [])
        .filter((part) => part.inlineData || part.inline_data)
        .map((part) => part.inlineData || part.inline_data);
    if (!images?.length)
      throw new ApiError(
        data.promptFeedback?.blockReason
          ? `The provider did not generate an image (${data.promptFeedback.blockReason}).`
          : 'The provider returned no image. Choose a native Gemini image-generation model.',
        502,
      );
  } else images = data.data;
  if (!Array.isArray(images) || !images.length)
    throw new ApiError(
      'The provider returned no image. Check that this model supports image generation.',
      502,
    );
  // One click requests one image. Ignore unexpected additional candidates.
  emit({ type: 'status', message: 'Saving the generated image…' });
  const image = await normalizedImage(images[0], provider, fetchImpl, signal);
  emit({ type: 'image', image });
}
