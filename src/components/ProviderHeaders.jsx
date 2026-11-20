import { useId, useState } from 'react';
import { Eye, EyeSlash, Plus, X } from '@phosphor-icons/react';

function HeaderRow({ header, index, onChange, onRemove }) {
  const [visible, setVisible] = useState(false);
  const rowId = useId();
  return (
    <div className={`provider-header-row ${header.enabled === false ? 'disabled' : ''}`}>
      <input
        type="checkbox"
        checked={header.enabled !== false}
        onChange={(event) => onChange({ ...header, enabled: event.target.checked })}
        aria-label={`Enable header ${index + 1}`}
      />
      <label className="settings-field">
        <span>Name</span>
        <input
          value={header.name}
          onChange={(event) => onChange({ ...header, name: event.target.value })}
          placeholder="X-Custom-Header"
          aria-label={`Header name ${index + 1}`}
          autoComplete="off"
          spellCheck={false}
          maxLength={256}
        />
      </label>
      <div className="settings-field">
        <label htmlFor={rowId}>Value</label>
        <div className="settings-secret">
          <input
            id={rowId}
            type={visible ? 'text' : 'password'}
            value={header.value}
            onChange={(event) => onChange({ ...header, value: event.target.value })}
            placeholder="Header value"
            aria-label={`Header value ${index + 1}`}
            autoComplete="off"
            spellCheck={false}
            maxLength={8192}
          />
          <button
            type="button"
            onClick={() => setVisible((value) => !value)}
            aria-label={`${visible ? 'Hide' : 'Show'} header value ${index + 1}`}
          >
            {visible ? <EyeSlash size={16} /> : <Eye size={16} />}
          </button>
        </div>
      </div>
      <button
        type="button"
        className="provider-model-remove"
        onClick={onRemove}
        aria-label={`Remove header ${index + 1}`}
        title="Remove header"
      >
        <X size={15} />
      </button>
    </div>
  );
}

export default function ProviderHeaders({ headers = [], onChange }) {
  const titleId = useId();
  return (
    <section className="provider-headers-section" aria-labelledby={titleId}>
      <div className="settings-section-title">
        <div>
          <h3 id={titleId}>Custom headers</h3>
          <p>
            Sent with model discovery, chat, and automatic titles. Matching names override default
            headers.
          </p>
        </div>
        <button
          type="button"
          className="settings-button settings-button-secondary"
          onClick={() =>
            onChange([...headers, { id: crypto.randomUUID(), name: '', value: '', enabled: true }])
          }
          disabled={headers.length >= 50}
        >
          <Plus size={16} />
          Add header
        </button>
      </div>
      {headers.length ? (
        <div className="provider-header-list">
          {headers.map((header, index) => (
            <HeaderRow
              key={header.id || index}
              header={header}
              index={index}
              onChange={(next) => onChange(headers.map((entry, i) => (i === index ? next : entry)))}
              onRemove={() => onChange(headers.filter((_, i) => i !== index))}
            />
          ))}
        </div>
      ) : (
        <p className="provider-headers-empty">
          Add headers for your gateway, authentication, or provider-specific options.
        </p>
      )}
    </section>
  );
}
