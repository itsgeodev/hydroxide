import { useEffect, useId, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowSquareOut,
  ArrowUp,
  CaretDown,
  Check,
  CheckCircle,
  Database,
  Eye,
  EyeSlash,
  Globe,
  Info,
  MagnifyingGlass,
  PaintBrush,
  Plus,
  SlidersHorizontal,
  SpinnerGap,
  SquaresFour,
  Trash,
  X,
} from '@phosphor-icons/react';
import { PRESETS, ICONS, ModelIcon, createProvider, inferIcon } from '../lib/providers';
import { API_FORMATS } from '../lib/provider-formats.js';
import { MODEL_KINDS, inferModelKind } from '../../shared/model-capabilities.js';
import { applyModelAutofill } from '../../shared/model-pricing.js';
import { accounts } from '#workspace-edition';
import ModelPricing from './ModelPricing.jsx';
import PricingAutofill from './PricingAutofill.jsx';
import CustomProviderForm from './CustomProviderForm.jsx';
import ProviderHeaders from './ProviderHeaders.jsx';
import {
  COLOR_GROUPS,
  COLOR_PRESET_LIST,
  COLOR_TOKENS,
  DEFAULT_COLORS,
  colorToken,
  createColorSettingsFromPreset,
  isHexColor,
  normalizeColorSettings,
  toPickerHex,
  updatePaletteAccent,
} from '../lib/theme.js';
import '../settings.css';

const tabs = [
  { id: 'providers', label: 'Providers', icon: SquaresFour },
  { id: 'web', label: 'Web search', icon: Globe },
  { id: 'preferences', label: 'Preferences', icon: SlidersHorizontal },
  { id: 'colors', label: 'Colors', icon: PaintBrush },
  { id: 'data', label: 'Data & backups', icon: Database },
];
const SEARCH_PROVIDERS = {
  tavily: { name: 'Tavily', keyUrl: 'https://app.tavily.com', placeholder: 'tvly-…' },
  exa: {
    name: 'Exa',
    keyUrl: 'https://dashboard.exa.ai/api-keys',
    placeholder: 'Enter your Exa API key',
  },
};
const StoredSecret = accounts?.StoredSecret;

function Switch({ checked, onChange, label }) {
  return (
    <button
      type="button"
      className="settings-switch"
      role="switch"
      aria-checked={!!checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
    >
      <span />
    </button>
  );
}

function SecretInput({ value, onChange, placeholder, label, id }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="settings-secret">
      <input
        id={id}
        type={visible ? 'text' : 'password'}
        autoComplete="off"
        spellCheck="false"
        value={value || ''}
        onChange={onChange}
        placeholder={placeholder}
        aria-label={label}
      />
      <button
        type="button"
        aria-label={`${visible ? 'Hide' : 'Show'} ${label.toLowerCase()}`}
        title={`${visible ? 'Hide' : 'Show'} key`}
        onClick={() => setVisible(!visible)}
      >
        {visible ? <EyeSlash size={18} /> : <Eye size={18} />}
      </button>
    </div>
  );
}

function ColorHexInput({ value, label, onChange }) {
  const [draft, setDraft] = useState(null);
  return (
    <input
      type="text"
      value={draft ?? value}
      maxLength={9}
      spellCheck={false}
      aria-label={`${label} hex value`}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => {
        if (draft !== null && isHexColor(draft)) onChange(draft.trim().toLowerCase());
        setDraft(null);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur();
      }}
    />
  );
}

