import { normalizeWebSettings, webToolDefinitions, WebSearchError } from '../shared/web-search.js';
import { fetchWithoutRedirects } from './upstream-fetch.mjs';

const MAX_CONTEXT = 60000;
const SEARCH_CHARACTERS = 4000;

function safeText(value, apiKey) {
  let text = typeof value === 'string' ? value : '';
  if (apiKey) text = text.split(apiKey).join('[redacted]');
  return text.replace(/Bearer\s+[^\s"<>]+/gi, 'Bearer [redacted]');
}

function validUrl(value) {
  if (typeof value !== 'string' || value.length > 4000) return null;
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

function validateArguments(provider, name, args) {
  const definition = webToolDefinitions(provider).find((tool) => tool.name === name);
  if (!definition) throw new WebSearchError(`Unknown web tool: ${String(name).slice(0, 100)}.`);
  if (!args || typeof args !== 'object' || Array.isArray(args))
    throw new WebSearchError('Web tool arguments must be an object.');
  for (const field of definition.parameters.required) {
    if (args[field] == null) throw new WebSearchError(`Missing web tool argument: ${field}.`);
  }
  for (const [field, value] of Object.entries(args)) {
    if (value == null) continue;
    const rule = definition.parameters.properties[field];
    if (!rule) throw new WebSearchError(`Unsupported web tool argument: ${field}.`);
    if (rule.type === 'string') {
      if (
        typeof value !== 'string' ||
        !value.trim() ||
        (rule.maxLength && value.length > rule.maxLength)
      )
        throw new WebSearchError(
          `${field} must be nonempty text${rule.maxLength ? ` under ${rule.maxLength + 1} characters` : ''}.`,
        );
    } else if (rule.type === 'integer') {
      if (!Number.isInteger(value) || value < rule.minimum || value > rule.maximum)
        throw new WebSearchError(
          `${field} must be an integer between ${rule.minimum} and ${rule.maximum}.`,
        );
    } else if (rule.type === 'boolean') {
      if (typeof value !== 'boolean') throw new WebSearchError(`${field} must be a boolean.`);
    } else if (rule.type === 'array') {
      if (
        !Array.isArray(value) ||
        value.length < (rule.minItems || 0) ||
        value.length > rule.maxItems ||
        value.some(
          (entry) =>
            typeof entry !== 'string' || !entry.trim() || entry.length > rule.items.maxLength,
        )
      )
        throw new WebSearchError(
          `${field} must be a list of at most ${rule.maxItems} nonempty strings.`,
        );
    }
    if (rule.enum && !rule.enum.includes(value)) throw new WebSearchError(`Unsupported ${field}.`);
  }
  const clean = Object.fromEntries(Object.entries(args).filter(([, value]) => value != null));
  for (const key of ['start_date', 'end_date']) {
    if (
      clean[key] &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(clean[key]) ||
        !Number.isFinite(Date.parse(clean[key])) ||
        new Date(clean[key]).toISOString().slice(0, 10) !== clean[key])
    )
      throw new WebSearchError(`${key} must be a valid YYYY-MM-DD date.`);
  }
  if (clean.start_date && clean.end_date && clean.start_date > clean.end_date)
    throw new WebSearchError('start_date must not be later than end_date.');
  for (const field of ['include_domains', 'exclude_domains']) {
    if (
      clean[field]?.some(
        (domain) =>
          /\s|[?#@]/.test(domain) ||
          !/^([a-z][a-z0-9+.-]*:\/\/)?(?:\*\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)+(?:\/[^\s]*)?$/i.test(
            domain,
          ),
      )
    )
      throw new WebSearchError(`${field} must contain valid domains or domain paths.`);
  }
  if (name === 'read_web_page') {
    clean.urls = [
      ...new Set(
        clean.urls.map((url) => {
          const normalized = validUrl(url);
          if (!normalized)
            throw new WebSearchError(
              'Page URLs must use HTTP or HTTPS without embedded credentials.',
            );
          return normalized;
        }),
      ),
    ];
  }
  if (provider === 'tavily') {
    if (clean.include_domains_mode && !clean.include_domains?.length)
      throw new WebSearchError('include_domains_mode requires include_domains.');
    if (clean.filter_by_language && !clean.language)
      throw new WebSearchError('filter_by_language requires language.');
    if (clean.search_depth === 'ultra-fast' && clean.chunks_per_source != null)
      throw new WebSearchError('ultra-fast does not support chunks_per_source.');
  } else {
    if (clean.search_type === 'lite' && clean.max_age_hours != null)
      throw new WebSearchError(
        'Exa lite is cache-only and does not support max_age_hours. Choose auto.',
      );
    if (['company', 'people'].includes(clean.category) && (clean.start_date || clean.end_date))
      throw new WebSearchError(
        'Exa company and people categories do not support publication date filters.',
      );
    if (clean.category === 'people' && clean.exclude_domains?.length)
      throw new WebSearchError('Exa people category does not support exclude_domains.');
  }
  return clean;
}

async function serviceRequest(web, path, body, fetchImpl, signal) {
  const label = web.provider === 'exa' ? 'Exa' : 'Tavily';
  let response;
  try {
    response = await fetchWithoutRedirects(
      fetchImpl,
      `https://api.${web.provider === 'exa' ? 'exa.ai' : 'tavily.com'}/${path}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${web.apiKey}` },
        body: JSON.stringify(body),
        signal,
      },
    );
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new WebSearchError(
      safeText(`Could not reach ${label}. ${error.message}`, web.apiKey).slice(0, 1200),
      502,
    );
  }
  if (!response.ok) {
    let detail = '';
    try {
      const text = (await response.text()).slice(0, 4000);
      try {
        const data = JSON.parse(text);
        const value = data.error?.message || data.detail?.error || data.message || data.error;
        if (typeof value === 'string') detail = value;
      } catch {
        if (!text.includes('<')) detail = text;
      }
    } catch {
      /* The status still identifies an unreadable upstream failure. */
    }
    const error = new WebSearchError(
      safeText(
        `${label} returned ${response.status}${detail ? `: ${detail}` : '.'}`,
        web.apiKey,
      ).slice(0, 1200),
      502,
    );
    error.upstreamStatus = response.status;
    throw error;
  }
  let data;
  try {
    data = await response.json();
  } catch {
    throw new WebSearchError(`${label} returned invalid JSON.`, 502);
  }
  if (!data || !Array.isArray(data.results))
    throw new WebSearchError(`${label} returned an invalid result list.`, 502);
  return data;
}

function tavilySearch(args) {
  const body = {
    query: args.query.trim(),
    max_results: args.max_results ?? 5,
    include_answer: false,
    include_raw_content: false,
    include_images: false,
    include_published_date: true,
  };
  if (!args.auto_parameters || args.search_depth) body.search_depth = args.search_depth || 'basic';
  if (body.search_depth !== 'ultra-fast') body.chunks_per_source = args.chunks_per_source ?? 3;
  for (const name of [
    'topic',
    'time_range',
    'start_date',
    'end_date',
    'max_age_hours',
    'filter_by_published_date',
    'include_domains',
    'exclude_domains',
    'include_domains_mode',
    'language',
    'filter_by_language',
    'exact_match',
    'auto_parameters',
  ])
    if (args[name] != null) body[name] = args[name];
  return body;
}

function exaSearch(args) {
  const body = {
    query: args.query.trim(),
    type: args.search_type || 'auto',
    numResults: args.max_results ?? 5,
    contents: { highlights: { maxCharacters: SEARCH_CHARACTERS } },
  };
  if (args.include_domains) body.includeDomains = args.include_domains;
  if (args.exclude_domains) body.excludeDomains = args.exclude_domains;
  if (args.start_date) body.startPublishedDate = `${args.start_date}T00:00:00.000Z`;
  if (args.end_date) body.endPublishedDate = `${args.end_date}T23:59:59.999Z`;
  if (args.max_age_hours != null) body.contents.maxAgeHours = args.max_age_hours;
  if (args.category) body.category = args.category;
  if (args.objective) body.objective = args.objective;
  return body;
}

function normalizeResults(web, data, limit, characterLimit) {
  let budget = MAX_CONTEXT;
  const seen = new Set();
  const results = [];
  for (const item of data.results.slice(0, 100)) {
    if (!item || typeof item !== 'object') continue;
    const url = validUrl(item.url || item.id);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    const highlights = Array.isArray(item.highlights)
      ? item.highlights.filter((value) => typeof value === 'string').join('\n\n')
      : '';
    const rawContent = highlights || item.content || item.raw_content || item.text || '';
    const content = safeText(rawContent, web.apiKey).slice(0, Math.min(characterLimit, budget));
    budget -= content.length;
    const publishedDate = item.published_date || item.publishedDate;
    results.push({
      title: safeText(item.title, web.apiKey).slice(0, 500) || new URL(url).hostname,
      url: safeText(url, web.apiKey),
      content,
      ...(typeof publishedDate === 'string'
        ? { publishedDate: safeText(publishedDate, web.apiKey).slice(0, 100) }
        : {}),
      ...(Number.isFinite(item.score) ? { score: item.score } : {}),
      ...(typeof rawContent === 'string' && rawContent.length > content.length
        ? { truncated: true }
        : {}),
    });
    if (results.length >= limit || budget <= 0) break;
  }
  return results;
}

export async function executeWebTool(
  input,
  name,
  arguments_,
  fetchImpl = globalThis.fetch,
  signal,
) {
  const web = normalizeWebSettings(input);
  if (!web.enabled) throw new WebSearchError('Web search is disabled for this message.');
  signal?.throwIfAborted();
  const args = validateArguments(web.provider, name, arguments_);
  const reading = name === 'read_web_page';
  const characterLimit = reading ? (args.max_characters ?? 12000) : SEARCH_CHARACTERS;
  let path, body;
  if (!reading) {
    path = 'search';
    body = web.provider === 'exa' ? exaSearch(args) : tavilySearch(args);
  } else if (web.provider === 'exa') {
    path = 'contents';
    body = {
      ids: args.urls,
      ...(args.query
        ? { highlights: { query: args.query, maxCharacters: characterLimit } }
        : { text: { maxCharacters: characterLimit } }),
    };
  } else {
    path = 'extract';
    body = {
      urls: args.urls,
      format: 'markdown',
      extract_depth: 'basic',
      include_published_date: true,
      ...(args.query ? { query: args.query, chunks_per_source: 3 } : {}),
    };
  }
  const data = await serviceRequest(web, path, body, fetchImpl, signal);
  const results = normalizeResults(
    web,
    data,
    reading ? args.urls.length : (args.max_results ?? 5),
    characterLimit,
  );
  const failures =
    web.provider === 'exa'
      ? (Array.isArray(data.statuses)
          ? data.statuses.filter((item) => item?.status !== 'success')
          : []
        ).map((item) => ({ url: item.id, error: item.error?.message || item.error || item.status }))
      : Array.isArray(data.failed_results)
        ? data.failed_results
        : [];
  const failedResults = failures.slice(0, 5).map((item) => ({
    url: safeText(item.url, web.apiKey).slice(0, 4000),
    error: safeText(
      typeof item.error === 'string' ? item.error : 'Could not read this page.',
      web.apiKey,
    ).slice(0, 500),
  }));
  return {
    provider: web.provider,
    ...(args.query ? { query: safeText(args.query.trim(), web.apiKey) } : {}),
    results,
    ...(failedResults.length ? { failedResults } : {}),
  };
}
