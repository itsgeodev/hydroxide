import { useId, useRef, useState } from 'react';
import { Eye, EyeSlash, Plus } from '@phosphor-icons/react';
import { API_FORMATS } from '../lib/provider-formats.js';
import ProviderHeaders from './ProviderHeaders.jsx';

export default function CustomProviderForm({ onCreate, onCancel, cloud }) {
  const formId = useId();
  const [name, setName] = useState('');
  const [type, setType] = useState('openai');
  const [baseUrl, setBaseUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [customHeaders, setCustomHeaders] = useState([]);
  const [showKey, setShowKey] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState('');
  const nameInput = useRef(null);
  const urlInput = useRef(null);

  async function submit(event) {
    event.preventDefault();
    if (!name.trim()) {
      setNameError('Enter a provider name.');
      nameInput.current?.focus();
      return;
    }
    let url;
    try {
      url = new URL(baseUrl.trim());
      if (
        !(cloud ? ['https:'] : ['https:', 'http:']).includes(url.protocol) ||
        url.username ||
        url.password ||
        url.search ||
        url.hash
      )
        throw new Error();
    } catch {
      setError(
        `Enter an ${cloud ? 'HTTPS' : 'HTTP or HTTPS'} base URL without embedded credentials, query parameters, or fragments.`,
      );
      urlInput.current?.focus();
      return;
    }
    setSaving(true);
    try {
      await onCreate({
        name: name.trim(),
        type,
        baseUrl: url.href.replace(/\/+$/, ''),
        apiKey: apiKey.trim(),
        customHeaders,
        icon: 'hydroxide',
      });
    } catch (failure) {
      setError(failure.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="custom-provider-form" onSubmit={submit} aria-labelledby={`${formId}-title`}>
      <div className="settings-section-title">
        <div>
          <h3 id={`${formId}-title`}>Connect a custom provider</h3>
          <p>{cloud ? 'Connect a service with a public HTTPS endpoint.' : 'Connect a compatible service or local server.'}</p>
        </div>
      </div>
      <fieldset className="custom-provider-formats">
        <legend>API format</legend>
        <div>
          {API_FORMATS.map((format) => (
            <label
              key={format.id}
              className={`custom-format-option ${type === format.id ? 'selected' : ''}`}
            >
              <input
                type="radio"
                name={`${formId}-format`}
                value={format.id}
                checked={type === format.id}
                onChange={() => setType(format.id)}
              />
              <strong>{format.name}</strong>
              <span>{format.description}</span>
              <code>{format.endpoint}</code>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="settings-form-grid">
        <label className="settings-field settings-field-wide">
          <span>Provider name</span>
          <input
            ref={nameInput}
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              setNameError('');
            }}
            placeholder="My AI gateway"
            autoFocus
            required
            maxLength={100}
            aria-invalid={nameError ? true : undefined}
            aria-describedby={nameError ? `${formId}-name-error` : undefined}
          />
          {nameError && (
            <small className="settings-field-error" id={`${formId}-name-error`}>
              {nameError}
            </small>
          )}
        </label>
        <label className="settings-field settings-field-wide">
          <span>Base URL</span>
          <input
            ref={urlInput}
            type="url"
            value={baseUrl}
            onChange={(event) => {
              setBaseUrl(event.target.value);
              setError('');
            }}
            placeholder="https://your-provider.example/v1"
            autoComplete="off"
            spellCheck={false}
            required
            aria-invalid={error ? true : undefined}
            aria-describedby={`${formId}-url-hint${error ? ` ${formId}-url-error` : ''}`}
          />
          <small id={`${formId}-url-hint`}>
            Use your provider’s API base URL, including any version or gateway path.
          </small>
          {error && (
            <small className="settings-field-error" id={`${formId}-url-error`}>
              {error}
            </small>
          )}
        </label>
        <div className="settings-field settings-field-wide">
          <label htmlFor={`${formId}-key`}>API key</label>
          <div className="settings-secret">
            <input
              id={`${formId}-key`}
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder="Enter your API key"
              autoComplete="off"
              spellCheck={false}
            />
            <button
              type="button"
              aria-label={`${showKey ? 'Hide' : 'Show'} custom provider API key`}
              onClick={() => setShowKey((value) => !value)}
            >
              {showKey ? <EyeSlash size={18} /> : <Eye size={18} />}
            </button>
          </div>
          <small>
            {cloud ? 'Optional if your provider uses custom header authentication.' : 'Optional for local servers or custom header authentication.'}
          </small>
        </div>
      </div>
      <ProviderHeaders headers={customHeaders} onChange={setCustomHeaders} />
      <div className="custom-provider-actions">
        <button
          type="button"
          className="settings-button settings-button-secondary"
          onClick={onCancel}
        >
          Cancel
        </button>
        <button type="submit" className="settings-button settings-button-primary" disabled={saving}>
          <Plus size={16} />
          {saving ? 'Saving…' : 'Create provider'}
        </button>
      </div>
      <p className="settings-muted-note">
        Next, import models or add model IDs manually. All settings, including the API format,
        remain editable.
      </p>
    </form>
  );
}
