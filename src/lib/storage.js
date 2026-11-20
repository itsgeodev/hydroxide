import { validateColorSettings, DEFAULT_COLORS } from './theme.js';
import { normalizeCustomHeaders } from '../../shared/provider-headers.js';
import { normalizeImageRequest } from '../../shared/image-requests.js';
import { normalizeChatCosts, normalizePricing } from '../../shared/model-pricing.js';
import { WEB_PROVIDERS } from '../../shared/web-search.js';

export const STORAGE_KEY = 'hydroxide.workspace.v1';
export const BACKUP_CATEGORIES = Object.freeze({
  all: { label: 'Everything' },
  chats: { label: 'Chats' },
  providers: { label: 'Providers' },
  preferences: { label: 'Preferences' },
});
const SCOPED_BACKUP_CATEGORIES = new Set(['chats', 'providers', 'preferences']);
const DEFAULT_SETTINGS = {
  providers: [],
  webSearch: { provider: 'tavily', enabled: false },
  tavily: { apiKey: '' },
  exa: { apiKey: '' },
  systemPrompt: '',
  temperature: 0.7,
  autoRename: true,
  effects: true,
  imageRequests: true,
  colors: DEFAULT_COLORS,
};
export const emptyWorkspace = () => ({
  chats: [],
  settings: structuredClone(DEFAULT_SETTINGS),
  selectedModel: null,
  currentChatId: null,
  draft: '',
  webEnabled: null,
});
const isObject = (value) => value && typeof value === 'object' && !Array.isArray(value);
const string = (value, fallback = '') => (typeof value === 'string' ? value : fallback);
const validId = (value) => typeof value === 'string' && value.trim().length > 0;
const safeSource = (source) => {
  if (!isObject(source) || typeof source.url !== 'string') return null;
  try {
    const url = new URL(source.url);
    return ['https:', 'http:'].includes(url.protocol)
      ? { title: string(source.title, url.hostname) || url.hostname, url: url.href }
      : null;
  } catch {
    return null;
  }
};

