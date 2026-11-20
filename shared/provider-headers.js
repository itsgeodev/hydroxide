const HEADER_NAME = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;
const INVALID_VALUE = /[^\t\x20-\x7e\x80-\xff]/;

// Preserve editable drafts in storage; only active request headers require HTTP validation.
export function normalizeCustomHeaders(input) {
  if (input == null) return [];
  if (!Array.isArray(input) || input.length > 50)
    throw new Error('Custom headers must be a list of at most 50 name/value pairs.');
  const ids = new Set();
  return input.map((header, index) => {
    if (
      !header ||
      typeof header !== 'object' ||
      typeof header.name !== 'string' ||
      typeof header.value !== 'string'
    )
      throw new Error(`Custom header ${index + 1} must have a text name and value.`);
    if (header.name.length > 256 || header.value.length > 8192)
      throw new Error(`Custom header ${index + 1} is too long.`);
    const id =
      typeof header.id === 'string' && header.id && !ids.has(header.id)
        ? header.id
        : crypto.randomUUID();
    ids.add(id);
    return {
      id,
      name: header.name,
      value: header.value,
      enabled: header.enabled !== false,
    };
  });
}

export function activeCustomHeaders(input) {
  return normalizeCustomHeaders(input).flatMap((header, index) => {
    if (!header.enabled || (!header.name.trim() && !header.value.trim())) return [];
    const name = header.name.trim();
    if (!HEADER_NAME.test(name))
      throw new Error(`Custom header ${index + 1} needs a valid HTTP header name.`);
    if (INVALID_VALUE.test(header.value))
      throw new Error(`Custom header ${index + 1} contains an invalid HTTP header value.`);
    return [{ name, value: header.value }];
  });
}

export function providerSecrets(provider) {
  const values = [provider?.apiKey];
  if (Array.isArray(provider?.customHeaders))
    for (const header of provider.customHeaders) values.push(header?.value);
  return [
    ...new Set(
      values
        .filter((value) => typeof value === 'string' && value.trim())
        .flatMap((value) => [value, value.trim()]),
    ),
  ];
}
