import React from 'react';
import { normalizeCustomHeaders } from '../../shared/provider-headers.js';

// Logos are bundled locally. See ASSETS.md for upstream sources and licenses.
export const ICONS = [
  { id: 'hydroxide', name: 'Hydroxide', path: null },
  { id: 'openai', name: 'GPT / OpenAI', path: '/icons/openai.svg', monochrome: true },
  { id: 'claude', name: 'Claude', path: '/icons/claude-color.svg' },
  { id: 'gemini', name: 'Gemini', path: '/icons/gemini-color.svg' },
  { id: 'grok', name: 'Grok', path: '/icons/grok.svg', monochrome: true },
  { id: 'mistral', name: 'Mistral', path: '/icons/mistral-color.svg' },
  { id: 'minimax', name: 'MiniMax', path: '/icons/minimax-color.svg' },
  { id: 'kimi', name: 'Kimi', path: '/icons/kimi-color.svg' },
  { id: 'deepseek', name: 'DeepSeek', path: '/icons/deepseek-color.svg' },
  { id: 'qwen', name: 'Qwen', path: '/icons/qwen-color.svg' },
  { id: 'glm', name: 'GLM', path: '/icons/zai.svg', monochrome: true },
  { id: 'tavily', name: 'Tavily', path: '/icons/tavily-color.svg' },
];

export const PRESETS = [
  {
    id: 'openai',
    name: 'OpenAI',
    type: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    icon: 'openai',
    description: 'GPT models, with Chat Completions or Responses.',
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    type: 'anthropic',
    baseUrl: 'https://api.anthropic.com/v1',
    icon: 'claude',
    description: 'Claude models through the Messages API.',
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    type: 'openai',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    icon: 'gemini',
    description: 'Gemini through Google’s OpenAI-compatible API.',
  },
  {
    id: 'grok',
    name: 'xAI',
    type: 'responses',
    baseUrl: 'https://api.x.ai/v1',
    icon: 'grok',
    description: 'Grok models through the Responses API.',
  },
  {
    id: 'mistral',
    name: 'Mistral',
    type: 'openai',
    baseUrl: 'https://api.mistral.ai/v1',
    icon: 'mistral',
    description: 'Mistral and Codestral models.',
  },
  {
    id: 'minimax',
    name: 'MiniMax',
    type: 'openai',
    baseUrl: 'https://api.minimax.io/v1',
    icon: 'minimax',
    description: 'MiniMax’s OpenAI-compatible API.',
  },
  {
    id: 'kimi',
    name: 'Kimi',
    type: 'openai',
    baseUrl: 'https://api.moonshot.ai/v1',
    icon: 'kimi',
    description: 'Kimi models from Moonshot AI.',
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    type: 'openai',
    baseUrl: 'https://api.deepseek.com',
    icon: 'deepseek',
    description: 'DeepSeek’s OpenAI-compatible API.',
  },
  {
    id: 'glm',
    name: 'Z.ai',
    type: 'openai',
    baseUrl: 'https://api.z.ai/api/paas/v4',
    icon: 'glm',
    description: 'GLM models. Coding Plan keys need the Coding endpoint.',
  },
  {
    id: 'custom',
    name: 'Custom provider',
    type: 'openai',
    baseUrl: 'http://localhost:11434/v1',
    icon: 'hydroxide',
    description: 'Your endpoint, with any of the three API formats.',
  },
];

export function createProvider(preset = PRESETS[0]) {
  const source =
    typeof preset === 'string'
      ? PRESETS.find((item) => item.id === preset) || PRESETS.at(-1)
      : preset;
  return {
    id: crypto.randomUUID(),
    name: source.name,
    type: source.type,
    baseUrl: source.baseUrl,
    apiKey: '',
    customHeaders: normalizeCustomHeaders(source.customHeaders),
    imageApi: source.imageApi || 'auto',
    icon: source.icon,
    enabled: true,
    models: [],
  };
}

export function inferIcon(modelId = '', providerIcon = 'hydroxide') {
  const id = String(modelId).toLowerCase();
  if (/claude|anthropic/.test(id)) return 'claude';
  if (/gemini|gemma/.test(id)) return 'gemini';
  if (/grok|xai/.test(id)) return 'grok';
  if (/mistral|mixtral|codestral|ministral|magistral|devstral/.test(id)) return 'mistral';
  if (/minimax|abab/.test(id)) return 'minimax';
  if (/kimi|moonshot/.test(id)) return 'kimi';
  if (/deepseek/.test(id)) return 'deepseek';
  if (/qwen/.test(id)) return 'qwen';
  if (/glm|zhipu|zai-/.test(id)) return 'glm';
  if (/gpt|chatgpt|openai|(?:^|\/)o[1-9](?:[.-]|$)/.test(id)) return 'openai';
  return ICONS.some((item) => item.id === providerIcon) ? providerIcon : 'hydroxide';
}

export function ModelIcon({ icon = 'hydroxide', size = 20, className = '' }) {
  const asset = ICONS.find((item) => item.id === icon) || ICONS[0];
  if (!asset.path) {
    return (
      <span
        className={`model-icon model-icon-hydroxide ${className}`}
        aria-hidden="true"
        dir="ltr"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: size,
          height: size,
          flexShrink: 0,
          fontSize: Math.max(10, size * 0.54),
          fontWeight: 700,
          letterSpacing: '-0.08em',
        }}
      >
        OH<span style={{ fontSize: '0.65em', alignSelf: 'flex-start' }}>−</span>
      </span>
    );
  }
  return (
    <img
      className={`model-icon ${asset.monochrome ? 'model-icon-monochrome' : ''} ${className}`}
      src={asset.path}
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      draggable="false"
      style={{
        display: 'inline-block',
        objectFit: 'contain',
        flexShrink: 0,
      }}
    />
  );
}
