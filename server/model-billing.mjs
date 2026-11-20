import { normalizePricing, tokenCost } from '../shared/model-pricing.js';

export function getPricing(provider, modelId) {
  const model = Array.isArray(provider.models)
    ? provider.models.find((item) => item?.id === modelId)
    : undefined;
  return normalizePricing(model?.pricing);
}

export function startModelCost(pricing, emit) {
  emit({ type: 'cost', amount: pricing?.perRequest ?? null });
  if (pricing?.mode !== 'tokens' || (pricing.input === undefined && pricing.output === undefined))
    return;
  return (counts) => {
    const amount = tokenCost(pricing, counts.input, counts.output);
    if (amount !== null) emit({ type: 'cost', amount, resolvesPending: true });
  };
}

export function tokenCounts(usage, type) {
  if (type === 'gemini')
    return {
      input: usage?.promptTokenCount,
      output:
        usage?.candidatesTokenCount == null && usage?.thoughtsTokenCount == null
          ? undefined
          : (usage.candidatesTokenCount ?? 0) + (usage.thoughtsTokenCount ?? 0),
    };
  if (type === 'anthropic')
    return {
      input:
        usage?.input_tokens == null
          ? undefined
          : usage.input_tokens +
            (usage.cache_creation_input_tokens ?? 0) +
            (usage.cache_read_input_tokens ?? 0),
      output: usage?.output_tokens,
    };
  return {
    input: usage?.input_tokens ?? usage?.prompt_tokens,
    output: usage?.output_tokens ?? usage?.completion_tokens,
  };
}
