const isAmount = (value) => Number.isFinite(value) && value >= 0;
const isCount = (value) => Number.isSafeInteger(value) && value >= 0;

export const PRICING_FIELDS = {
  request: ['perRequest'],
  tokens: ['input', 'output'],
};
export const AUTOFILL_BATCH_SIZE = 48;
export const AUTOFILL_SOURCE_LIMIT = 120_000;

export function normalizePricing(value) {
  if (value?.mode !== 'request' && value?.mode !== 'tokens') return undefined;
  const pricing = { mode: value.mode };
  for (const field of PRICING_FIELDS[value.mode]) {
    if (isAmount(value[field])) pricing[field] = value[field];
  }
  return pricing;
}

const modelKinds = new Set(['chat', 'image', 'video', 'other']);

export function needsModelAutofill(model) {
  return (
    !modelKinds.has(model.kind) ||
    !model.pricing ||
    PRICING_FIELDS[model.pricing.mode].some((field) => model.pricing[field] === undefined)
  );
}

export function applyModelAutofill(model, suggestion, override) {
  const kind =
    modelKinds.has(suggestion?.kind) && (override || !modelKinds.has(model.kind))
      ? suggestion.kind
      : model.kind;
  const current = model.pricing;
  const incoming = normalizePricing(suggestion?.pricing);
  let pricing = current;
  if (incoming && PRICING_FIELDS[incoming.mode].some((field) => incoming[field] !== undefined)) {
    if (!current || (override && current.mode !== incoming.mode)) {
      pricing = incoming;
    } else if (current.mode === incoming.mode) {
      for (const field of PRICING_FIELDS[incoming.mode]) {
        if (
          incoming[field] !== undefined &&
          incoming[field] !== current[field] &&
          (override || current[field] === undefined)
        )
          pricing = { ...pricing, [field]: incoming[field] };
      }
    }
  }
  return kind === model.kind && pricing === current ? model : { ...model, kind, pricing };
}

export function tokenCost(pricing, input, output) {
  if (!isCount(input) || !isCount(output)) return null;
  if ((!isAmount(pricing.input) && input) || (!isAmount(pricing.output) && output)) return null;
  const amount =
    (input / 1_000_000) * (pricing.input ?? 0) + (output / 1_000_000) * (pricing.output ?? 0);
  return isAmount(amount) ? amount : null;
}

export function normalizeChatCosts(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  return value
    .filter((entry) => {
      if (
        typeof entry?.providerId !== 'string' ||
        !entry.providerId.trim() ||
        seen.has(entry.providerId) ||
        !isAmount(entry.amount) ||
        !isCount(entry.priced) ||
        !isCount(entry.unpriced)
      )
        return false;
      seen.add(entry.providerId);
      return true;
    })
    .map(({ providerId, amount, priced, unpriced }) => ({ providerId, amount, priced, unpriced }));
}

export function recordChatCost(costs, providerId, event) {
  const known = isAmount(event.amount);
  if (!known && (event.amount !== null || event.resolvesPending)) return costs;
  const index = costs.findIndex((entry) => entry.providerId === providerId);
  const previous = costs[index] || { providerId, amount: 0, priced: 0, unpriced: 0 };
  const entry = known
    ? {
        ...previous,
        amount: previous.amount + event.amount,
        priced: previous.priced + 1,
        unpriced: Math.max(0, previous.unpriced - (event.resolvesPending ? 1 : 0)),
      }
    : { ...previous, unpriced: previous.unpriced + 1 };
  return index < 0 ? [...costs, entry] : costs.with(index, entry);
}
