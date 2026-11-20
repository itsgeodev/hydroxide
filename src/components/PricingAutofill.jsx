import { useEffect, useId, useRef, useState } from 'react';
import { SpinnerGap } from '@phosphor-icons/react';
import { enabledModels } from '../../shared/model-capabilities.js';
import {
  AUTOFILL_BATCH_SIZE,
  AUTOFILL_SOURCE_LIMIT,
  needsModelAutofill,
} from '../../shared/model-pricing.js';

export default function PricingAutofill({ provider, providers, onApply, cloud, connectionFetch = fetch }) {
  const [selection, setSelection] = useState('');
  const [source, setSource] = useState('');
  const [override, setOverride] = useState(false);
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const controller = useRef(null);
  const sourceId = useId();
  const agents = enabledModels(providers).filter((model) => model.provider.baseUrl?.trim());
  const agentKey = (model) => JSON.stringify([model.provider.id, model.id]);
  const agent = agents.find((model) => agentKey(model) === selection);
  const sourceTooLong = source.length > AUTOFILL_SOURCE_LIMIT;

  useEffect(() => () => controller.current?.abort(), []);

  async function run(event) {
    event.preventDefault();
    if (!agent || !source.trim() || sourceTooLong || controller.current) return;
    const models = provider.models.filter((model) => override || needsModelAutofill(model));
    setError('');
    if (!models.length) {
      setStatus('All model types and rates are already set.');
      return;
    }
    const request = new AbortController();
    controller.current = request;
    setRunning(true);
    let updated = 0;
    try {
      for (let start = 0; start < models.length; start += AUTOFILL_BATCH_SIZE) {
        const batch = models.slice(start, start + AUTOFILL_BATCH_SIZE);
        setStatus(`Checking models ${start + 1}–${start + batch.length} of ${models.length}…`);
        const response = await connectionFetch('/api/models/autofill', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: request.signal,
          body: JSON.stringify({
            ...(cloud ? { providerId: agent.provider.id } : { provider: {
              ...agent.provider,
              models: agent.provider.models.filter((model) => model.id === agent.id),
            } }),
            model: agent.id,
            source: source.trim(),
            models: batch.map(({ id, name }) => ({ id, name })),
          }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Could not run model autofill.');
        if (request.signal.aborted) return;
        updated += onApply(provider.id, data.models, override);
      }
      setStatus(
        updated
          ? `Updated ${updated} ${updated === 1 ? 'model' : 'models'}.`
          : 'No new model types or rates matched the pasted source.',
      );
    } catch (failure) {
      if (request.signal.aborted) return;
      setStatus(updated ? `Updated ${updated} ${updated === 1 ? 'model' : 'models'}.` : '');
      setError(failure.message || 'Could not run model autofill.');
    } finally {
      controller.current = null;
      if (!request.signal.aborted) setRunning(false);
    }
  }

  return (
    <form className="pricing-autofill" onSubmit={run}>
      <label className="settings-field">
        <span>Autofill model</span>
        <select
          value={agent ? selection : ''}
          onChange={(event) => setSelection(event.target.value)}
          required
          disabled={running || !agents.length}
        >
          <option value="">
            {agents.length ? 'Choose a chat model' : 'Enable a chat model first'}
          </option>
          {agents.map((model) => (
            <option key={agentKey(model)} value={agentKey(model)}>
              {model.provider.name} · {model.name || model.id}
            </option>
          ))}
        </select>
      </label>
      <div className="settings-field">
        <label htmlFor={sourceId}>Provider pricing source</label>
        <textarea
          id={sourceId}
          value={source}
          onChange={(event) => setSource(event.target.value)}
          placeholder="Paste JSON or copy text from the provider’s pricing page"
          rows={5}
          required
          disabled={running}
          aria-invalid={sourceTooLong || undefined}
          aria-describedby={`${sourceId}-help${sourceTooLong ? ` ${sourceId}-limit` : ''}`}
        />
        <small id={`${sourceId}-help`}>
          The selected chat model receives the pasted source and this provider’s model names and
          IDs.
        </small>
        {sourceTooLong && (
          <small className="settings-field-error" id={`${sourceId}-limit`}>
            Paste up to {AUTOFILL_SOURCE_LIMIT.toLocaleString()} characters at a time.
          </small>
        )}
      </div>
      <div className="pricing-autofill-actions">
        <label className="provider-select-all">
          <input
            type="checkbox"
            checked={override}
            onChange={(event) => setOverride(event.target.checked)}
            disabled={running}
          />
          <span>Override Existing</span>
        </label>
        <button
          type="submit"
          className="settings-button settings-button-primary"
          disabled={running || !agent || !source.trim() || sourceTooLong}
        >
          {running && <SpinnerGap className="settings-spinner" size={17} />}
          {running ? 'Autofilling…' : 'Autofill types and pricing'}
        </button>
      </div>
      <p className={status ? 'pricing-autofill-status' : 'visually-hidden'} role="status">
        {status}
      </p>
      {error && (
        <div className="settings-message error" role="alert">
          {error}
        </div>
      )}
    </form>
  );
}