export default function Settings({
  settings,
  account: username,
  cloudStatus,
  live,
  onSignOut,
  connectionFetch = fetch,
  onSaveCredential,
  onAddCloudProvider,
  onChange,
  onClose,
  onExport,
  onImport,
  onDeleteAllChats,
  canDeleteAllChats,
  initialTab = 'providers',
  notification,
  onDismissNotification,
}) {
  const account = accounts ? username : null;
  const [tab, setTab] = useState(
    tabs.some((item) => item.id === initialTab) ? initialTab : 'providers',
  );
  const [selectedId, setSelectedId] = useState(settings.providers[0]?.id || '');
  const [adding, setAdding] = useState(!settings.providers.length);
  const [customizing, setCustomizing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState('');
  const [importSuccess, setImportSuccess] = useState('');
  const [filter, setFilter] = useState('');
  const [modelKindFilter, setModelKindFilter] = useState('all');
  const [pricingEditor, setPricingEditor] = useState(null);
  const [autofillOpen, setAutofillOpen] = useState(false);
  const [manualId, setManualId] = useState('');
  const [manualKind, setManualKind] = useState('auto');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [backupCategory, setBackupCategory] = useState('all');
  const [migrationExport, setMigrationExport] = useState(false);
  const [editingPalette, setEditingPalette] = useState(null);
  const [prefersDark, setPrefersDark] = useState(() =>
    window.matchMedia('(prefers-color-scheme: dark)').matches,
  );
  const dialog = useRef(null);
  const abort = useRef(null);
  const latest = useRef(settings);
  const formId = useId();
  latest.current = settings;
  const searchProvider = settings.webSearch.provider;
  const searchConnection = SEARCH_PROVIDERS[searchProvider];
  const provider =
    settings.providers.find((item) => item.id === selectedId) || settings.providers[0];
  const models = provider?.models || [];
  const modelCounts = models.reduce(
    (counts, model) => {
      counts[inferModelKind(model)]++;
      return counts;
    },
    { all: models.length, chat: 0, image: 0, video: 0, other: 0 },
  );
  const filteredModels = models.filter(
    (model) =>
      `${model.id} ${model.name}`.toLowerCase().includes(filter.toLowerCase()) &&
      (modelKindFilter === 'all' || inferModelKind(model) === modelKindFilter),
  );
  const selectedModels = models.filter((model) => model.enabled !== false).length;
  const colorSettings = normalizeColorSettings(settings.colors);
  const colorMode = colorSettings.mode;
  const activePalette = colorMode === 'system' ? (prefersDark ? 'dark' : 'light') : colorMode;
  const colorPaletteName = editingPalette ?? activePalette;
  const colorPalette = colorSettings[colorPaletteName];

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const updatePreference = () => setPrefersDark(media.matches);
    media.addEventListener('change', updatePreference);
    return () => media.removeEventListener('change', updatePreference);
  }, []);

  useEffect(() => {
    const previouslyFocused = document.activeElement;
    const settingsDialog = dialog.current;
    settingsDialog?.showModal();
    return () => {
      abort.current?.abort();
      settingsDialog?.close();
      if (previouslyFocused instanceof HTMLElement && previouslyFocused.isConnected)
        previouslyFocused.focus();
    };
  }, []);

  useEffect(() => {
    abort.current?.abort();
    setImporting(false);
    setImportError('');
    setImportSuccess('');
    setFilter('');
    setModelKindFilter('all');
    setPricingEditor(null);
    setAutofillOpen(false);
    setManualId('');
    setManualKind('auto');
    setConfirmDelete(false);
  }, [selectedId]);

  function update(patch) {
    const next = { ...latest.current, ...patch };
    latest.current = next;
    onChange(next);
  }
  function updateProvider(patch, id = provider?.id) {
    update({
      providers: latest.current.providers.map((item) =>
        item.id === id ? { ...item, ...patch } : item,
      ),
    });
  }
  function applyAutofill(providerId, suggestions, override) {
    const current = latest.current.providers.find((item) => item.id === providerId);
    if (!current || !Array.isArray(suggestions)) return 0;
    const byId = new Map(suggestions.map((item) => [item.id, item]));
    let count = 0;
    const updated = current.models.map((model) => {
      const next = applyModelAutofill(model, byId.get(model.id), override);
      if (next !== model) count++;
      return next;
    });
    if (count) updateProvider({ models: updated }, providerId);
    return count;
  }
  function updateModel(id, patch) {
    updateProvider({
      models: models.map((model) => (model.id === id ? { ...model, ...patch } : model)),
    });
  }
  async function addProvider(preset) {
    const added = { ...createProvider(preset), apiKey: preset.apiKey || '' };
    try {
      if (onAddCloudProvider) await onAddCloudProvider(added);
      else update({ providers: [...latest.current.providers, added] });
    } catch (error) {
      if (customizing) throw error;
      setImportError(error.message);
      return;
    }
    setSelectedId(added.id);
    setAdding(false);
    setCustomizing(false);
  }
  function removeProvider() {
    const remaining = latest.current.providers.filter((item) => item.id !== provider.id);
    update({ providers: remaining });
    setSelectedId(remaining[0]?.id || '');
    setConfirmDelete(false);
    if (!remaining.length) setAdding(true);
  }
  async function importModels() {
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    const providerId = provider.id;
    setImporting(true);
    setImportError('');
    setImportSuccess('');
    try {
      const response = await connectionFetch('/api/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(account ? { providerId } : { provider }),
        signal: controller.signal,
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(
          data.error || data.message || 'Could not fetch models. Check your endpoint and key.',
        );
      if (!Array.isArray(data.models))
        throw new Error(
          'The provider returned an unexpected model list. You can add a model manually below.',
        );
      if (controller.signal.aborted) return;
      const existing =
        latest.current.providers.find((item) => item.id === providerId)?.models || [];
      const existingById = new Map(existing.map((model) => [model.id, model]));
      const discovered = data.models
        .map((model) => (typeof model === 'string' ? { id: model, name: model } : model))
        .filter((model) => model?.id)
        .map((model) => {
          const previous = existingById.get(model.id);
          return {
            ...model,
            name: previous?.name || model.name || model.id,
            icon: previous?.icon || model.icon || inferIcon(model.id, provider.icon),
            enabled: previous?.enabled !== false,
            kind: previous?.kind || 'auto',
            pricing: previous?.pricing,
            detectedKind:
              model.detectedKind ||
              inferModelKind({ ...model, kind: 'auto', detectedKind: undefined }),
          };
        });
      const discoveredIds = new Set(discovered.map((model) => model.id));
      const merged = [...discovered, ...existing.filter((model) => !discoveredIds.has(model.id))];
      updateProvider({ models: merged }, providerId);
      setImportSuccess(
        discovered.length
          ? `Found ${discovered.length} model${discovered.length === 1 ? '' : 's'}. Choose which appear in your selector.`
          : 'This endpoint returned no models. Add a model ID manually below.',
      );
    } catch (error) {
      if (error.name !== 'AbortError')
        setImportError(
          error.message ||
            'Unable to connect. Check the provider’s base URL and API key, then try Import models again.',
        );
    } finally {
      if (!controller.signal.aborted) setImporting(false);
    }
  }
  function addManualModel(event) {
    event.preventDefault();
    const id = manualId.trim();
    if (!id) {
      setImportError('Enter a model ID from your provider, then choose Add model.');
      event.currentTarget.querySelector('input')?.focus();
      return;
    }
    if (models.some((model) => model.id === id)) {
      setImportError('That model is already in this provider.');
      return;
    }
    updateProvider({
      models: [
        ...models,
        {
          id,
          name: id,
          icon: inferIcon(id, provider.icon),
          enabled: true,
          kind: manualKind,
          detectedKind: inferModelKind(id),
        },
      ],
    });
    setManualId('');
    setImportError('');
  }
  function updateColorSettings(patch) {
    update({ colors: normalizeColorSettings({ ...colorSettings, ...patch }) });
  }
  function updateColorToken(paletteName, key, value) {
    if (key === 'accent') {
      update({ colors: updatePaletteAccent(colorSettings, paletteName, value) });
      return;
    }
    if (value === colorSettings[paletteName][key]) return;
    updateColorSettings({
      preset: 'custom',
      [paletteName]: { ...colorSettings[paletteName], [key]: value },
    });
  }
  function applyPreset(id) {
    update({ colors: createColorSettingsFromPreset(id, colorSettings.mode) });
  }

  const close = () => {
    abort.current?.abort();
    onClose();
  };

  return (
    <dialog
      ref={dialog}
      className={`settings-dialog ${settings.effects === false ? 'settings-effects-off' : ''}`}
      aria-labelledby={`${formId}-title`}
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      onClick={(event) => {
        if (event.target === dialog.current) close();
      }}
    >
      <div className="settings-shell">
        <aside className="settings-rail">
          <div className="settings-rail-title">
            <SlidersHorizontal size={21} weight="duotone" />
            <span id={`${formId}-title`}>Settings</span>
          </div>
          <nav aria-label="Settings sections">
            {tabs.map((item) => (
              <button
                type="button"
                key={item.id}
                className={tab === item.id ? 'settings-tab active' : 'settings-tab'}
                aria-current={tab === item.id ? 'page' : undefined}
                onClick={() => setTab(item.id)}
              >
                <item.icon size={19} weight={tab === item.id ? 'duotone' : 'regular'} />
                {item.label}
              </button>
            ))}
          </nav>
          <div className="settings-device-note">
            <Database size={17} />
            <span>{account || 'Stored on this device'}</span>
          </div>
        </aside>
        <section className="settings-main">
          <button
            type="button"
            className="settings-close"
            onClick={close}
            aria-label="Close settings"
            title="Close settings (Esc)"
          >
            <X size={20} />
          </button>
          <div className="settings-scroll">
            {tab === 'providers' && (
              <>
                <header className="settings-page-heading">
                  <h2>Model connections</h2>
                  <p>Connect a provider and choose which models to enable.</p>
                </header>
                <div className="settings-provider-strip" aria-label="Configured providers">
                  {settings.providers.map((item) => (
                    <button
                      type="button"
                      className={`provider-chip ${provider?.id === item.id && !adding ? 'active' : ''}`}
                      aria-pressed={provider?.id === item.id && !adding}
                      key={item.id}
                      onClick={() => {
                        setSelectedId(item.id);
                        setAdding(false);
                        setCustomizing(false);
                      }}
                    >
                      <ModelIcon icon={item.icon} size={18} />
                      <span>{item.name}</span>
                    </button>
                  ))}
                  <button
                    type="button"
                    className={`provider-chip provider-add ${adding && !customizing ? 'active' : ''}`}
                    onClick={() => {
                      setAdding(customizing || !adding || !settings.providers.length);
                      setCustomizing(false);
                    }}
                    aria-expanded={adding && !customizing}
                  >
                    <Plus size={17} />
                    Add provider
                  </button>
                  <button
                    type="button"
                    className={`provider-chip provider-add ${customizing ? 'active' : ''}`}
                    onClick={() => {
                      setAdding(true);
                      setCustomizing(true);
                    }}
                    aria-expanded={adding && customizing}
                  >
                    <Plus size={17} />
                    Add custom provider
                  </button>
                </div>
                {adding && customizing && (
                  <CustomProviderForm
                    cloud={Boolean(account)}
                    onCreate={addProvider}
                    onCancel={() => {
                      setCustomizing(false);
                      setAdding(!settings.providers.length);
                    }}
                  />
                )}
                {adding && !customizing && (
                  <section className="provider-preset-section" aria-label="Choose a provider">
                    <div className="settings-section-title">
                      <h3>Choose a provider</h3>
                      <span>Every preset is fully editable</span>
                    </div>
                    <div className="provider-presets">
                      {PRESETS.map((preset) => (
                        <button
                          type="button"
                          key={preset.id}
                          className="provider-preset"
                          onClick={() =>
                            preset.id === 'custom' ? setCustomizing(true) : addProvider(preset)
                          }
                        >
                          <ModelIcon icon={preset.icon} size={26} />
                          <span>
                            <strong>{preset.name}</strong>
                            <small>
                              {preset.description ||
                                (preset.type === 'anthropic'
                                  ? 'Anthropic compatible'
                                  : preset.type === 'responses'
                                    ? 'Responses compatible'
                                    : 'OpenAI compatible')}
                            </small>
                          </span>
                          <Plus size={16} />
                        </button>
                      ))}
                      {!PRESETS.some((item) => item.id === 'custom') && (
                        <button
                          type="button"
                          className="provider-preset"
                          onClick={() => setCustomizing(true)}
                        >
                          <Plus size={26} />
                          <span>
                            <strong>Custom provider</strong>
                            <small>Any compatible endpoint</small>
                          </span>
                          <Plus size={16} />
                        </button>
                      )}
                    </div>
                  </section>
                )}
                {provider && !adding && (
                  <>
                    <div className="provider-config-heading">
                      <div className="provider-emblem">
                        <ModelIcon icon={provider.icon} size={28} />
                      </div>
                      <div>
                        <h3>{provider.name || 'Untitled provider'}</h3>
                        <p>
                          {models.length
                            ? `${selectedModels} of ${models.length} models enabled`
                            : 'Ready when you are'}
                        </p>
                      </div>
                      <div className="provider-enable">
                        <span>Enabled</span>
                        <Switch
                          checked={provider.enabled !== false}
                          onChange={(value) => updateProvider({ enabled: value })}
                          label="Enable provider"
                        />
                      </div>
                    </div>
                    <div className="settings-form-grid">
                      <label className="settings-field">
                        <span>Display name</span>
                        <input
                          value={provider.name || ''}
                          onChange={(event) => updateProvider({ name: event.target.value })}
                          placeholder="My provider"
                        />
                      </label>
                      <label className="settings-field">
                        <span>API format</span>
                        <div className="settings-select">
                          <select
                            value={provider.type || 'openai'}
                            onChange={(event) => updateProvider({ type: event.target.value })}
                          >
                            {API_FORMATS.map((format) => (
                              <option key={format.id} value={format.id}>
                                {format.name}
                              </option>
                            ))}
                          </select>
                          <CaretDown size={15} />
                        </div>
                      </label>
                      <label className="settings-field settings-field-wide">
                        <span>Base URL</span>
                        <input
                          type="url"
                          value={provider.baseUrl || ''}
                          onChange={(event) => updateProvider({ baseUrl: event.target.value })}
                          placeholder="https://api.openai.com/v1"
                          autoComplete="off"
                          spellCheck="false"
                        />
                        <small>
                          Uses {API_FORMATS.find((format) => format.id === provider.type)?.endpoint}
                          . The server connects directly to your endpoint. No browser CORS setup.
                        </small>
                      </label>
                      <div className="settings-field settings-field-key">
                        <label htmlFor={`${formId}-provider-key`}>API key</label>
                        {account ? <StoredSecret
                          key={provider.id}
                          id={`${formId}-provider-key`}
                          label="Provider API key"
                          configured={provider.hasApiKey}
                          onSave={(value, clear) => onSaveCredential({ providerId: provider.id, baseUrl: provider.baseUrl }, value, clear)}
                        /> : <SecretInput
                          id={`${formId}-provider-key`}
                          value={provider.apiKey}
                          onChange={(event) => updateProvider({ apiKey: event.target.value })}
                          label="Provider API key"
                          placeholder="Enter your API key"
                        />}
                        <small>{account ? 'Encrypted on the server and used for this provider’s HTTPS origin.' : 'Stored on this device and used by your local backend.'}</small>
                      </div>
                      <label className="settings-field">
                        <span>Default icon</span>
                        <div className="settings-select">
                          <select
                            value={provider.icon || ICONS[0]?.id || ''}
                            onChange={(event) => updateProvider({ icon: event.target.value })}
                          >
                            {ICONS.map((icon) => (
                              <option key={icon.id} value={icon.id}>
                                {icon.name}
                              </option>
                            ))}
                          </select>
                          <CaretDown size={15} />
                        </div>
                      </label>
                      <label className="settings-field settings-field-wide">
                        <span>Image generation API</span>
                        <div className="settings-select">
                          <select
                            value={provider.imageApi || 'auto'}
                            onChange={(event) => updateProvider({ imageApi: event.target.value })}
                          >
                            <option value="auto">Automatic</option>
                            <option value="openai">OpenAI-compatible Images</option>
                            <option value="gemini">Gemini native images</option>
                            <option value="openrouter">OpenRouter Images</option>
                            <option value="xai">xAI Images</option>
                          </select>
                          <CaretDown size={15} />
                        </div>
                        <small>
                          Used by image models independently of the chat format. Automatic
                          recognizes Gemini, OpenRouter, and xAI endpoints and uses the OpenAI
                          Images API for other providers.
                        </small>
                      </label>
                    </div>
                    <ProviderHeaders
                      headers={provider.customHeaders || []}
                      onChange={(customHeaders) => updateProvider({ customHeaders })}
                      onSaveValue={account ? (headerId, value, clear) => onSaveCredential({
                        providerId: provider.id, baseUrl: provider.baseUrl, headerId,
                      }, value, clear) : undefined}
                    />
                    <section className="provider-model-section">
                      <div className="settings-section-title">
                        <div>
                          <h3>Models</h3>
                          <p>
                            Enable models for their own picker. Automatic types can be overridden.
                          </p>
                        </div>
                        <div className="provider-model-actions">
                          {models.length > 0 && (
                            <button
                              type="button"
                              className="settings-button settings-button-secondary"
                              aria-expanded={autofillOpen}
                              onClick={() => setAutofillOpen(!autofillOpen)}
                            >
                              Autofill pricing
                            </button>
                          )}
                          <button
                            type="button"
                            className="settings-button settings-button-primary"
                            onClick={importModels}
                            disabled={importing || !provider.baseUrl?.trim()}
                          >
                            {importing ? (
                              <SpinnerGap className="settings-spinner" size={17} />
                            ) : (
                              <ArrowDown size={17} />
                            )}
                            {importing ? 'Discovering…' : 'Import models'}
                          </button>
                        </div>
                      </div>
                      {autofillOpen && models.length > 0 && (
                        <PricingAutofill
                          key={provider.id}
                          cloud={Boolean(account)}
                          connectionFetch={connectionFetch}
                          provider={provider}
                          providers={settings.providers}
                          onApply={applyAutofill}
                        />
                      )}
                      {importError && (
                        <div className="settings-message error" role="alert">
                          <Info size={18} />
                          <span>{importError}</span>
                        </div>
                      )}
                      <div
                        className={importSuccess ? 'settings-message success' : 'visually-hidden'}
                        role="status"
                        aria-live="polite"
                      >
                        {importSuccess && <CheckCircle size={18} />}
                        <span>{importSuccess}</span>
                      </div>
                      {models.length > 0 ? (
                        <>
                          <div
                            className="provider-kind-filters"
                            role="group"
                            aria-label="Filter models by type"
                          >
                            {[
                              { id: 'all', name: 'All' },
                              { id: 'chat', name: 'Chat' },
                              { id: 'image', name: 'Images' },
                              { id: 'video', name: 'Video' },
                              { id: 'other', name: 'Other' },
                            ].map((kind) => (
                              <button
                                type="button"
                                key={kind.id}
                                className={modelKindFilter === kind.id ? 'active' : ''}
                                aria-pressed={modelKindFilter === kind.id}
                                onClick={() => setModelKindFilter(kind.id)}
                              >
                                {kind.name}
                                <span>{modelCounts[kind.id]}</span>
                              </button>
                            ))}
                          </div>
                          <div className="provider-model-toolbar">
                            <label className="provider-select-all">
                              <input
                                type="checkbox"
                                checked={
                                  filteredModels.length > 0 &&
                                  filteredModels.every((model) => model.enabled !== false)
                                }
                                onChange={(event) => {
                                  const ids = new Set(filteredModels.map((model) => model.id));
                                  updateProvider({
                                    models: models.map((model) =>
                                      ids.has(model.id)
                                        ? { ...model, enabled: event.target.checked }
                                        : model,
                                    ),
                                  });
                                }}
                                aria-label="Enable all visible models"
                              />
                              <span>{selectedModels} selected</span>
                            </label>
                            <label className="provider-model-search">
                              <MagnifyingGlass size={16} />
                              <input
                                value={filter}
                                onChange={(event) => setFilter(event.target.value)}
                                placeholder="Filter models…"
                                aria-label="Filter models"
                              />
                            </label>
                          </div>
                          <div className="provider-model-list">
                            {filteredModels.map((model) => (
                              <div
                                className={`provider-model-row ${model.enabled !== false ? 'enabled' : ''}`}
                                key={model.id}
                              >
                                <input
                                  type="checkbox"
                                  checked={model.enabled !== false}
                                  onChange={(event) =>
                                    updateModel(model.id, { enabled: event.target.checked })
                                  }
                                  aria-label={`Enable ${model.name || model.id}`}
                                />
                                <ModelIcon icon={model.icon || provider.icon} size={20} />
                                <label className="provider-model-name">
                                  <input
                                    value={model.name || ''}
                                    placeholder={model.id}
                                    onChange={(event) =>
                                      updateModel(model.id, { name: event.target.value })
                                    }
                                    aria-label={`Display name for ${model.id}`}
                                  />
                                  <span dir="auto">{model.id}</span>
                                </label>
                                <div className="provider-model-controls">
                                  <select
                                    className="provider-model-kind"
                                    value={model.kind || 'auto'}
                                    onChange={(event) =>
                                      updateModel(model.id, { kind: event.target.value })
                                    }
                                    aria-label={`Model type for ${model.id}`}
                                    title="Model type"
                                  >
                                    {MODEL_KINDS.map((kind) => (
                                      <option key={kind.id} value={kind.id}>
                                        {kind.id === 'auto'
                                          ? `Auto: ${MODEL_KINDS.find((item) => item.id === inferModelKind({ ...model, kind: 'auto' }))?.name || 'Chat'}`
                                          : kind.name}
                                      </option>
                                    ))}
                                  </select>
                                  <select
                                    className="provider-model-icon"
                                    value={model.icon || provider.icon || ICONS[0]?.id || ''}
                                    onChange={(event) =>
                                      updateModel(model.id, { icon: event.target.value })
                                    }
                                    aria-label={`Icon for ${model.id}`}
                                  >
                                    {ICONS.map((icon) => (
                                      <option key={icon.id} value={icon.id}>
                                        {icon.name}
                                      </option>
                                    ))}
                                  </select>
                                  <button
                                    type="button"
                                    className={`provider-model-pricing-button${model.pricing ? ' configured' : ''}`}
                                    aria-label={`Edit pricing for ${model.id}`}
                                    aria-expanded={pricingEditor === model.id}
                                    onClick={() => setPricingEditor(pricingEditor === model.id ? null : model.id)}
                                  >
                                    Pricing
                                  </button>
                                </div>
                                <button
                                  type="button"
                                  className="provider-model-remove"
                                  aria-label={`Remove ${model.id}`}
                                  title="Remove model"
                                  onClick={() =>
                                    updateProvider({
                                      models: models.filter((item) => item.id !== model.id),
                                    })
                                  }
                                >
                                  <X size={14} />
                                </button>
                                {pricingEditor === model.id && (
                                  <ModelPricing
                                    model={model}
                                    onChange={(pricing) => updateModel(model.id, { pricing })}
                                  />
                                )}
                              </div>
                            ))}
                            {!filteredModels.length && (
                              <p className="provider-model-no-match">
                                No models match this type and search.
                              </p>
                            )}
                          </div>
                        </>
                      ) : (
                        <div className="provider-model-empty">
                          <SquaresFour size={28} weight="duotone" />
                          <strong>A whole world of models awaits.</strong>
                          <span>Import from your provider, or add a model ID below.</span>
                        </div>
                      )}
                      <form className="provider-manual-form" onSubmit={addManualModel}>
                        <label className="settings-field provider-manual-id-field">
                          <span>Model ID</span>
                          <input
                            value={manualId}
                            onChange={(event) => setManualId(event.target.value)}
                            placeholder="Or add a model ID manually…"
                            aria-label="Manual model ID"
                            required
                            autoComplete="off"
                            spellCheck="false"
                          />
                        </label>
                        <label className="settings-field provider-manual-type-field">
                          <span>Model type</span>
                          <select
                            value={manualKind}
                            onChange={(event) => setManualKind(event.target.value)}
                            aria-label="Manual model type"
                            className="provider-manual-kind"
                          >
                            {MODEL_KINDS.map((kind) => (
                              <option key={kind.id} value={kind.id}>
                                {kind.name}
                              </option>
                            ))}
                          </select>
                        </label>
                        <button type="submit" className="settings-button settings-button-secondary">
                          <Plus size={16} />
                          Add model
                        </button>
                      </form>
                    </section>
                    <div className="provider-remove-row">
                      {confirmDelete ? (
                        <>
                          <span>Remove this provider and its models?</span>
                          <button
                            type="button"
                            className="settings-text-button"
                            onClick={() => setConfirmDelete(false)}
                          >
                            Keep provider
                          </button>
                          <button
                            type="button"
                            className="settings-text-button danger"
                            onClick={removeProvider}
                          >
                            Remove
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          className="settings-text-button danger"
                          onClick={() => setConfirmDelete(true)}
                        >
                          <Trash size={15} />
                          Remove provider
                        </button>
                      )}
                    </div>
                  </>
                )}
              </>
            )}

            {tab === 'web' && (
              <>
                <header className="settings-page-heading">
                  <h2>Web search</h2>
                  <p>Choose Tavily or Exa for web search.</p>
                </header>
                <div className="settings-feature-heading">
                  <div className="settings-feature-icon">
                    <Globe size={30} weight="duotone" />
                  </div>
                  <div>
                    <h3>Search and sources</h3>
                    <p>
                      The model can search and read web pages. Sources appear with its response.
                    </p>
                  </div>
                </div>
                <label className="settings-field settings-web-key">
                  <span>Search provider</span>
                  <div className="settings-select">
                    <select
                      value={searchProvider}
                      onChange={(event) =>
                        update({
                          webSearch: { ...settings.webSearch, provider: event.target.value },
                        })
                      }
                    >
                      <option value="tavily">Tavily</option>
                      <option value="exa">Exa</option>
                    </select>
                    <CaretDown size={15} />
                  </div>
                  <small>Choose which service handles your model’s search and page requests.</small>
                </label>
                <div className="settings-field settings-web-key">
                  <label htmlFor={`${formId}-${searchProvider}`}>
                    {searchConnection.name} API key
                  </label>
                  {account ? <StoredSecret
                    key={searchProvider}
                    id={`${formId}-${searchProvider}`}
                    label={`${searchConnection.name} API key`}
                    configured={settings[searchProvider]?.hasApiKey}
                    onSave={(value, clear) => onSaveCredential({ searchId: searchProvider }, value, clear)}
                  /> : <SecretInput
                    key={searchProvider}
                    id={`${formId}-${searchProvider}`}
                    value={settings[searchProvider]?.apiKey}
                    onChange={(event) =>
                      update({
                        [searchProvider]: {
                          ...settings[searchProvider],
                          apiKey: event.target.value,
                        },
                      })
                    }
                    placeholder={searchConnection.placeholder}
                    label={`${searchConnection.name} API key`}
                  />}
                  <small>
                    Need a key?{' '}
                    <a href={searchConnection.keyUrl} target="_blank" rel="noreferrer">
                      Get one from {searchConnection.name} <ArrowSquareOut size={12} />
                    </a>
                  </small>
                </div>
                <div className="settings-option-row">
                  <div>
                    <strong>Web search by default</strong>
                    <p>
                      Start new chats with web tools available. The model searches only when needed.
                    </p>
                  </div>
                  <Switch
                    checked={settings.webSearch.enabled}
                    onChange={(value) =>
                      update({ webSearch: { ...settings.webSearch, enabled: value } })
                    }
                    label="Enable web search by default"
                  />
                </div>
                <div className="settings-note">
                  <Info size={19} />
                  <p>
                    Only queries and URLs chosen by the model are sent to {searchConnection.name}.
                    Web tools require a model that supports tool calling. Search and page requests
                    may incur charges on your {searchConnection.name} account.
                  </p>
                </div>
              </>
            )}

            {tab === 'preferences' && (
              <>
                <header className="settings-page-heading">
                  <h2>Preferences</h2>
                </header>
                {account && (
                  <section aria-labelledby="live-sync-heading">
                    <div className="settings-section-title">
                      <div>
                        <h3 id="live-sync-heading">Live sync</h3>
                        <p>Choose what follows you on this device. Chats and settings still save to your account.</p>
                      </div>
                    </div>
                    {accounts.liveOptions.map(({ id, label, detail }) => (
                      <div className="settings-option-row" key={id}>
                        <div><strong>{label}</strong><p>{detail}</p></div>
                        <Switch checked={live.preferences[id]} onChange={(value) => live.toggle(id, value)} label={label} />
                      </div>
                    ))}
                  </section>
                )}
                <div className="settings-option-row">
                  <div>
                    <strong>Automatic chat titles</strong>
                    <p>Ask your model for a short title after its first response.</p>
                  </div>
                  <Switch
                    checked={settings.autoRename !== false}
                    onChange={(value) => update({ autoRename: value })}
                    label="Automatically rename chats"
                  />
                </div>
                <div className="settings-option-row">
                  <div>
                    <strong>Allow image requests in chat</strong>
                    <p>
                      Hydroxide can prepare an image prompt. You choose an image model and click
                      Generate before any image request is sent.
                    </p>
                  </div>
                  <Switch
                    checked={settings.imageRequests !== false}
                    onChange={(value) => update({ imageRequests: value })}
                    label="Allow image requests in chat"
                  />
                </div>
                <div className="settings-option-row">
                  <div>
                    <strong>Visual effects</strong>
                    <p>Animate the background, composer, and responses.</p>
                  </div>
                  <Switch
                    checked={settings.effects !== false}
                    onChange={(value) => update({ effects: value })}
                    label="Enable visual effects"
                  />
                </div>
                <p className="settings-muted-note">
                  Your system’s reduced motion preference is always respected.
                </p>
                <label className="settings-field settings-system-field">
                  <span>System instructions</span>
                  <textarea
                    value={settings.systemPrompt || ''}
                    onChange={(event) => update({ systemPrompt: event.target.value })}
                    rows={5}
                    placeholder="Enter instructions for the model."
                  />
                  <small>
                    Added to Hydroxide’s built-in instructions for every conversation. Current date,
                    time, and your browser’s timezone are included automatically.
                  </small>
                </label>
                <label className="settings-temperature">
                  <span>
                    Temperature <output>{Number(settings.temperature ?? 0.7).toFixed(1)}</output>
                  </span>
                  <input
                    type="range"
                    min="0"
                    max="2"
                    step="0.1"
                    value={settings.temperature ?? 0.7}
                    onChange={(event) => update({ temperature: Number(event.target.value) })}
                  />
                  <small>
                    <span>More focused</span>
                    <span>More expressive</span>
                  </small>
                </label>
              </>
            )}

            {tab === 'colors' && (
              <>
                <header className="settings-page-heading">
                  <h2>Colors</h2>
                  <p>Choose a preset or set an accent for the whole workspace.</p>
                </header>
                <section className="color-settings-panel">
                  <div className="settings-section-title">
                    <div>
                      <h3>Appearance</h3>
                      <p>Use a separate palette for light and dark mode, or follow your system.</p>
                    </div>
                  </div>
                  <div className="color-mode-options" role="group" aria-label="Color mode">
                    {[
                      ['system', 'System', 'Follow your device'],
                      ['light', 'Light', 'Always use light'],
                      ['dark', 'Dark', 'Always use dark'],
                    ].map(([id, label, description]) => (
                      <button
                        type="button"
                        key={id}
                        className={`color-mode-option ${colorMode === id ? 'active' : ''}`}
                        aria-pressed={colorMode === id}
                        onClick={() => {
                          setEditingPalette(null);
                          updateColorSettings({ mode: id });
                        }}
                      >
                        <strong>{label}</strong>
                        <span>{description}</span>
                      </button>
                    ))}
                  </div>
                  <div className="color-palette-mode" role="group" aria-label="Palette to edit">
                    <span>Edit palette</span>
                    {['light', 'dark'].map((paletteName) => (
                      <button
                        type="button"
                        key={paletteName}
                        className={colorPaletteName === paletteName ? 'active' : ''}
                        aria-pressed={colorPaletteName === paletteName}
                        onClick={() => setEditingPalette(paletteName)}
                      >
                        {paletteName === 'light' ? 'Light colors' : 'Dark colors'}
                      </button>
                    ))}
                  </div>
                  {colorPaletteName !== activePalette && (
                    <p>These colors will apply when {colorPaletteName} mode is active.</p>
                  )}
                </section>
                <section className="color-settings-panel">
                  <div className="settings-section-title">
                    <div>
                      <h3>Color presets</h3>
                      <p>Presets change both palettes and the animated light field together.</p>
                    </div>
                    <button
                      type="button"
                      className="settings-text-button"
                      onClick={() => update({ colors: structuredClone(DEFAULT_COLORS) })}
                    >
                      Reset colors
                    </button>
                  </div>
                  <div className="color-presets">
                    {COLOR_PRESET_LIST.map((preset) => (
                      <button
                        type="button"
                        key={preset.id}
                        className={`color-preset ${colorSettings.preset === preset.id ? 'active' : ''}`}
                        aria-pressed={colorSettings.preset === preset.id}
                        onClick={() => applyPreset(preset.id)}
                      >
                        <span
                          className="color-preset-swatch"
                          style={{
                            '--preset-one': preset.light.accent,
                            '--preset-two': preset.light.magicViolet,
                            '--preset-three': preset.light.magicCyan,
                          }}
                        />
                        <span>
                          <strong>{preset.label}</strong>
                          <small>{preset.description}</small>
                        </span>
                      </button>
                    ))}
                  </div>
                </section>
                <section
                  className="color-preview"
                  aria-label="Color preview"
                  style={Object.fromEntries(COLOR_TOKENS.map(({ key, cssVar }) => [cssVar, colorPalette[key]]))}
                >
                  <div className="color-preview-copy">
                    <span className="color-preview-eyebrow">Live preview</span>
                    <strong>Make room for a thought.</strong>
                    <span>See how your selected surfaces and accent work together.</span>
                  </div>
                  <div className="color-preview-actions">
                    <button type="button">Primary action</button>
                    <span>Selected</span>
                  </div>
                </section>
                {COLOR_GROUPS.map((group) => (
                  <section className="color-settings-panel" key={group.id}>
                    <div className="settings-section-title">
                      <div>
                        <h3>{group.label}</h3>
                        <p>{group.description}</p>
                      </div>
                      <span>{colorPaletteName === 'dark' ? 'Dark palette' : 'Light palette'}</span>
                    </div>
                    <div className="color-token-grid">
                      {group.tokens.map((key) => {
                        const metadata = colorToken(key);
                        const label = metadata?.label || key.replace(/([A-Z])/g, ' $1').replace(/^./, (value) => value.toUpperCase());
                        const value = colorPalette[key];
                        return (
                          <label className="color-token" key={`${colorPaletteName}-${key}`}>
                            <span className="color-token-label">
                              <strong>{label}</strong>
                              <small>{metadata?.description}</small>
                            </span>
                            <span className="color-token-input">
                              <input
                                type="color"
                                value={toPickerHex(value)}
                                onChange={(event) => updateColorToken(colorPaletteName, key, event.target.value)}
                                aria-label={`${label} color`}
                              />
                              <ColorHexInput
                                value={value}
                                label={label}
                                onChange={(next) => updateColorToken(colorPaletteName, key, next)}
                              />
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </>
            )}

            {tab === 'data' && (
              <>
                <header className="settings-page-heading">
                  <h2>Backups</h2>
                  <p>Export or import chats, providers, and preferences.</p>
                </header>
                <div className="settings-backup-illustration" aria-hidden="true">
                  <Database size={53} weight="duotone" />
                  <span>
                    <Check size={16} weight="bold" />
                  </span>
                </div>
                <div className="settings-backup-copy">
                  <h3>Backup categories</h3>
                  <p>
                    Importing a category replaces the corresponding data in this workspace.
                  </p>
                </div>
                <label className="settings-backup-category">
                  <span>What to include</span>
                  <select
                    aria-label="What to include in the backup"
                    value={backupCategory}
                    onChange={(event) => setBackupCategory(event.target.value)}
                  >
                    <option value="all">Everything</option>
                    <option value="chats">Chats and generated images</option>
                    <option value="providers">{account ? 'Providers and API keys' : 'Providers'}</option>
                    <option value="preferences">Preferences only</option>
                  </select>
                </label>
                {accounts && !account && ['all', 'providers'].includes(backupCategory) && (
                  <label className="settings-option-row">
                    <span>Include readable credentials for cloud migration</span>
                    <input type="checkbox" checked={migrationExport} onChange={(event) => setMigrationExport(event.target.checked)} />
                  </label>
                )}
                <div className="settings-backup-actions">
                  <button
                    type="button"
                    className="settings-button settings-button-primary"
                    onClick={() => onExport(backupCategory, migrationExport && ['all', 'providers'].includes(backupCategory))}
                  >
                    <ArrowDown size={18} />
                    Export selection
                  </button>
                  <button
                    type="button"
                    className="settings-button settings-button-secondary"
                    onClick={() => onImport(backupCategory)}
                  >
                    <ArrowUp size={18} />
                    Import selection
                  </button>
                </div>
                <div className="settings-note">
                  <Info size={19} />
                  <p>
                    {account
                      ? 'Hydroxide encrypts credentials automatically. Restore hosted credentials by signing in to the account that exported them.'
                      : accounts
                        ? 'Exports omit credentials unless you include them for migration.'
                        : 'Exports omit API keys and custom header values.'}
                  </p>
                </div>
                <div className="settings-option-row settings-backup-detail">
                  <div>
                    <strong>{account ? 'Account storage' : 'Local storage'}</strong>
                    <p>
                      {account
                        ? 'Your chats, generated images, and preferences are saved to your account. Manage live sync in Preferences.'
                        : 'Your chats, settings, and generated images are saved in this browser. Clearing browser data removes your workspace.'}
                    </p>
                    {account && <button type="button" className="settings-text-button" onClick={onSignOut}>
                      Sign out of {account}
                    </button>}
                  </div>
                </div>
                <button
                  type="button"
                  className="settings-text-button danger"
                  onClick={onDeleteAllChats}
                  disabled={!canDeleteAllChats}
                >
                  <Trash size={18} />
                  Delete all chats
                </button>
              </>
            )}
          </div>
          <div
            className={`settings-notification ${notification ? 'has-notification' : ''}`}
            role="status"
            aria-live="polite"
          >
            <span>{notification || ''}</span>
            {notification && (
              <button
                type="button"
                className="icon-button"
                aria-label="Dismiss notification"
                onClick={onDismissNotification}
              >
                <X size={15} />
              </button>
            )}
          </div>
          <footer className="settings-footer">
            <span role={account ? 'status' : undefined}>
              <CheckCircle size={15} weight="fill" />
              {account ? cloudStatus : 'Changes saved on this device'}
            </span>
            <button
              type="button"
              className="settings-button settings-button-secondary"
              onClick={close}
            >
              Done
            </button>
          </footer>
        </section>
      </div>
    </dialog>
  );
}
