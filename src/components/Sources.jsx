import { useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowUpRight, Books, CaretRight, X } from '@phosphor-icons/react';

function SourceLink({ source, index, expanded = false }) {
  return (
    <a href={source.url} target="_blank" rel="noopener noreferrer" title={source.title}>
      <span className="source-number">{index + 1}</span>
      <span className="source-details">
        <span>{source.title || source.url}</span>
        {expanded && source.title && <span className="source-url">{source.url}</span>}
      </span>
      <ArrowUpRight size={14} aria-hidden="true" />
      <span className="visually-hidden">Opens in a new tab</span>
    </a>
  );
}

export default function Sources({ sources = [] }) {
  const dialog = useRef(null);
  const trigger = useRef(null);
  const id = useId();
  const [open, setOpen] = useState(false);
  if (!sources?.length) return null;

  if (sources.length <= 5) {
    return (
      <div className="sources">
        <span className="sources-label">Sources</span>
        <div>
          {sources.map((source, index) => (
            <SourceLink key={`${source.url}-${index}`} source={source} index={index} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        ref={trigger}
        className="sources-trigger"
        aria-haspopup="dialog"
        aria-controls={id}
        aria-expanded={open}
        onClick={() => {
          dialog.current.showModal();
          setOpen(true);
        }}
      >
        <Books size={16} aria-hidden="true" />
        Sources <span>{sources.length}</span>
        <CaretRight size={13} aria-hidden="true" />
      </button>
      {createPortal(
        <dialog
          ref={dialog}
          id={id}
          className="sources-sidebar"
          aria-labelledby={`${id}-title`}
          onClose={() => {
            setOpen(false);
            trigger.current?.focus();
          }}
          onClick={(event) => {
            if (event.target === event.currentTarget) dialog.current.close();
          }}
        >
          <div className="sources-sidebar-shell">
            <header>
              <div>
                <h2 id={`${id}-title`}>Sources</h2>
                <span>{sources.length} sources for this answer</span>
              </div>
              <button
                type="button"
                aria-label="Close sources"
                onClick={() => dialog.current.close()}
              >
                <X size={20} aria-hidden="true" />
              </button>
            </header>
            <ol className="sources-sidebar-list">
              {sources.map((source, index) => (
                <li key={`${source.url}-${index}`}>
                  <SourceLink source={source} index={index} expanded />
                </li>
              ))}
            </ol>
          </div>
        </dialog>,
        document.body,
      )}
    </>
  );
}
