import { useEffect, useId, useRef, useState } from 'react';
import {
  ArrowClockwise,
  ArrowDown,
  ArrowsOut,
  CheckCircle,
  ImageSquare,
  Plus,
  Pause,
  Play,
  Sparkle,
  SpinnerGap,
  Stop,
  WarningCircle,
  X,
} from '@phosphor-icons/react';
import Orb from './Orb.jsx';
import { FlowField } from './WorkspaceEffects.jsx';
import ModelPicker from './ModelPicker.jsx';
import { inferModelKind } from '../../shared/model-capabilities.js';
import { downloadImage, getImage } from '../lib/media-store.js';
import '../image-effects.css';

const SHAPES = [
  { id: '1:1', name: 'Square', className: 'shape-square' },
  { id: '3:2', name: 'Landscape', className: 'shape-landscape' },
  { id: '2:3', name: 'Portrait', className: 'shape-portrait' },
];

function elapsedLabel(seconds) {
  return seconds < 60
    ? `${seconds}s`
    : `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

function ImageTile({ image, prompt, onOpen, onDownload, downloading, readImage }) {
  const [stored, setStored] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [missing, setMissing] = useState(false);
  const imageAspectRatio =
    image.aspectRatio === '3:2' ? '3 / 2' : image.aspectRatio === '2:3' ? '2 / 3' : '1 / 1';

  useEffect(() => {
    let current = true;
    setStored(null);
    setLoaded(false);
    setMissing(false);
    readImage(image.id)
      .then((value) => {
        if (!current) return;
        if (value?.dataUrl) setStored(value);
        else setMissing(true);
      })
      .catch(() => {
        if (current) setMissing(true);
      });
    return () => {
      current = false;
    };
  }, [image.id, readImage]);

  return (
    <figure className="image-result">
      <div
        className={`image-result-frame ${loaded ? 'is-loaded' : ''}`}
        style={{ '--image-aspect-ratio': imageAspectRatio }}
      >
        {missing ? (
          <div className="image-result-missing">
            <WarningCircle size={28} aria-hidden="true" />
            <strong>This image isn’t available on this device.</strong>
            <span>Restore a complete backup, or generate it again.</span>
          </div>
        ) : stored ? (
          <>
            {!loaded && (
              <div className="image-local-loading">
                <SpinnerGap size={23} aria-hidden="true" />
                <span>Opening your image…</span>
              </div>
            )}
            <button
              className="image-result-open"
              type="button"
              onClick={(event) =>
                onOpen({ ...image, dataUrl: stored.dataUrl }, event.currentTarget)
              }
              aria-label="View generated image full size"
              disabled={!loaded}
            >
              <img
                src={stored.dataUrl}
                alt={prompt || 'Generated image'}
                onLoad={() => setLoaded(true)}
                onError={() => setMissing(true)}
              />
              <span className="image-result-expand">
                <ArrowsOut size={16} aria-hidden="true" />
                View full size
              </span>
            </button>
          </>
        ) : (
          <div className="image-local-loading">
            <SpinnerGap size={23} aria-hidden="true" />
            <span>Opening your image…</span>
          </div>
        )}
      </div>
      <figcaption>
        <span>
          <CheckCircle size={14} aria-hidden="true" />
          {image.model || 'Generated image'}
        </span>
        <button
          type="button"
          disabled={!stored || missing || downloading}
          onClick={() => onDownload(image)}
        >
          {downloading ? (
            <SpinnerGap className="image-button-spinner" size={14} aria-hidden="true" />
          ) : (
            <ArrowDown size={14} aria-hidden="true" />
          )}
          {downloading ? 'Saving…' : 'Download'}
        </button>
      </figcaption>
      {image.revisedPrompt && image.revisedPrompt !== prompt && (
        <details className="image-revised-prompt">
          <summary>See the model’s refined prompt</summary>
          <p>{image.revisedPrompt}</p>
        </details>
      )}
    </figure>
  );
}

export default function ImageGenerationCard({
  request = {},
  providers = [],
  readImage = getImage,
  onChange,
  onGenerate,
  onStop,
  onSettings,
  disabled = false,
  effects = true,
  isChatStreaming = false,
}) {
  const titleId = useId();
  const promptId = useId();
  const [elapsed, setElapsed] = useState(0);
  const [lightbox, setLightbox] = useState(null);
  const [actionError, setActionError] = useState('');
  const [downloading, setDownloading] = useState('');
  const [effectsPaused, setEffectsPaused] = useState(false);
  const [validationError, setValidationError] = useState('');
  const previousStatus = useRef(request.status);
  const [justCompleted, setJustCompleted] = useState(false);
  const dialog = useRef(null);
  const lightboxTrigger = useRef(null);
  const promptInput = useRef(null);
  const card = useRef(null);
  const generating = request.status === 'generating';
  const images = Array.isArray(request.images) ? request.images : [];
  const prompt = request.prompt || '';
  const aspectRatio = SHAPES.some((shape) => shape.id === request.aspectRatio)
    ? request.aspectRatio
    : '1:1';
  const imageModels = providers
    .filter((provider) => provider.enabled !== false)
    .flatMap((provider) =>
      (provider.models || [])
        .filter((model) => model.enabled !== false && inferModelKind(model) === 'image')
        .map((model) => ({ ...model, provider })),
    );
  const selected = imageModels.find(
    (model) =>
      model.id === request.modelSelection?.modelId &&
      model.provider.id === request.modelSelection?.providerId,
  );
  const locked = generating || isChatStreaming;
  const canGenerate = !disabled && !locked;
  const footerNote = isChatStreaming
    ? 'Finishing the image request…'
    : generating
      ? 'You can keep chatting while this develops.'
      : selected
        ? null
        : 'Choose a model before you generate.';
  const statusLabel = generating
    ? 'Creating'
    : request.status === 'completed'
      ? 'Created'
      : request.status === 'stopped'
        ? 'Stopped'
        : request.status === 'error'
          ? 'Try again'
          : 'Image request';

  useEffect(() => {
    if (!generating) return;
    const started = Date.now();
    setElapsed(0);
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [generating]);

  useEffect(() => {
    const finished = previousStatus.current === 'generating' && request.status === 'completed';
    previousStatus.current = request.status;
    if (!finished || !effects || window.matchMedia('(prefers-reduced-motion: reduce)').matches)
      return;
    setJustCompleted(true);
    const timer = setTimeout(() => setJustCompleted(false), 900);
    return () => clearTimeout(timer);
  }, [request.status, effects]);

  useEffect(() => {
    if (!generating) return;
    const frame = requestAnimationFrame(() =>
      card.current?.scrollIntoView({
        block: 'start',
        behavior:
          !effects || window.matchMedia('(prefers-reduced-motion: reduce)').matches
            ? 'instant'
            : 'smooth',
      }),
    );
    return () => cancelAnimationFrame(frame);
  }, [generating, effects]);

  useEffect(() => {
    if (lightbox && dialog.current && !dialog.current.open) dialog.current.showModal();
  }, [lightbox]);

  useEffect(() => {
    if (prompt.trim() && selected) setValidationError('');
  }, [prompt, selected?.id]);

  async function saveImage(image) {
    setActionError('');
    setDownloading(image.id);
    const stem =
      (request.title || 'hydroxide-image')
        .replace(/[^a-z0-9-]+/gi, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 55) || 'hydroxide-image';
    const extension =
      { 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif', 'image/avif': 'avif' }[
        image.mimeType
      ] || 'png';
    try {
      const suffix = image.id.replace(/[^a-z0-9]/gi, '').slice(0, 8) || 'image';
      await downloadImage(image.id, `${stem}-${suffix}.${extension}`, readImage);
    } catch (error) {
      setActionError(error.message || 'The image could not be downloaded. Please try again.');
    } finally {
      setDownloading('');
    }
  }

  function closeLightbox() {
    dialog.current?.close();
  }

  return (
    <section
      ref={card}
      className={`image-generation-card ${generating ? 'image-card-generating' : ''} ${justCompleted ? 'image-card-completed' : ''} ${!effects ? 'image-effects-off' : effectsPaused ? 'image-effects-paused' : ''}`}
      aria-labelledby={titleId}
    >
      <header className="image-card-heading">
        <span className="image-card-mark" aria-hidden="true">
          <ImageSquare size={21} weight="duotone" aria-hidden="true" />
        </span>
        <div>
          <h3 id={titleId}>{request.title || 'Image studio'}</h3>
        </div>
        <span className={`image-card-badge ${generating ? 'is-active' : ''}`}>
          {statusLabel}
        </span>
      </header>
      <span className="visually-hidden" role="status">
        {generating
          ? 'Image generation started.'
          : request.status === 'completed'
            ? 'Your generated image is ready.'
            : request.status === 'stopped'
              ? 'Image generation stopped.'
              : ''}
      </span>

      {generating || !images.length ? (
        <div className={`image-generation-stage${generating ? ' flow-active' : ''}`}>
          <FlowField active={generating && effects && !effectsPaused} />
          <div className="image-stage-meta" aria-hidden="true">
            <span>{generating ? 'Generating image' : 'Image studio'}</span>
            <span>{aspectRatio}</span>
          </div>
          <div className="image-stage-copy">
            <Orb active={generating && effects && !effectsPaused} />
            {generating ? (
              <span>{selected?.name || selected?.id}</span>
            ) : (
              <span>Enter a prompt and choose an image model.</span>
            )}
          </div>
          <div className="image-live-status">
            <span role="status" aria-live="polite">
              {generating ? request.statusMessage || 'Generating image…' : ''}
            </span>
            {generating && (
              <>
                {effects && (
                  <button
                    type="button"
                    className="image-effects-toggle"
                    onClick={() => setEffectsPaused((value) => !value)}
                    aria-pressed={effectsPaused}
                  >
                    {effectsPaused ? (
                      <Play size={13} aria-hidden="true" />
                    ) : (
                      <Pause size={13} aria-hidden="true" />
                    )}
                    {effectsPaused ? 'Resume effects' : 'Pause effects'}
                  </button>
                )}
                <time aria-label={`Elapsed ${elapsedLabel(elapsed)}`}>{elapsedLabel(elapsed)}</time>
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="image-results">
          {images.map((image) => (
            <ImageTile
              readImage={readImage}
              key={image.id}
              image={image}
              prompt={image.prompt || image.revisedPrompt || prompt}
              onOpen={(image, trigger) => {
                lightboxTrigger.current = trigger;
                setLightbox(image);
              }}
              onDownload={saveImage}
              downloading={downloading === image.id}
            />
          ))}
        </div>
      )}

      <div className="image-card-controls">
        <label className="image-prompt-label" htmlFor={promptId}>
          Prompt<span>{generating ? 'Rendering in progress' : 'Describe the image you want'}</span>
        </label>
        <textarea
          id={promptId}
          ref={promptInput}
          className="image-prompt"
          value={prompt}
          onChange={(event) => onChange({ prompt: event.target.value })}
          rows={3}
          maxLength={12000}
          placeholder="Describe what you’d like to create…"
          disabled={locked || disabled}
          aria-invalid={validationError && !prompt.trim() ? true : undefined}
          aria-describedby={validationError ? `${promptId}-error` : undefined}
        />
        <div className="image-shape-row">
          <span>Canvas</span>
          <div className="image-shape-options" role="group" aria-label="Image shape">
            {SHAPES.map((shape) => (
              <button
                key={shape.id}
                type="button"
                className={aspectRatio === shape.id ? 'selected' : ''}
                aria-pressed={aspectRatio === shape.id}
                disabled={locked || disabled}
                onClick={() => onChange({ aspectRatio: shape.id })}
              >
                <i className={shape.className} aria-hidden="true" />
                {shape.name}
              </button>
            ))}
          </div>
        </div>
        <div className="image-model-row">
          <span>Image model</span>
          <ModelPicker
            providers={providers}
            selected={request.modelSelection}
            onSelect={(modelSelection) => onChange({ modelSelection })}
            onSettings={onSettings}
            disabled={locked || disabled}
            kind="image"
            placeholder="Choose an image model"
            label="Image model"
          />
        </div>
        {!imageModels.length && (
          <div className="image-setup-note">
            <span>Connect a provider with an image model.</span>
            <button type="button" onClick={onSettings}>
              <Plus size={14} aria-hidden="true" />
              Set up a model
            </button>
          </div>
        )}
        {request.error && (
          <div className="image-generation-error" role="alert">
            <WarningCircle size={17} aria-hidden="true" />
            <span>{request.error}</span>
          </div>
        )}
        <div
          className="image-generation-error image-action-error"
          role="alert"
          id={`${promptId}-error`}
        >
          {(actionError || validationError) && (
            <>
              <WarningCircle size={17} aria-hidden="true" />
              <span>{actionError || validationError}</span>
            </>
          )}
        </div>
        {request.status === 'stopped' && (
          <p className="image-stopped-note" role="status">
            Generation stopped. Adjust the prompt or try again when you’re ready.
          </p>
        )}
        <footer className="image-card-footer">
          {footerNote && <span>{footerNote}</span>}
          {generating ? onStop && (
            <button
              className="image-generate-button image-cancel-button"
              type="button"
              onClick={onStop}
            >
              <Stop size={14} weight="fill" aria-hidden="true" />
              Stop generation
            </button>
          ) : (
            <button
              className="image-generate-button"
              type="button"
              disabled={!canGenerate}
              onClick={() => {
                setActionError('');
                if (!prompt.trim()) {
                  setValidationError('Describe the image you want to create.');
                  promptInput.current?.focus();
                  return;
                }
                if (!selected) {
                  setValidationError(
                    'Choose an image model before generating. Connect a provider if none are available.',
                  );
                  card.current?.querySelector('.model-trigger')?.focus();
                  return;
                }
                setValidationError('');
                onGenerate();
              }}
            >
              {images.length || request.status === 'error' || request.status === 'stopped' ? (
                <ArrowClockwise size={16} aria-hidden="true" />
              ) : (
                <Sparkle size={16} weight="duotone" aria-hidden="true" />
              )}
              {images.length
                ? 'Generate again'
                : request.status === 'error'
                  ? 'Try again'
                  : 'Generate image'}
            </button>
          )}
        </footer>
      </div>

      {lightbox && (
        <dialog
          ref={dialog}
          className={`image-fullscreen-dialog ${!effects ? 'image-effects-off' : ''}`}
          aria-label="Generated image full size"
          onCancel={(event) => {
            event.preventDefault();
            closeLightbox();
          }}
          onClose={() => {
            setLightbox(null);
            lightboxTrigger.current?.focus();
          }}
          onClick={(event) => {
            if (event.target === event.currentTarget) closeLightbox();
          }}
        >
          <div className="image-fullscreen-shell">
            <header>
              <span>
                <ImageSquare size={17} aria-hidden="true" />
                {request.title || 'Your generated image'}
              </span>
              <div>
                <button
                  type="button"
                  onClick={() => saveImage(lightbox)}
                  disabled={Boolean(downloading)}
                  aria-label="Download full size image"
                >
                  <ArrowDown size={18} aria-hidden="true" />
                </button>
                <button type="button" onClick={closeLightbox} aria-label="Close full size image">
                  <X size={20} aria-hidden="true" />
                </button>
              </div>
            </header>
            <img
              src={lightbox.dataUrl}
              alt={lightbox.prompt || lightbox.revisedPrompt || prompt || 'Generated image'}
            />
            {actionError && (
              <div className="image-generation-error" role="alert">
                <WarningCircle size={17} aria-hidden="true" />
                <span>{actionError}</span>
              </div>
            )}
            <p>{lightbox.prompt || lightbox.revisedPrompt || prompt}</p>
          </div>
        </dialog>
      )}
    </section>
  );
}
