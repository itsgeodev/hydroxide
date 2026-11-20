import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import {
  ArrowUp,
  ArrowDown,
  ArrowRight,
  CaretRight,
  ChatCircle,
  Check,
  DotsThree,
  DownloadSimple,
  GearSix,
  Globe,
  MagnifyingGlass,
  PencilSimple,
  Plus,
  ShieldCheck,
  SidebarSimple,
  Stop,
  Trash,
  X,
} from '@phosphor-icons/react';
import ModelPicker from './components/ModelPicker.jsx';
import ChatCosts from './components/ChatCosts.jsx';
import Message from './components/Message.jsx';
import brandMark from './assets/hydroxide.svg?raw';
import {
  FlowField,
  playInteraction,
  useVisualEffects,
} from './components/WorkspaceEffects.jsx';
import {
  STORAGE_KEY,
  backupHasPlaintextCredentials,
  emptyWorkspace,
  loadWorkspace,
  localTitle,
  saveWorkspace,
  serializeBackup,
  serializeCategoryBackup,
  validateCategoryBackup,
  validateWorkspace,
} from './lib/storage.js';
import { ModelIcon } from './lib/providers.jsx';
import { inferModelKind } from '../shared/model-capabilities.js';
import { recordChatCost } from '../shared/model-pricing.js';
import { WEB_PROVIDERS } from '../shared/web-search.js';
import {
  conversationMessages,
  conversationMarkdown,
  imageIds,
  normalizeImageRequest,
} from '../shared/image-requests.js';
import {
  deleteImages,
  exportImages,
  getImage,
  putImages,
  saveImages,
  validateImageBackup,
} from './lib/media-store.js';
import { useGenerationJobs } from './lib/generation-jobs.js';
import {
  applyColorSettings,
  clearAppliedColorSettings,
} from './lib/theme.js';

const Settings = lazy(() => import('./components/Settings.jsx'));
const ImageGenerationCard = lazy(() => import('./components/ImageGenerationCard.jsx'));
const compactQuery = '(max-width: 800px)';

