export const API_FORMATS = [
  {
    id: 'openai',
    name: 'OpenAI Chat Completions',
    description: 'OpenAI-compatible chat endpoints',
    endpoint: '/chat/completions',
  },
  {
    id: 'responses',
    name: 'OpenAI Responses',
    description: 'Responses-compatible endpoints',
    endpoint: '/responses',
  },
  {
    id: 'anthropic',
    name: 'Anthropic Messages',
    description: 'Anthropic-compatible endpoints',
    endpoint: '/messages',
  },
];
