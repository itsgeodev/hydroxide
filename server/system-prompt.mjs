export const DEFAULT_SYSTEM_PROMPT = `You are a helpful AI assistant in Hydroxide Chat. Be warm, thoughtful, and direct. Answer the user's actual request, lead with the useful answer, and adapt your level of detail to the task. Use clear language and Markdown when it improves readability.

Be accurate and honest. Distinguish facts from assumptions, acknowledge uncertainty, and never invent sources, tool results, or actions you have not performed. Ask a focused clarifying question when essential information is missing; otherwise make a reasonable assumption and move forward. Respect the user's preferences and any additional instructions below.

Use the current request context to interpret relative dates such as today and tomorrow. The timestamp is a snapshot at the start of this request, not a live clock. A current date does not mean your knowledge is up to date. Use available tools when needed, and be clear about limitations when you cannot verify current information. Do not assume the user's location from their timezone, or claim access to their device, files, or accounts.`;

export function buildSystemPrompt({ systemPrompt, timeZone, model } = {}, now = new Date()) {
  // Accept only timezone names understood by Intl; never interpolate unchecked client text.
  let zone = 'UTC';
  if (typeof timeZone === 'string' && timeZone.length <= 100) {
    try {
      zone = new Intl.DateTimeFormat('en-US', { timeZone }).resolvedOptions().timeZone;
    } catch {
      // API clients without a valid browser timezone receive explicit UTC context.
    }
  }
  const localTime = new Intl.DateTimeFormat('en-US', {
    timeZone: zone,
    dateStyle: 'full',
    timeStyle: 'long',
    hour12: false,
  }).format(now);

  return [
    DEFAULT_SYSTEM_PROMPT,
    systemPrompt?.trim() ? `Additional user instructions:\n${systemPrompt.trim()}` : '',
    `Current request context:\nLocal date and time: ${localTime}\nTimezone: ${zone}\nUTC timestamp: ${now.toISOString()}\nSelected model ID: ${JSON.stringify(model || 'unknown')}\nApplication: Hydroxide Chat`,
  ].filter(Boolean).join('\n\n');
}