function download(content, filename, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function App() {
  const modifierKey = /Mac/.test(navigator.platform) ? 'Command' : 'Ctrl';
  const [workspace, updateWorkspace] = useState(() => {
    try {
      return loadWorkspace();
    } catch {
      let preserved = false;
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          localStorage.setItem(`${STORAGE_KEY}.recovery`, raw);
          preserved = true;
        }
      } catch {}
      return {
        ...emptyWorkspace(),
        storageLocked: !preserved,
        loadError: preserved
          ? 'Saved data could not be read. The original was preserved in local recovery storage. Import a backup to restore it.'
          : 'Device storage is unavailable. Export your work before leaving this page.',
      };
    }
  });
  const [settingsTab, setSettingsTab] = useState(null);
  const [compact, setCompact] = useState(() => window.matchMedia(compactQuery).matches);
  const [sidebarOpen, setSidebarOpen] = useState(() => !compact);
  const sidebarModal = compact && sidebarOpen;
  const [searching, setSearching] = useState(false);
  const [search, setSearch] = useState('');
  const chatJobs = useGenerationJobs();
  const imageJobs = useGenerationJobs();
  const [importingWorkspace, setImportingWorkspace] = useState(false);
  const importLock = useRef(false);
  const [completionStatus, setCompletionStatus] = useState('');
  const [toast, setToast] = useState(workspace.loadError || '');
  const [showNewResponse, setShowNewResponse] = useState(false);
  const [rename, setRename] = useState(null);
  const composer = useRef(null),
    composerDock = useRef(null),
    composerShell = useRef(null),
    composerStart = useRef(null),
    fileInput = useRef(null),
    conversation = useRef(null),
    importCategory = useRef('all'),
    renameDialog = useRef(null),
    sidebar = useRef(null),
    main = useRef(null),
    sidebarTrigger = useRef(null),
    nearBottom = useRef(true);
  const latestWorkspace = useRef(workspace);
  const freshMessages = useRef(new Set());
  const setWorkspace = useCallback((update) => {
    const before = latestWorkspace.current;
    const next = typeof update === 'function' ? update(before) : update;
    latestWorkspace.current = next;
    updateWorkspace(next);
  }, []);
  const { settings, chats, currentChatId, selectedModel, draft } = workspace;
  const webEnabled = workspace.webEnabled ?? settings.webSearch.enabled;
  const setDraft = (draft) => setWorkspace((current) => current.draft === draft ? current : { ...current, draft });
  const setWebEnabled = (webEnabled) => setWorkspace((current) => current.webEnabled === webEnabled ? current : { ...current, webEnabled });
  const motionEnabled = useVisualEffects(settings.effects !== false);
  const searchProvider = settings.webSearch.provider;
  const searchProviderName = searchProvider === 'exa' ? 'Exa' : 'Tavily';
  const activeChat = chats.find((c) => c.id === currentChatId);
  const generation = chatJobs.jobs.get(currentChatId);
  const imageGeneration = imageJobs.jobs.get(currentChatId);
  const status = generation?.status || '';
  const selectedProvider = settings.providers.find(
    (p) => p.id === selectedModel?.providerId && p.enabled !== false,
  );
  const selectedModelData = selectedProvider?.models.find(
    (m) => m.id === selectedModel?.modelId && m.enabled !== false && inferModelKind(m) === 'chat',
  );
  const model = selectedModelData
    ? { ...selectedModelData, name: selectedModelData.name?.trim() || selectedModelData.id }
    : null;
  const updateSettings = (next) => setWorkspace((w) => ({
    ...w,
    settings: next,
    webEnabled: w.settings.webSearch.enabled === next.webSearch.enabled ? w.webEnabled : null,
  }));
  const showSettings = useCallback((tab = 'providers') => setSettingsTab(tab), []);
  const notify = useCallback((message) => setToast(message), []);

  useLayoutEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const root = document.documentElement;
    const favicon = document.querySelector('link[rel="icon"]');
    const faviconFallback = favicon?.href;
    const themeColor = document.querySelector('meta[name="theme-color"]:not([media])');
    const apply = () => {
      const { palette } = applyColorSettings(settings.colors, root, media.matches);
      const paletteStyle = `<style>svg{--accent:${palette.accent};--on-accent:${palette.onAccent}}</style>`;
      const svg = brandMark.replace('>', `>${paletteStyle}`);
      const url = `data:image/svg+xml,${encodeURIComponent(svg)}`;
      root.style.setProperty('--brand-image', `url("${url}")`);
      if (favicon) favicon.href = url;
      if (themeColor) themeColor.content = palette.page;
    };
    apply();
    const update = () => {
      if (settings.colors?.mode === 'system') apply();
    };
    media.addEventListener('change', update);
    return () => {
      media.removeEventListener('change', update);
      clearAppliedColorSettings(root);
      root.style.removeProperty('--brand-image');
      if (favicon) favicon.href = faviconFallback;
      themeColor?.removeAttribute('content');
    };
  }, [settings.colors]);

  useEffect(() => {
    // Radix menus live outside the app element; preferences cover those too.
    document.documentElement.classList.toggle('effects-off', settings.effects === false);
    document.documentElement.classList.toggle('effects-paused', !motionEnabled);
    return () => {
      document.documentElement.classList.remove('effects-off', 'effects-paused');
    };
  }, [settings.effects, motionEnabled]);

  useEffect(() => {
    let lastSaved = null;
    const persist = () => {
      const current = latestWorkspace.current;
      if (current.storageLocked || current === lastSaved) return;
      try {
        saveWorkspace(current);
        lastSaved = current;
      } catch {
        setToast('Your device storage is full or unavailable. Export a backup to keep your work.');
      }
    };
    const timer = setInterval(persist, 500);
    const onVisibility = () => { if (document.hidden) persist(); };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', persist);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', persist);
      persist();
    };
  }, []);
  useEffect(() => {
    const media = window.matchMedia(compactQuery);
    const update = () => setCompact(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  useLayoutEffect(() => {
    setSidebarOpen(!compact);
  }, [compact]);
  useEffect(() => {
    document.title = activeChat ? `${activeChat.title} · Hydroxide Chat` : 'Hydroxide Chat';
  }, [activeChat?.title]);
  useEffect(() => {
    if (!sidebarModal) return;
    const trigger = document.activeElement;
    const panel = sidebar.current;
    const focusable = () =>
      [...panel.querySelectorAll('button:not(:disabled), input, [href], [tabindex="0"]')].filter(
        (element) => element.getClientRects().length,
      );
    if (!panel.contains(trigger)) focusable()[0]?.focus({ preventScroll: true });
    const trap = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setSidebarOpen(false);
      }
      if (
        event.key === 'Tab' &&
        !document.querySelector('dialog[open], [data-radix-popper-content-wrapper]')
      ) {
        const elements = focusable();
        const first = elements[0],
          last = elements.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    };
    panel.addEventListener('keydown', trap);
    return () => {
      panel.removeEventListener('keydown', trap);
      requestAnimationFrame(() => {
        if (trigger?.isConnected && trigger !== document.body && !panel.contains(trigger))
          trigger.focus();
        else sidebarTrigger.current?.focus();
      });
    };
  }, [sidebarModal]);
  useEffect(() => {
    if (model) return;
    const p = settings.providers.find(
      (p) =>
        p.enabled !== false &&
        p.models.some((m) => m.enabled !== false && inferModelKind(m) === 'chat'),
    );
    const next = p
      ? {
          providerId: p.id,
          modelId: p.models.find((m) => m.enabled !== false && inferModelKind(m) === 'chat').id,
        }
      : null;
    if (JSON.stringify(next) !== JSON.stringify(selectedModel))
      setWorkspace((w) => ({ ...w, selectedModel: next }));
  }, [settings.providers, model, selectedModel]);
  useLayoutEffect(() => {
    const element = composer.current;
    if (element) {
      element.style.height = 'auto';
      element.style.height = `${Math.min(element.scrollHeight, 180)}px`;
    }
  }, [draft]);
  useLayoutEffect(() => {
    const start = composerStart.current;
    composerStart.current = null;
    const dock = composerDock.current;
    const shell = composerShell.current;
    if (!start || start.chatId !== currentChatId || !motionEnabled || !dock || !shell) return;

    // The dock already occupies its chat position. Animate from the previous visual position.
    const offset = start.top - shell.getBoundingClientRect().top;
    const animation = dock.animate(
      [{ transform: `translateY(${offset}px)` }, { transform: 'translateY(0)' }],
      {
        duration: 250,
        easing: getComputedStyle(dock).getPropertyValue('--ease-in-out').trim(),
      },
    );
    return () => animation.cancel();
  }, [currentChatId, motionEnabled]);
  useEffect(() => {
    if (
      activeChat &&
      nearBottom.current &&
      (!imageGeneration || generation) &&
      conversation.current
    ) {
      conversation.current.scrollTop = conversation.current.scrollHeight;
      setShowNewResponse(false);
    } else if (generation || imageGeneration) {
      setShowNewResponse(true);
    }
  }, [activeChat?.messages, status, imageGeneration, generation]);
  useEffect(() => {
    if (!generation && !imageGeneration) setShowNewResponse(false);
  }, [generation, imageGeneration]);
  useEffect(() => {
    if (!generation) return;
    if (nearBottom.current) setShowNewResponse(false);
  }, [activeChat?.messages, generation, status]);
  useEffect(() => {
    nearBottom.current = true;
    if (conversation.current)
      conversation.current.scrollTop = currentChatId ? conversation.current.scrollHeight : 0;
    if (currentChatId && !generation) main.current?.focus({ preventScroll: true });
  }, [currentChatId]);
  useEffect(() => {
    const keydown = (event) => {
      if (document.querySelector('dialog[open]')) return;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setSidebarOpen(true);
        setSearching((s) => !s);
      }
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === 'o') {
        event.preventDefault();
        setWorkspace((w) => ({ ...w, currentChatId: null }));
        setDraft('');
        setWebEnabled(null);
        if (compact) setSidebarOpen(false);
        composer.current?.focus();
      }
    };
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  }, [compact]);
  useEffect(() => {
    if (rename && renameDialog.current && !renameDialog.current.open)
      renameDialog.current.showModal();
  }, [rename]);
  function newChat() {
    setWorkspace((w) => ({ ...w, currentChatId: null }));
    setDraft('');
    setWebEnabled(null);
    setSearch('');
    if (compact) setSidebarOpen(false);
    requestAnimationFrame(() => composer.current?.focus());
  }
  function patchMessage(chatId, messageId, patch) {
    setWorkspace((w) => ({
      ...w,
      chats: w.chats.map((c) =>
        c.id === chatId
          ? {
              ...c,
              updatedAt: Date.now(),
              messages: c.messages.map((m) =>
                m.id === messageId
                  ? { ...m, ...(typeof patch === 'function' ? patch(m) : patch) }
                  : m,
              ),
            }
          : c,
      ),
    }));
  }
  function patchImageRequest(chatId, messageId, patch) {
    patchMessage(chatId, messageId, (message) => ({
      imageRequest: { ...message.imageRequest, ...patch },
    }));
  }
  function addChatCosts(chatId, providerId, events, title) {
    setWorkspace((workspace) => ({
      ...workspace,
      chats: workspace.chats.map((chat) => {
        if (chat.id !== chatId) return chat;
        const costs = events.reduce(
          (entries, event) => recordChatCost(entries, providerId, event),
          chat.costs || [],
        );
        return {
          ...chat,
          costs,
          title: !chat.manualTitle && typeof title === 'string' && title.trim()
            ? title.trim()
            : chat.title,
        };
      }),
    }));
  }
  function captureComposerPosition(chatId) {
    if (!activeChat && motionEnabled && composerShell.current) {
      composerStart.current = { chatId, top: composerShell.current.getBoundingClientRect().top };
    }
  }
  async function generateImage(chatId, messageId) {
    if (imageJobs.current.current.has(chatId) || importLock.current) return;
    const current = latestWorkspace.current;
    const message = current.chats
      .find((chat) => chat.id === chatId)
      ?.messages.find((message) => message.id === messageId);
    const request = message?.imageRequest;
    if (!request) return;
    const provider = current.settings.providers.find(
      (provider) =>
        provider.id === request.modelSelection?.providerId && provider.enabled !== false,
    );
    const imageModel = provider?.models.find(
      (model) =>
        model.id === request.modelSelection?.modelId &&
        model.enabled !== false &&
        inferModelKind(model) === 'image',
    );
    if (!imageModel) {
      notify('Choose an enabled image model before generating.');
      return;
    }
    if (!request.prompt.trim()) {
      notify('Describe the image you would like to create.');
      return;
    }
    const requestController = imageJobs.start(chatId, messageId, 'Preparing your image…');
    if (!requestController) return;
    nearBottom.current = false;
    patchImageRequest(chatId, messageId, {
      status: 'generating',
      statusMessage: 'Preparing your image…',
      error: '',
    });
    let reader;
    try {
      const response = await fetch('/api/images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: requestController.signal,
        body: JSON.stringify({
          provider,
          model: imageModel.id,
          prompt: request.prompt,
          aspectRatio: request.aspectRatio,
        }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || `Image request failed (${response.status}).`);
      }
      if (!response.body) throw new Error('This browser could not read the image response.');
      reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let complete = false;
      const generated = [];
      const event = (line) => {
        if (!line.trim()) return;
        const data = JSON.parse(line);
        if (data.type === 'status')
          patchImageRequest(chatId, messageId, { statusMessage: data.message });
        if (data.type === 'cost') addChatCosts(chatId, provider.id, [data]);
        if (data.type === 'image' && data.image)
          generated.push({
            ...data.image,
            model: imageModel.name || imageModel.id,
            prompt: request.prompt,
            aspectRatio: request.aspectRatio,
          });
        if (data.type === 'error') throw new Error(data.message);
        if (data.type === 'done') complete = true;
      };
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let index;
        while ((index = buffer.indexOf('\n')) >= 0) {
          event(buffer.slice(0, index));
          buffer = buffer.slice(index + 1);
        }
      }
      buffer += decoder.decode();
      if (buffer.trim()) event(buffer);
      if (!complete || !generated.length)
        throw new Error('No complete image was received. You can try again.');
      if (requestController.signal.aborted) throw new DOMException('Stopped', 'AbortError');
      const saved = await saveImages(generated);
      if (requestController.signal.aborted) {
        await deleteImages(saved.map((image) => image.id)).catch(() => {});
        throw new DOMException('Stopped', 'AbortError');
      }
      patchImageRequest(chatId, messageId, {
        status: 'completed',
        statusMessage: '',
        error: '',
        images: saved,
      });
      if (saved.storageWarning) notify(saved.storageWarning);
      const otherChats = current.chats.map((chat) => ({
        ...chat,
        messages: chat.messages.filter((item) => item.id !== messageId || chat.id !== chatId),
      }));
      const keep = new Set(imageIds(otherChats));
      deleteImages(
        (request.images || []).map((image) => image.id).filter((id) => !keep.has(id)),
      ).catch(() => {});
    } catch (error) {
      patchImageRequest(chatId, messageId, {
        status: requestController.signal.aborted ? 'stopped' : 'error',
        statusMessage: '',
        error: requestController.signal.aborted
          ? ''
          : error.message || 'Image generation failed. Please try again.',
      });
    } finally {
      reader?.cancel().catch(() => {});
      requestController.abort();
      imageJobs.finish(chatId, messageId);
    }
  }
  async function runChat(chatId, history, assistant) {
    const requestController = chatJobs.start(chatId, assistant.id, 'Thinking…');
    if (!requestController) return;
    setCompletionStatus('');
    nearBottom.current = true;
    let complete = false;
    let reader;
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: requestController.signal,
        body: JSON.stringify({
          provider: selectedProvider,
          model: model.id,
          messages: conversationMessages(history),
          imagesEnabled: settings.imageRequests !== false,
          systemPrompt: settings.systemPrompt,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          temperature: settings.temperature,
          web: {
            enabled: webEnabled,
            provider: searchProvider,
            apiKey: settings[searchProvider].apiKey,
          },
        }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || `Request failed (${response.status}).`);
      }
      if (!response.body) throw new Error('This browser could not read the response stream.');
      reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      const event = (line) => {
        if (!line.trim()) return;
        const data = JSON.parse(line);
        if (data.type === 'delta') {
          chatJobs.status(chatId, assistant.id, 'Generating');
          patchMessage(chatId, assistant.id, (m) => ({ content: m.content + data.text }));
        }
        if (data.type === 'reasoning')
          patchMessage(chatId, assistant.id, (m) => ({
            reasoning: (m.reasoning || '') + data.text,
          }));
        if (data.type === 'status') chatJobs.status(chatId, assistant.id, data.message);
        if (data.type === 'cost') addChatCosts(chatId, selectedProvider.id, [data]);
        if (data.type === 'sources') patchMessage(chatId, assistant.id, { sources: data.sources });
        if (data.type === 'image_request')
          patchMessage(chatId, assistant.id, {
            imageRequest: normalizeImageRequest({
              ...data.request,
              status: 'ready',
              modelSelection: null,
              images: [],
            }),
          });
        if (data.type === 'error') throw new Error(data.message);
        if (data.type === 'done') complete = true;
      };
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let index;
        while ((index = buffer.indexOf('\n')) >= 0) {
          event(buffer.slice(0, index));
          buffer = buffer.slice(index + 1);
        }
      }
      buffer += decoder.decode();
      if (buffer.trim()) event(buffer);
      if (!complete)
        throw new Error('The connection ended before the response finished. You can try again.');
      if (latestWorkspace.current.currentChatId === chatId) setCompletionStatus('Response ready.');
      if (settings.autoRename && history.filter((m) => m.role === 'user').length === 1) {
        fetch('/api/title', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            provider: selectedProvider,
            model: model.id,
            messages: conversationMessages(history),
          }),
        })
          .then((r) => r.json())
          .then(({ title, costs }) => addChatCosts(
            chatId,
            selectedProvider.id,
            Array.isArray(costs) ? costs : [],
            title,
          ))
          .catch(() => {});
      }
    } catch (error) {
      if (requestController.signal.aborted) {
        if (latestWorkspace.current.chats.some((chat) => chat.id === chatId)) {
          patchMessage(chatId, assistant.id, { interrupted: true });
          if (latestWorkspace.current.currentChatId === chatId)
            setCompletionStatus('Generation stopped. Your partial response is saved.');
        }
      } else {
        patchMessage(chatId, assistant.id, {
          error: error.message || 'Something went wrong. Please try again.',
        });
        if (latestWorkspace.current.currentChatId === chatId)
          setCompletionStatus('The response could not finish. Use Try again to retry.');
      }
    } finally {
      reader?.cancel().catch(() => {});
      requestController.abort();
      patchMessage(chatId, assistant.id, { pending: false });
      chatJobs.finish(chatId, assistant.id);
      if (latestWorkspace.current.currentChatId === chatId && !document.querySelector('dialog[open]'))
        composer.current?.focus();
    }
  }
  function send(event) {
    event?.preventDefault();
    if (generation || chatJobs.current.current.has(currentChatId) || importLock.current) return;
    if (!draft?.trim()) {
      notify('Write a message to start the conversation.');
      composer.current?.focus();
      return;
    }
    if (!model) {
      showSettings();
      notify('Connect a provider and enable a model to start chatting.');
      return;
    }
    const user = { id: crypto.randomUUID(), role: 'user', content: draft.trim() };
    const assistant = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: '',
      model: model.name,
      icon: model.icon || selectedProvider.icon,
      pending: true,
    };
    const chatId = activeChat?.id || crypto.randomUUID();
    captureComposerPosition(chatId);
    freshMessages.current.add(user.id).add(assistant.id);
    const history = [...(activeChat?.messages || []), user];
    setWorkspace((w) => ({
      ...w,
      currentChatId: chatId,
      chats: activeChat
        ? w.chats.map((c) =>
            c.id === chatId
              ? { ...c, messages: [...history, assistant], updatedAt: Date.now() }
              : c,
          )
        : [
            {
              id: chatId,
              title: localTitle(user.content),
              createdAt: Date.now(),
              updatedAt: Date.now(),
              messages: [user, assistant],
            },
            ...w.chats,
          ],
    }));
    setDraft('');
    runChat(chatId, history, assistant);
  }
  function regenerate() {
    if (generation || !activeChat || chatJobs.current.current.has(activeChat.id) || importLock.current) return;
    if (!model) {
      showSettings();
      return;
    }
    const lastUser = activeChat.messages.findLastIndex((m) => m.role === 'user');
    if (lastUser < 0) return;
    const history = activeChat.messages.slice(0, lastUser + 1);
    const assistant = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: '',
      model: model.name,
      icon: model.icon || selectedProvider.icon,
      pending: true,
    };
    freshMessages.current.add(assistant.id);
    setWorkspace((w) => ({
      ...w,
      chats: w.chats.map((c) =>
        c.id === activeChat.id ? { ...c, messages: [...history, assistant] } : c,
      ),
    }));
    runChat(activeChat.id, history, assistant);
  }
  async function exportBackup(category = 'all') {
    try {
      const current = latestWorkspace.current;
      const media =
        category === 'providers' || category === 'preferences'
          ? []
          : await exportImages(current.chats);
      const content =
        category === 'all'
          ? serializeBackup(current, media)
          : serializeCategoryBackup(current, category, media);
      download(
        content,
        `hydroxide-${category}-backup-${new Date().toISOString().slice(0, 10)}.json`,
      );
      notify('Backup exported.');
    } catch (error) {
      notify(error.message || 'Could not export this workspace.');
    }
  }
  async function importAll(event, requestedCategory = 'all') {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (chatJobs.current.current.size || imageJobs.current.current.size || importLock.current) {
      notify('Stop your running tasks before importing a workspace.');
      return;
    }
    importLock.current = true;
    setImportingWorkspace(true);
    try {
      if (file.size > 250 * 1024 * 1024)
        throw new Error('This backup is too large. Maximum size is 250 MB.');
      const data = JSON.parse(await file.text());
      if (data.credentials || backupHasPlaintextCredentials(data))
        throw new Error('Choose a workspace backup that was exported with credentials omitted.');
      const category = data.category || 'all';
      if (category !== requestedCategory)
        throw new Error(`Choose “${category}” in Data & backups to import this file.`);
      const current = latestWorkspace.current;
      const scoped = category === 'all' ? null : validateCategoryBackup(data, current);
      const next = scoped?.workspace || validateWorkspace(data);
      const media =
        category === 'all' || category === 'chats'
          ? validateImageBackup(data.media, next.chats)
          : [];
      const replacesSearchKey = WEB_PROVIDERS.some(({ id }) => {
        const currentKey = current.settings[id]?.apiKey;
        return currentKey && currentKey !== next.settings[id]?.apiKey;
      });
      if (current.chats.length || current.settings.providers.length || replacesSearchKey) {
        const confirmation =
          category === 'all'
            ? `Replace this workspace with ${next.chats.length} chats and ${next.settings.providers.length} providers from the backup? Export your current workspace first if you want to keep it.`
            : category === 'providers'
              ? 'Replace providers and any included API keys with the values in this backup?'
              : `Replace the ${category} in this workspace with the backup?`;
        if (!window.confirm(confirmation)) return;
      }
      const imported = media.map((image) => ({ ...image, id: crypto.randomUUID() }));
      const remap = new Map(media.map((image, index) => [image.id, imported[index].id]));
      if (category === 'all' || category === 'chats')
        for (const chat of next.chats)
          for (const message of chat.messages)
            if (message.imageRequest)
              message.imageRequest.images = message.imageRequest.images.map((image) => ({
                ...image,
                id: remap.get(image.id) || image.id,
              }));
      await putImages(imported);
      try {
        saveWorkspace(next);
        setWorkspace(next);
      } catch (error) {
        await deleteImages(imported.map((image) => image.id)).catch(() => {});
        throw error;
      }
      notify(
        category === 'all'
          ? `Imported ${next.chats.length} conversations and all settings.`
          : `Imported ${category}. Other workspace data was preserved.`,
      );
      if (category === 'all' || category === 'chats') {
        const oldIds = new Set(imageIds(current.chats));
        const newIds = new Set(imageIds(next.chats));
        deleteImages([...oldIds].filter((id) => !newIds.has(id))).catch(() => {});
      }
    } catch (error) {
      notify(
        error instanceof SyntaxError
          ? 'This file is not valid JSON. Choose a Hydroxide backup.'
          : error.message,
      );
    } finally {
      importLock.current = false;
      setImportingWorkspace(false);
    }
  }
  function deleteChat(chat) {
    if (chatJobs.jobs.has(chat.id) || imageJobs.jobs.has(chat.id)) {
      notify('Stop this response before deleting the conversation.');
      return;
    }
    if (
      !window.confirm(`Delete “${chat.title}”? This removes it from this device.`)
    )
      return;
    setWorkspace((w) => ({
      ...w,
      chats: w.chats.filter((c) => c.id !== chat.id),
      currentChatId: w.currentChatId === chat.id ? null : w.currentChatId,
    }));
    const keep = new Set(imageIds(chats.filter((item) => item.id !== chat.id)));
    deleteImages(imageIds([chat]).filter((id) => !keep.has(id))).catch(() => {});
    notify('Conversation deleted.');
  }
  function deleteAllChats() {
    const current = latestWorkspace.current;
    if (importLock.current || !current.chats.length) return;
    if (!window.confirm('Delete all chats and their generated images from this browser?')) return;
    if (!window.confirm('Permanently delete all chats? This cannot be undone.')) return;

    const next = { ...current, chats: [], currentChatId: null, draft: '', webEnabled: null };
    try {
      saveWorkspace(next);
    } catch {
      notify('Could not delete chats because browser storage is unavailable.');
      return;
    }

    chatJobs.abortAll();
    imageJobs.abortAll();
    setWorkspace(next);
    setSearch('');
    setRename(null);
    setCompletionStatus('');
    notify('All chats deleted.');
    deleteImages(imageIds(current.chats)).catch(() => {
      notify('All chats were deleted, but some generated images could not be removed from browser storage.');
    });
  }
  const filteredChats = [...chats]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .filter((c) =>
      `${c.title} ${c.messages.map((m) => [m.content, m.imageRequest?.prompt || ''].join(' ')).join(' ')}`
        .toLowerCase()
        .includes(search.toLowerCase()),
    );

  return (
    <div
      className={`app ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'} ${compact ? 'sidebar-overlay' : ''} ${settings.effects === false ? 'effects-off' : ''} ${!motionEnabled ? 'effects-paused' : ''}`}
      onPointerDownCapture={(event) => playInteraction(event, motionEnabled)}
    >
      <a
        className="skip-link"
        href="#workspace-content"
        inert={sidebarModal || undefined}
        onClick={() => main.current?.focus()}
      >
        Skip to content
      </a>
      <aside
        ref={sidebar}
        className="sidebar"
        aria-label="Chat history"
        inert={!sidebarOpen || undefined}
        role={sidebarModal ? 'dialog' : undefined}
        aria-modal={sidebarModal || undefined}
      >
        <div className="sidebar-brand">
          <button onClick={newChat} className="brand" aria-label="Hydroxide home">
            <span className="brand-mark sidebar-mark" aria-hidden="true" />
            <span>
              hydroxide<span className="brand-chat">chat</span>
            </span>
          </button>
          <button
            className="icon-button collapse-sidebar"
            onClick={() => setSidebarOpen(false)}
            aria-label={compact ? 'Close sidebar' : 'Collapse sidebar'}
          >
            {compact ? <X size={20} /> : <SidebarSimple size={19} />}
          </button>
        </div>
        <button className="new-chat" onClick={newChat}>
          <Plus size={18} />
          <span>New conversation</span>
          <kbd>{modifierKey} Shift O</kbd>
        </button>
        <button
          className="search-chats"
          aria-expanded={searching}
          onClick={() => setSearching((v) => !v)}
        >
          <MagnifyingGlass size={17} />
          <span>Search conversations</span>
          <kbd>{modifierKey} K</kbd>
        </button>
        {searching && (
          <div className="sidebar-search">
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search your chats…"
              aria-label="Search conversations"
            />
            <button
              className="icon-button"
              onClick={() => {
                setSearching(false);
                setSearch('');
              }}
              aria-label="Close search"
            >
              <X size={14} />
            </button>
          </div>
        )}
        <div className="history-label">
          Your conversations <span>{chats.length ? chats.length : ''}</span>
        </div>
        <nav className="chat-list" aria-label="Saved conversations">
          {filteredChats.map((chat) => (
            <div key={chat.id} className={`chat-row ${chat.id === currentChatId ? 'active' : ''}`}>
              <button
                className="chat-link"
                aria-current={chat.id === currentChatId ? 'page' : undefined}
                title={chat.title}
                onClick={() => {
                  setWorkspace((w) => ({ ...w, currentChatId: chat.id }));
                  setDraft('');
                  if (compact) setSidebarOpen(false);
                }}
              >
                <ChatCircle size={17} />
                <span>{chat.title}</span>
                {(chatJobs.jobs.has(chat.id) || imageJobs.jobs.has(chat.id)) && (
                  <span className="chat-working" role="img" aria-label="Generating" />
                )}
              </button>
              <DropdownMenu.Root>
                <DropdownMenu.Trigger
                  className="chat-menu-trigger icon-button"
                  aria-label={`Options for ${chat.title}`}
                >
                  <DotsThree size={20} />
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content className="context-menu" sideOffset={4} align="start">
                    <DropdownMenu.Item
                      onSelect={() => setRename({ id: chat.id, title: chat.title })}
                    >
                      <PencilSimple size={16} />
                      Rename
                    </DropdownMenu.Item>
                    <DropdownMenu.Item
                      onSelect={() =>
                        download(
                          conversationMarkdown(chat),
                          `${chat.title.replace(/[^a-z0-9 -]/gi, '').slice(0, 50) || 'conversation'}.md`,
                          'text/markdown',
                        )
                      }
                    >
                      <DownloadSimple size={16} />
                      Export conversation
                    </DropdownMenu.Item>
                    <DropdownMenu.Separator />
                    <DropdownMenu.Item className="danger" onSelect={() => deleteChat(chat)}>
                      <Trash size={16} />
                      Delete
                    </DropdownMenu.Item>
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>
            </div>
          ))}
          {!filteredChats.length && (
            <div className="history-empty">
              <ChatCircle size={25} weight="thin" />
              <p>{search ? 'No conversations found.' : 'No conversations yet.'}</p>
            </div>
          )}
        </nav>
        {!settings.providers.some((p) => p.models.some((m) => m.enabled)) && (
          <button className="connect-card" onClick={() => showSettings()}>
            <span className="connect-link">
              Connect a provider <ArrowRight size={14} />
            </span>
          </button>
        )}
        <div className="sidebar-bottom">
          <button className="sidebar-settings" onClick={() => showSettings()}>
            <GearSix size={18} />
            <span>Settings & connections</span>
            <CaretRight size={14} />
          </button>
          <div className="workspace-profile">
            <span className="profile-avatar">Y</span>
            <span>
              <strong>Your workspace</strong>
              <small>Stored on this device</small>
            </span>
            <ShieldCheck size={16} />
          </div>
        </div>
      </aside>

      <main
        ref={main}
        id="workspace-content"
        tabIndex={-1}
        aria-label={activeChat?.title}
        className={`main-workspace ${activeChat ? '' : 'is-empty'}`}
        inert={sidebarModal || undefined}
      >
        {(activeChat && generation?.chatId === activeChat.id) && settings.effects !== false && (
          <div className="workspace-flow flow-active" aria-hidden="true">
            <FlowField active />
          </div>
        )}
        <header className="topbar">
          <div className="topbar-left">
            {!sidebarOpen && (
              <button
                ref={sidebarTrigger}
                className="icon-button"
                onClick={() => setSidebarOpen(true)}
                aria-label="Open sidebar"
              >
                <SidebarSimple size={20} />
              </button>
            )}
            <ModelPicker
              providers={settings.providers}
              selected={selectedModel}
              onSelect={(value) => {
                setWorkspace((w) => ({ ...w, selectedModel: value }));
              }}
              onSettings={() => showSettings()}
              disabled={Boolean(generation) || importingWorkspace}
            />
          </div>
          <div className="topbar-right">
            {activeChat && <ChatCosts costs={activeChat.costs} provider={selectedProvider} />}
            {compact && (
              <button
                className="icon-button"
                onClick={newChat}
                title="New conversation"
                aria-label="New conversation"
              >
                <PencilSimple size={19} />
              </button>
            )}
          </div>
        </header>
        <div
          ref={conversation}
          className="conversation-scroll"
          hidden={!activeChat}
          onScroll={(e) => {
            const el = e.currentTarget;
            nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 130;
          }}
        >
          {activeChat && (
            <>
              <button
                className="new-response-button"
                type="button"
                hidden={!showNewResponse}
                onClick={() => {
                  nearBottom.current = true;
                  setShowNewResponse(false);
                  conversation.current?.scrollTo({
                    top: conversation.current.scrollHeight,
                    behavior: motionEnabled ? 'smooth' : 'auto',
                  });
                }}
              >
                <ArrowDown size={15} aria-hidden="true" />
                New response below
              </button>
              <div className="conversation-content">
                {activeChat.messages.map((message, i) => (
                  <Message
                    key={message.id}
                    message={message}
                    animate={freshMessages.current.has(message.id)}
                    onArrived={() => freshMessages.current.delete(message.id)}
                    effects={motionEnabled}
                    streaming={generation?.messageId === message.id}
                    status={status}
                    isLast={i === activeChat.messages.length - 1}
                    onRetry={regenerate}
                    onToast={notify}
                  >
                    {message.imageRequest && (
                      <Suspense
                        fallback={<p className="image-card-loading">Opening the image studio…</p>}
                      >
                        <ImageGenerationCard
                          request={
                            message.imageRequest.status === 'generating' &&
                            imageGeneration?.messageId !== message.id
                              ? { ...message.imageRequest, status: 'ready', statusMessage: '' }
                              : message.imageRequest
                          }
                          providers={settings.providers}
                          readImage={getImage}
                          onChange={(patch) => patchImageRequest(activeChat.id, message.id, patch)}
                          onGenerate={() => generateImage(activeChat.id, message.id)}
                          onStop={imageGeneration?.messageId === message.id
                            ? () => imageGeneration.controller.abort()
                            : undefined}
                          onSettings={() => showSettings('providers')}
                          effects={settings.effects !== false}
                          isChatStreaming={generation?.messageId === message.id}
                          disabled={
                            Boolean(generation) ||
                            importingWorkspace ||
                            Boolean(imageGeneration && imageGeneration.messageId !== message.id)
                          }
                        />
                      </Suspense>
                    )}
                  </Message>
                ))}
              </div>
            </>
          )}
        </div>
        <div className="composer-dock" ref={composerDock}>
          {!activeChat && (
            <div className="welcome-brand">
              <span className="brand-mark welcome-mark" aria-hidden="true" />
              <h1>hydroxide</h1>
            </div>
          )}
          <div
            ref={composerShell}
            className={`composer-shell ${generation ? 'is-generating' : ''} ${draft ? 'has-draft' : ''}`}
          >
            <form className="composer" onSubmit={send}>
              <textarea
                ref={composer}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder="Write a message"
                aria-label="Message"
                name="message"
                autoComplete="off"
                aria-describedby="composer-help"
                rows={1}
                disabled={Boolean(generation) || importingWorkspace}
                maxLength={100000}
              />
              <div className="composer-toolbar">
                <div className="composer-tools">
                  <button
                    type="button"
                    className={`web-button ${webEnabled ? 'enabled' : ''}`}
                    aria-pressed={webEnabled}
                    title={`Allow the model to search and read pages with ${searchProviderName} when needed`}
                    onClick={() => {
                      if (webEnabled) {
                        setWebEnabled(false);
                      } else if (!settings[searchProvider].apiKey.trim()) {
                        showSettings('web');
                        notify(`Add your ${searchProviderName} API key to enable web search.`);
                      } else setWebEnabled(true);
                    }}
                    disabled={Boolean(generation) || importingWorkspace}
                  >
                    <Globe size={17} />
                    <span>Web search</span>
                    {webEnabled && <Check size={12} />}
                  </button>
                  <span className="composer-tool-divider" />
                  {model && (
                    <span className="composer-model-label">
                      <ModelIcon icon={model.icon || selectedProvider.icon} size={13} />
                      {model.name}
                    </span>
                  )}
                </div>
                {generation ? (
                  <button
                    className="send-button stop-button"
                    type="button"
                    onClick={() => generation.controller.abort()}
                    aria-label="Stop generating"
                  >
                    <Stop size={16} weight="fill" />
                  </button>
                ) : (
                  <button
                    className="send-button"
                    type="submit"
                    disabled={importingWorkspace}
                    aria-label="Send message"
                  >
                    <ArrowUp size={21} weight="bold" />
                  </button>
                )}
              </div>
            </form>
          </div>
          <div className="composer-footnote" id="composer-help">
            <span role="status" aria-live="polite">
              {generation ? status : imageGeneration ? imageGeneration.status :
                activeChat ? 'AI can make mistakes.' : null}
            </span>
            <span className="keyboard-hint">
              <kbd>Enter</kbd> to send <span>/</span>
              <kbd>Shift Enter</kbd> for a new line
            </span>
          </div>
        </div>
      </main>
      {settingsTab && (
        <Suspense fallback={null}>
          <Settings
            settings={settings}
            onChange={updateSettings}
            onClose={() => setSettingsTab(null)}
            initialTab={settingsTab}
            onExport={exportBackup}
            onImport={(category) => {
              importCategory.current = category;
              fileInput.current?.click();
            }}
            onDeleteAllChats={deleteAllChats}
            canDeleteAllChats={chats.length > 0 && !importingWorkspace}
            notification={toast}
            onDismissNotification={() => setToast('')}
          />
        </Suspense>
      )}
      <input
        ref={fileInput}
        type="file"
        hidden
        accept=".json,application/json"
        className="visually-hidden"
        onChange={(event) => importAll(event, importCategory.current)}
        aria-label="Import selected workspace backup"
      />
      <div className="visually-hidden" role="status" aria-live="polite" aria-atomic="true">
        {toast}
      </div>
      <div className="visually-hidden" role="status" aria-live="polite" aria-atomic="true">
        {completionStatus}
      </div>
      {toast && !settingsTab && (
        <div className="toast">
          <span>{toast}</span>
          <button
            className="icon-button"
            onClick={() => setToast('')}
            aria-label="Dismiss notification"
          >
            <X size={15} />
          </button>
        </div>
      )}
      {rename && (
        <dialog
          ref={renameDialog}
          className="rename-dialog"
          aria-labelledby="rename-heading"
          onCancel={() => setRename(null)}
          onClose={() => setRename(null)}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!rename.title.trim()) return;
              setWorkspace((w) => ({
                ...w,
                chats: w.chats.map((c) =>
                  c.id === rename.id ? { ...c, title: rename.title.trim(), manualTitle: true } : c,
                ),
              }));
              renameDialog.current.close();
            }}
          >
            <h2 id="rename-heading">A new name</h2>
            <p>Give this conversation a name that feels right.</p>
            <input
              value={rename.title}
              onChange={(e) => setRename({ ...rename, title: e.target.value })}
              maxLength={100}
              aria-label="Conversation name"
              autoFocus
            />
            <div>
              <button
                type="button"
                className="secondary-button"
                onClick={() => renameDialog.current.close()}
              >
                Cancel
              </button>
              <button className="primary-button" disabled={!rename.title.trim()}>
                Save name
              </button>
            </div>
          </form>
        </dialog>
      )}
    </div>
  );
}
