export const IMAGE_ASPECT_RATIOS = ['1:1', '3:2', '2:3'];
export const IMAGE_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'image/avif',
];
const states = ['ready', 'generating', 'completed', 'error', 'stopped'];

export function normalizeImageRequest(input, { recover = false } = {}) {
  if (
    !input ||
    typeof input !== 'object' ||
    typeof input.prompt !== 'string' ||
    input.prompt.length > 12000
  )
    throw new Error('An image request in this workspace is invalid.');
  const images = (Array.isArray(input.images) ? input.images : []).map((image) => {
    if (
      !image ||
      typeof image.id !== 'string' ||
      !image.id ||
      !IMAGE_MIME_TYPES.includes(image.mimeType)
    )
      throw new Error('A generated image reference in this workspace is invalid.');
    return {
      id: image.id,
      mimeType: image.mimeType,
      revisedPrompt:
        typeof image.revisedPrompt === 'string' ? image.revisedPrompt.slice(0, 16000) : '',
      model: typeof image.model === 'string' ? image.model : '',
      prompt: typeof image.prompt === 'string' ? image.prompt.slice(0, 12000) : input.prompt,
      aspectRatio: IMAGE_ASPECT_RATIOS.includes(image.aspectRatio)
        ? image.aspectRatio
        : input.aspectRatio || '1:1',
    };
  });
  const selection = input.modelSelection;
  const interrupted = recover && input.status === 'generating';
  return {
    prompt: input.prompt,
    title:
      typeof input.title === 'string' && input.title !== 'Bring an idea to life'
        ? input.title.slice(0, 160)
        : 'Image generation',
    aspectRatio: IMAGE_ASPECT_RATIOS.includes(input.aspectRatio) ? input.aspectRatio : '1:1',
    modelSelection:
      selection && typeof selection.providerId === 'string' && typeof selection.modelId === 'string'
        ? { providerId: selection.providerId, modelId: selection.modelId }
        : null,
    status: interrupted ? 'stopped' : states.includes(input.status) ? input.status : 'ready',
    statusMessage: interrupted
      ? ''
      : typeof input.statusMessage === 'string'
        ? input.statusMessage
        : '',
    error: interrupted
      ? 'Image generation was interrupted. You can try again.'
      : typeof input.error === 'string'
        ? input.error
        : '',
    images,
  };
}

export function imageIds(chats) {
  return [
    ...new Set(
      chats.flatMap((chat) =>
        chat.messages.flatMap(
          (message) => message.imageRequest?.images?.map((image) => image.id) || [],
        ),
      ),
    ),
  ];
}

export function conversationMessages(messages) {
  return messages
    .map((message) => {
      const image = message.imageRequest;
      const summary = image
        ? `[Image ${image.status === 'completed' ? 'generated' : 'request prepared'}: ${image.prompt || image.title}]`
        : '';
      return {
        role: message.role,
        content: [message.content, summary].filter(Boolean).join('\n\n'),
      };
    })
    .filter((message) => message.content.trim());
}

export function conversationMarkdown(chat) {
  return `# ${chat.title}\n\n${chat.messages
    .map((message) => {
      const image = message.imageRequest;
      const details = image
        ? `\n\n### Image request\n\n${image.prompt}\n\nCanvas: ${image.aspectRatio}. Status: ${image.status}.${image.images?.length ? `\n\nImage model: ${image.images[0].model || image.modelSelection?.modelId || 'Image model'}. Generated files are included in a full workspace backup.` : ''}`
        : '';
      return `## ${message.role === 'user' ? 'You' : message.model || 'Assistant'}\n\n${message.content}${details}`;
    })
    .join('\n\n')}`;
}
