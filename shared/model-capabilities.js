export const MODEL_KINDS = [
  { id: 'auto', name: 'Automatic' },
  { id: 'chat', name: 'Chat' },
  { id: 'image', name: 'Image' },
  { id: 'video', name: 'Video' },
  { id: 'other', name: 'Other' },
];

const KINDS = new Set(['chat', 'image', 'video', 'other']);
const tokens = (value) =>
  (Array.isArray(value) ? value : typeof value === 'string' ? value.split(/[,+\s]/) : [])
    .filter((item) => typeof item === 'string')
    .map((item) => item.toLowerCase().replace(/-/g, '_'));

function outputKind(model) {
  const output = [
    ...tokens(model.output_modalities),
    ...tokens(model.outputModalities),
    ...tokens(model.architecture?.output_modalities),
    ...tokens(model.modalities?.output),
    ...tokens(model.capabilities?.output_modalities),
    ...tokens(model.capabilities?.outputModalities),
  ];
  for (const value of [model.modality, model.architecture?.modality]) {
    if (typeof value === 'string' && value.includes('->'))
      output.push(...tokens(value.split('->').at(-1)));
  }
  // A mixed, unqualified modalities list often describes inputs on vision chat models.
  const general = tokens(model.modalities);
  if (general.length === 1 && ['image', 'video', 'audio', 'embedding'].includes(general[0]))
    output.push(...general);
  if (output.some((item) => item === 'video' || item === 'video_generation')) return 'video';
  if (output.some((item) => item === 'image' || item === 'image_generation')) return 'image';
  if (output.length && output.every((item) => ['audio', 'embedding', 'embeddings'].includes(item)))
    return 'other';
  return null;
}

function taskKind(model) {
  if (['image', 'video'].includes(model.type)) return model.type;
  const capabilities = model.capabilities;
  const tasks = [model.task, model.type, model.pipeline_tag, ...tokens(capabilities)]
    .filter((value) => typeof value === 'string')
    .map((value) => value.toLowerCase().replace(/-/g, '_'));
  if (capabilities && typeof capabilities === 'object' && !Array.isArray(capabilities)) {
    for (const [name, enabled] of Object.entries(capabilities))
      if (enabled === true) tasks.push(name.toLowerCase().replace(/-/g, '_'));
  }
  if (
    tasks.some((task) =>
      /^(video_generation|text_to_video|image_to_video|generate_video)$/.test(task),
    )
  )
    return 'video';
  if (
    tasks.some((task) =>
      /^(image_generation|text_to_image|generate_image|image_editing)$/.test(task),
    )
  )
    return 'image';
  if (
    tasks.some((task) =>
      /^(embedding|embeddings|rerank|reranking|speech_to_text|text_to_speech|audio_generation|moderation)$/.test(
        task,
      ),
    )
  )
    return 'other';
  return null;
}

export function inferModelKind(modelOrId) {
  const model = modelOrId && typeof modelOrId === 'object' ? modelOrId : {};
  if (KINDS.has(model.kind)) return model.kind;
  if (KINDS.has(model.detectedKind)) return model.detectedKind;
  const output = outputKind(model);
  if (output) return output;
  const task = taskKind(model);
  if (task) return task;

  const id = String(
    typeof modelOrId === 'string' ? modelOrId : model.id || model.name || '',
  ).toLowerCase();
  if (
    /(?:^|[/:._-])(?:sora|veo|kling|runway|hailuo|cogvideo|pixverse|pika|seedance|vidu|t2v|i2v|v2v)(?:[/:._-]|\d|$)|grok[-_](?:imagine[-_])?video|hunyuan[-_]?video|ltx[-_]?(?:video|\d)|(?:^|[/:._-])wan[-_.]?(?:v?\d)|minimax[-_].*video|(?:^|[/:._-])video[-_.]?\d|(?:text|image)[-_]to[-_]video|video[-_]generation/.test(
      id,
    )
  )
    return 'video';
  if (
    /(?:^|[/:._-])(?:(?:chat)?gpt[-_]image|dall[-_]?e|imagen|flux|sdxl|stable[-_](?:diffusion|image)|seedream|qwen[-_]image|glm[-_]image|cogview|ideogram|recraft|midjourney|kolors|hidream|t2i|i2i)(?:[/:._-]|\d|$)|grok[-_](?:imagine[-_])?image|hunyuan[-_]?image|(?:^|[/:._-])image[-_.]?\d|gemini.*[-_]image(?:[/:._-]|$)|nano[-_]?banana|(?:text[-_]to[-_]image|image[-_]generation)/.test(
      id,
    )
  )
    return 'image';
  if (
    /(?:embed(?:ding)?s?|rerank(?:er|ing)?|whisper|transcri(?:be|ption)|(?:^|[-_/])tts(?:[-_/]|$)|audio|speech|moderation|realtime)/.test(
      id,
    )
  )
    return 'other';
  return 'chat';
}

export const getModelKind = inferModelKind;

export function enabledModels(providers, kind = 'chat') {
  return (Array.isArray(providers) ? providers : [])
    .filter((provider) => provider.enabled !== false)
    .flatMap((provider) =>
      (provider.models || [])
        .filter((model) => model.enabled !== false && (!kind || inferModelKind(model) === kind))
        .map((model) => ({ ...model, provider })),
    );
}
