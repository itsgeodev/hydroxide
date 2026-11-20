import { PRICING_FIELDS } from '../../shared/model-pricing.js';

const rateLabels = {
  perRequest: 'USD per request',
  input: 'Input USD per 1M tokens',
  output: 'Output USD per 1M tokens',
};

export default function ModelPricing({ model, onChange }) {
  const pricing = model.pricing;
  return (
    <div className="model-pricing-fields" role="group" aria-label={`Pricing for ${model.id}`}>
      <label className="settings-field">
        <span>Billing</span>
        <select
          value={pricing?.mode || ''}
          onChange={(event) =>
            onChange(event.target.value ? { mode: event.target.value } : undefined)
          }
        >
          <option value="">Unconfigured</option>
          <option value="request">Flat rate per request</option>
          <option value="tokens">Input / output tokens</option>
        </select>
      </label>
      {pricing &&
        PRICING_FIELDS[pricing.mode].map((field) => (
          <label className="settings-field" key={field}>
            <span>{rateLabels[field]}</span>
            <input
              type="number"
              min="0"
              step="any"
              placeholder="Unset"
              value={pricing[field] ?? ''}
              onChange={(event) => {
                const { value, valueAsNumber, validity } = event.currentTarget;
                if (
                  validity.badInput ||
                  (value && (!Number.isFinite(valueAsNumber) || valueAsNumber < 0))
                )
                  return;
                onChange({ ...pricing, [field]: value ? valueAsNumber : undefined });
              }}
            />
          </label>
        ))}
    </div>
  );
}
