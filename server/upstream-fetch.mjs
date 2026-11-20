const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

export async function fetchWithoutRedirects(fetchImpl, url, options) {
  // Reject redirects to keep credentials on the configured origin.
  const response = await fetchImpl(url, { ...options, redirect: 'manual' });
  if (REDIRECT_STATUSES.has(response.status)) {
    await response.body?.cancel().catch(() => {});
    throw new Error(`The upstream returned an HTTP ${response.status} redirect. Use an endpoint that responds directly.`);
  }
  return response;
}
