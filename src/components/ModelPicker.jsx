import { useId, useRef, useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import {
  CaretDown,
  Check,
  MagnifyingGlass,
  Plus,
  SlidersHorizontal,
  Cube,
  Image as ImageIcon,
  FilmStrip,
} from '@phosphor-icons/react';
import { ModelIcon } from '../lib/providers.jsx';
import { touchLayout } from '#workspace-edition';
import { enabledModels } from '../../shared/model-capabilities.js';

const useTouchLayout = touchLayout?.useLayout ?? (() => false);
const ModelSheet = touchLayout?.ModelSheet;

export default function ModelPicker({
  providers,
  selected,
  onSelect,
  onSettings,
  disabled,
  kind = 'chat',
  placeholder,
  label,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const mobile = useTouchLayout();
  const headingId = useId();
  const optionsId = useId();
  const searchInput = useRef(null);
  const optionList = useRef(null);
  const changeOpen = (next) => {
    setOpen(next);
    if (!next) setQuery('');
  };
  const all = enabledModels(providers, kind);
  const EmptyIcon = kind === 'image' ? ImageIcon : kind === 'video' ? FilmStrip : Cube;
  const emptyLabel =
    placeholder ||
    (kind === 'image'
      ? 'Choose an image model'
      : kind === 'video'
        ? 'Choose a video model'
        : 'Choose your model');
  const pickerLabel =
    label || (kind === 'image' ? 'Image model' : kind === 'video' ? 'Video model' : 'Choose model');
  const current = all.find(
    (m) => m.id === selected?.modelId && m.provider.id === selected?.providerId,
  );
  const filtered = all.filter((m) =>
    `${m.name} ${m.id} ${m.provider.name}`.toLowerCase().includes(query.toLowerCase()),
  );
  const moveOptionFocus = (event) => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    const options = [...(optionList.current?.querySelectorAll('.model-option') || [])];
    if (!options.length) return;
    event.preventDefault();
    const index = options.indexOf(document.activeElement);
    const next =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? options.length - 1
          : (index + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length;
    options[next].focus();
  };
  const triggerProps = {
    className: `model-trigger ${!current ? 'no-model' : ''}`,
    disabled,
    'aria-label': current ? `${current.name || current.id}, ${pickerLabel}` : emptyLabel,
    title: current ? `${current.name || current.id} (${current.provider.name})` : emptyLabel,
  };
  const triggerContent = (
    <>
      {current ? (
        <ModelIcon icon={current.icon || current.provider.icon} size={21} />
      ) : (
        <EmptyIcon size={20} aria-hidden="true" />
      )}
      <span>{current ? current.name || current.id : emptyLabel}</span>
      <CaretDown size={13} aria-hidden="true" />
    </>
  );
  const content = (closeControl = null) => (
    <>
      <div className="popover-heading">
        <span id={headingId}>
          {kind === 'image'
            ? 'Image models'
            : kind === 'video'
              ? 'Video models'
              : kind === 'other'
                ? 'Other models'
                : 'Your chat models'}
        </span>
        <div className="model-picker-actions">
          <button
            type="button"
            className="icon-button"
            onClick={() => {
              changeOpen(false);
              onSettings();
            }}
            aria-label="Manage providers"
          >
            <SlidersHorizontal size={18} aria-hidden="true" />
          </button>
          {closeControl}
        </div>
      </div>
      <label className="model-search">
        <MagnifyingGlass size={17} aria-hidden="true" />
        <input
          ref={searchInput}
          placeholder="Find a model…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Find a model"
          aria-controls={optionsId}
          name="model-search"
          autoComplete="off"
          spellCheck={false}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown' && filtered.length) {
              event.preventDefault();
              optionList.current?.querySelector('.model-option')?.focus();
            }
          }}
        />
      </label>
      <span className="visually-hidden" role="status">
        {open
          ? `${filtered.length} ${filtered.length === 1 ? 'model' : 'models'} available${query ? ` matching ${query}` : ''}.`
          : ''}
      </span>
      <div className="model-options" id={optionsId} ref={optionList} onKeyDown={moveOptionFocus}>
        {!all.length && (
          <div className="models-empty">
            <EmptyIcon size={28} aria-hidden="true" />
            <strong>
              {kind === 'image'
                ? 'No image models enabled yet.'
                : kind === 'chat'
                  ? 'Connect your first model'
                  : `No ${kind} models enabled yet.`}
            </strong>
            <p>
              {kind === 'image'
                ? 'Connect an image provider, or set a model’s type to Image in Settings.'
                : 'Connect a provider and enable models of this type in Settings.'}
            </p>
          </div>
        )}
        {all.length > 0 && !filtered.length && (
          <p className="empty-note">No models match “{query}”.</p>
        )}
        {filtered.map((m) => (
          <button
            type="button"
            key={`${m.provider.id}:${m.id}`}
            className={`model-option ${selected?.modelId === m.id && selected?.providerId === m.provider.id ? 'selected' : ''}`}
            aria-pressed={selected?.modelId === m.id && selected?.providerId === m.provider.id}
            title={`${m.name || m.id} (${m.provider.name})`}
            onClick={() => {
              onSelect({ providerId: m.provider.id, modelId: m.id });
              changeOpen(false);
            }}
          >
            <span className="model-option-icon">
              <ModelIcon icon={m.icon || m.provider.icon} size={23} />
            </span>
            <span>
              <strong>{m.name || m.id}</strong>
              <small>{m.provider.name}</small>
            </span>
            {selected?.modelId === m.id && selected?.providerId === m.provider.id && (
              <Check size={17} className="check-icon" aria-hidden="true" />
            )}
          </button>
        ))}
      </div>
      <button
        type="button"
        className="popover-footer"
        onClick={() => {
          changeOpen(false);
          onSettings();
        }}
      >
        <Plus size={17} aria-hidden="true" /> Connect a provider <span>{all.length} enabled</span>
      </button>
    </>
  );
  if (mobile) {
    return (
      <ModelSheet
        open={open}
        onOpenChange={changeOpen}
        headingId={headingId}
        triggerProps={triggerProps}
        triggerContent={triggerContent}
      >
        {content}
      </ModelSheet>
    );
  }
  return (
    <Popover.Root open={open} onOpenChange={changeOpen}>
      <Popover.Trigger {...triggerProps}>{triggerContent}</Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className="model-popover"
          sideOffset={12}
          align="start"
          collisionPadding={14}
          aria-labelledby={headingId}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            searchInput.current?.focus();
          }}
        >
          {content()}
          <Popover.Arrow className="popover-arrow" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