export function validateWorkspace(data, { recover = true } = {}) {
  if (!isObject(data) || !Array.isArray(data.chats) || !isObject(data.settings))
    throw new Error('This is not a Hydroxide backup. Choose a complete JSON export.');
  if (data.version !== undefined && data.version !== 1)
    throw new Error('This backup version is not supported.');
  if (!Array.isArray(data.settings.providers))
    throw new Error('The backup is missing its provider settings.');
  const colors = validateColorSettings(data.settings.colors);
  const searchSettings = data.settings.webSearch;
  if (
    searchSettings !== undefined &&
    (!isObject(searchSettings) ||
      (searchSettings.provider !== undefined &&
        !['tavily', 'exa'].includes(searchSettings.provider)) ||
      (searchSettings.enabled !== undefined && typeof searchSettings.enabled !== 'boolean'))
  )
    throw new Error('The web search settings in this backup are invalid.');
  for (const { id, name } of WEB_PROVIDERS) {
    const connection = data.settings[id];
    if (
      connection !== undefined &&
      (!isObject(connection) ||
        (connection.apiKey !== undefined && typeof connection.apiKey !== 'string'))
    )
      throw new Error(`The ${name} settings in this backup are invalid.`);
  }
  const providerIds = new Set();
  const providers = data.settings.providers.map((p) => {
    if (
      !isObject(p) ||
      !validId(p.id) ||
      providerIds.has(p.id) ||
      !['openai', 'responses', 'anthropic'].includes(p.type) ||
      !Array.isArray(p.models)
    )
      throw new Error('A provider in this backup is invalid.');
    providerIds.add(p.id);
    const modelIds = new Set();
    const models = p.models.map((m) => {
      if (!isObject(m) || typeof m.id !== 'string' || !m.id.trim() || modelIds.has(m.id))
        throw new Error('A model in this backup is invalid or duplicated.');
      modelIds.add(m.id);
      return {
        id: m.id,
        name: string(m.name, m.id).trim() || m.id,
        icon: string(m.icon, p.icon || 'hydroxide'),
        enabled: m.enabled !== false,
        kind: ['auto', 'chat', 'image', 'video', 'other'].includes(m.kind) ? m.kind : 'auto',
        detectedKind: ['chat', 'image', 'video', 'other'].includes(m.detectedKind)
          ? m.detectedKind
          : undefined,
        pricing: normalizePricing(m.pricing),
      };
    });
    return {
      id: String(p.id),
      name: string(p.name, 'Provider'),
      type: p.type,
      baseUrl: string(p.baseUrl),
      apiKey: string(p.apiKey),
      customHeaders: normalizeCustomHeaders(p.customHeaders),
      imageApi: ['auto', 'openai', 'gemini', 'openrouter', 'xai'].includes(p.imageApi)
        ? p.imageApi
        : 'auto',
      icon: string(p.icon, 'hydroxide'),
      enabled: p.enabled !== false,
      models,
    };
  });
  const chatIds = new Set();
  const chats = data.chats.map((chat) => {
    if (
      !isObject(chat) ||
      !validId(chat.id) ||
      chatIds.has(chat.id) ||
      !Array.isArray(chat.messages)
    )
      throw new Error('A conversation in this backup is invalid or duplicated.');
    chatIds.add(chat.id);
    const messageIds = new Set();
    const messages = chat.messages.map((m) => {
      if (
        !isObject(m) ||
        !['user', 'assistant', 'system'].includes(m.role) ||
        typeof m.content !== 'string'
      )
        throw new Error('A message in this backup is invalid.');
      const id = m.id == null ? crypto.randomUUID() : m.id;
      if (!validId(id) || messageIds.has(id))
        throw new Error('Message IDs must be unique, nonempty strings.');
      messageIds.add(id);
      return {
        id,
        role: m.role,
        content: m.content,
        model: string(m.model),
        icon: string(m.icon),
        reasoning: string(m.reasoning),
        error: string(m.error),
        sources: Array.isArray(m.sources) ? m.sources.map(safeSource).filter(Boolean) : [],
        interrupted: Boolean(m.interrupted || (recover && m.pending)),
        ...(!recover && m.pending ? { pending: true } : {}),
        ...(m.imageRequest
          ? { imageRequest: normalizeImageRequest(m.imageRequest, { recover }) }
          : {}),
      };
    });
    return {
      id: chat.id,
      title: string(chat.title, 'Untitled conversation'),
      createdAt: Number(chat.createdAt) || Date.now(),
      updatedAt: Number(chat.updatedAt) || Date.now(),
      manualTitle: Boolean(chat.manualTitle),
      costs: normalizeChatCosts(chat.costs),
      messages,
    };
  });
  return {
    chats,
    settings: {
      ...structuredClone(DEFAULT_SETTINGS),
      providers,
      webSearch: {
        provider: searchSettings?.provider || 'tavily',
        enabled: searchSettings?.enabled ?? Boolean(data.settings.tavily?.enabled),
      },
      tavily: { apiKey: string(data.settings.tavily?.apiKey) },
      exa: { apiKey: string(data.settings.exa?.apiKey) },
      systemPrompt: string(data.settings.systemPrompt),
      temperature: Number.isFinite(Number(data.settings.temperature))
        ? Math.min(2, Math.max(0, Number(data.settings.temperature)))
        : DEFAULT_SETTINGS.temperature,
      autoRename: data.settings.autoRename !== false,
      effects: data.settings.effects !== false,
      imageRequests: data.settings.imageRequests !== false,
      colors,
    },
    selectedModel:
      isObject(data.selectedModel) &&
      providers.some(
        (p) =>
          p.id === data.selectedModel.providerId &&
          p.models.some((m) => m.id === data.selectedModel.modelId),
      )
        ? { providerId: data.selectedModel.providerId, modelId: data.selectedModel.modelId }
        : null,
    currentChatId: chats.some((c) => c.id === data.currentChatId) ? data.currentChatId : null,
    draft: string(data.draft).slice(0, 500000),
    webEnabled: typeof data.webEnabled === 'boolean' ? data.webEnabled : null,
  };
}

export function loadWorkspace(storage = localStorage) {
  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) return emptyWorkspace();
  return validateWorkspace(JSON.parse(raw));
}
export function saveWorkspace(workspace, storage = localStorage) {
  storage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, ...workspace }));
}

function withoutCredentials(workspace) {
  const { settings } = workspace;
  return {
    ...workspace,
    settings: {
      ...settings,
      tavily: { apiKey: '' },
      exa: { apiKey: '' },
      providers: settings.providers.map(({ hasApiKey, clearApiKey, ...provider }) => ({
        ...provider,
        apiKey: '',
        customHeaders: (provider.customHeaders || []).map(({ hasValue, clearValue, ...header }) => ({
          ...header,
          value: '',
        })),
      })),
    },
  };
}

