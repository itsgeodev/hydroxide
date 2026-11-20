const dollars = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 6,
});

function CostAmount({ label, amount = 0, priced = 0, unpriced = 0 }) {
  const display =
    !priced && unpriced
      ? '—'
      : amount > 0 && amount < 0.000001
        ? `<${dollars.format(0.000001)}`
        : dollars.format(amount);
  const detail = unpriced
    ? 'Some requests are missing prices or usage.'
    : 'Estimated cost using configured rates.';
  return (
    <div className="chat-cost" title={`${label} · ${detail}`}>
      <dt>{label}</dt>
      <dd aria-label={`${display}. ${detail}`}>
        {display}
        {priced > 0 && unpriced > 0 ? '+' : ''}
      </dd>
    </div>
  );
}

export default function ChatCosts({ costs = [], provider }) {
  const current = costs.find((entry) => entry.providerId === provider?.id);
  const total = costs.reduce(
    (sum, entry) => ({
      amount: sum.amount + entry.amount,
      priced: sum.priced + entry.priced,
      unpriced: sum.unpriced + entry.unpriced,
    }),
    { amount: 0, priced: 0, unpriced: 0 },
  );
  return (
    <dl className="chat-costs" aria-label="Tracked conversation cost in US dollars">
      {provider && <CostAmount label={provider.name || 'Provider'} {...current} />}
      <CostAmount label="Total" {...total} />
    </dl>
  );
}