export function backupHasPlaintextCredentials(backup) {
  const data = backup?.category && backup.category !== 'all' ? backup.data : backup?.settings;
  if (!data) return false;
  return WEB_PROVIDERS.some(({ id }) => Boolean(data[id]?.apiKey)) ||
    (Array.isArray(data.providers) && data.providers.some((provider) => provider?.apiKey ||
      (Array.isArray(provider?.customHeaders) && provider.customHeaders.some((header) => header?.value))));
}
export function serializeBackup(workspace, media = [], { includeCredentials = false } = {}) {
  return JSON.stringify(
    {
      app: 'Hydroxide Chat',
      version: 1,
      exportedAt: new Date().toISOString(),
      ...(includeCredentials ? workspace : withoutCredentials(workspace)),
      media,
    },
    null,
    2,
  );
}

export function serializeCategoryBackup(workspace, category, media = [], { includeCredentials = false } = {}) {
  if (!SCOPED_BACKUP_CATEGORIES.has(category))
    throw new Error('Choose Chats, Providers, or Preferences for a scoped backup.');
  const { settings } = includeCredentials && category === 'providers' ? workspace : withoutCredentials(workspace);
  const data =
    category === 'chats'
      ? { chats: structuredClone(workspace.chats), currentChatId: workspace.currentChatId, draft: workspace.draft, webEnabled: workspace.webEnabled }
      : category === 'providers'
        ? {
            providers: structuredClone(settings.providers),
            selectedModel: structuredClone(workspace.selectedModel),
            ...Object.fromEntries(
              WEB_PROVIDERS.map(({ id }) => [id, { apiKey: string(settings[id]?.apiKey) }]),
            ),
          }
        : Object.fromEntries(
            ['webSearch', 'systemPrompt', 'temperature', 'autoRename', 'effects', 'imageRequests', 'colors'].map(
              (key) => [key, structuredClone(settings[key])],
            ),
          );
  const backup = {
    app: 'Hydroxide Chat',
    version: 1,
    category,
    exportedAt: new Date().toISOString(),
    data,
  };
  if (category === 'chats') backup.media = media;
  return JSON.stringify(backup, null, 2);
}

function workspaceForCategory(workspace, category, data) {
  const base = {
    version: 1,
    chats: workspace.chats,
    settings: workspace.settings,
    selectedModel: workspace.selectedModel,
    currentChatId: workspace.currentChatId,
    draft: workspace.draft,
    webEnabled: workspace.webEnabled,
  };
  if (category === 'chats') {
    if (!Array.isArray(data.chats)) throw new Error('The chats backup is missing its conversations.');
    return { ...base, chats: data.chats, currentChatId: data.currentChatId ?? null, draft: data.draft, webEnabled: data.webEnabled };
  }
  if (category === 'providers') {
    if (!Array.isArray(data.providers)) throw new Error('The providers backup is missing its providers.');
    const settings = { ...base.settings, providers: data.providers };
    for (const { id } of WEB_PROVIDERS) {
      if (Object.hasOwn(data, id)) settings[id] = data[id];
    }
    return {
      ...base,
      settings,
      selectedModel: data.selectedModel ?? null,
    };
  }
  if (category === 'preferences') {
    const allowed = new Set([
      'webSearch',
      'tavily',
      'exa',
      'systemPrompt',
      'temperature',
      'autoRename',
      'effects',
      'imageRequests',
      'colors',
    ]);
    if (Object.keys(data).some((key) => !allowed.has(key)))
      throw new Error('The preferences backup contains unsupported data.');
    return { ...base, settings: { ...base.settings, ...data } };
  }
  throw new Error('This backup category is not supported.');
}

export function validateCategoryBackup(data, workspace) {
  if (!isObject(data) || !SCOPED_BACKUP_CATEGORIES.has(data.category))
    throw new Error('This backup category is not supported.');
  if (data.version !== 1 || !isObject(data.data))
    throw new Error('This scoped backup is invalid or incomplete.');
  const normalized = validateWorkspace(workspaceForCategory(workspace, data.category, data.data));
  return { category: data.category, workspace: normalized };
}

export function applyBackupCategory(workspace, data) {
  return validateCategoryBackup(data, workspace).workspace;
}

export function localTitle(text) {
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length > 44 ? `${clean.slice(0, 43).trimEnd()}…` : clean || 'New conversation';
}
