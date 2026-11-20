import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { ArrowClockwise, Check, Copy, CaretRight } from '@phosphor-icons/react';
import { ModelIcon } from '../lib/providers.jsx';
import { getReasoningStatus } from '../lib/reasoning.js';
import Orb from './Orb.jsx';
import Sources from './Sources.jsx';
import '../conversation-polish.css';

const Markdown = lazy(() => import('./Markdown.jsx'));

export default function Message({
  message,
  animate = false,
  onArrived,
  effects = true,
  streaming,
  status,
  onRetry,
  isLast,
  onToast,
  children,
}) {
  const [copied, setCopied] = useState(false);
  const [copyStatus, setCopyStatus] = useState('');
  const [arriving, setArriving] = useState(animate);
  const [completed, setCompleted] = useState(false);
  const wasStreaming = useRef(streaming);
  const arrivedCallback = useRef(onArrived);
  const copyTimer = useRef(null);
  const phase = streaming
    ? message.content
      ? 'receiving'
      : 'thinking'
    : completed
      ? 'settling'
      : message.error || message.interrupted
        ? 'interrupted'
        : 'settled';
  useEffect(() => () => clearTimeout(copyTimer.current), []);
  useEffect(() => {
    if (!arriving) return;
    const timer = setTimeout(() => {
      setArriving(false);
      arrivedCallback.current?.();
    }, 280);
    return () => {
      clearTimeout(timer);
      arrivedCallback.current?.();
    };
  }, [arriving]);
  useEffect(() => {
    const finished = wasStreaming.current && !streaming;
    wasStreaming.current = streaming;
    if (!effects) {
      setCompleted(false);
      return;
    }
    if (!finished || message.error || message.interrupted || !message.content) return;
    setCompleted(true);
    const timer = setTimeout(() => setCompleted(false), 1800);
    return () => clearTimeout(timer);
  }, [streaming, message.error, message.interrupted, message.content, effects]);
  const [hasVisibleText, setHasVisibleText] = useState(false);
  const [readyToDock, setReadyToDock] = useState(false);
  useEffect(() => {
    if (!hasVisibleText) return;
    const timer = setTimeout(() => setReadyToDock(true), effects ? 220 : 0);
    return () => clearTimeout(timer);
  }, [hasVisibleText, effects]);
  const [showDots, setShowDots] = useState(Boolean(streaming && !message.imageRequest));
  const finishing = showDots && hasVisibleText && !message.error && !message.interrupted;
  const waiting = (streaming || finishing) && !readyToDock && !message.imageRequest;
  useEffect(() => {
    if (waiting) {
      setShowDots(true);
      return;
    }
    if (!showDots) return;
    const timer = setTimeout(() => setShowDots(false), effects ? 540 : 0);
    return () => clearTimeout(timer);
  }, [waiting, showDots, effects]);
  if (message.role === 'user')
    return (
      <article
        className={`message user-message ${arriving && effects ? 'is-arriving' : ''}`}
        aria-label="Your message"
      >
        <div className="user-message-content" dir="auto">
          {message.content}
        </div>
        <span className="user-avatar">You</span>
      </article>
    );
  const reasoningStatus = getReasoningStatus(message.reasoning, streaming);
  const thinkingLabel =
    status && status !== 'Thinking…' ? status : reasoningStatus || 'Thinking…';
  return (
    <article
      className={`message assistant-message ${waiting ? 'is-waiting' : showDots ? 'is-docking' : ''} ${streaming ? 'is-streaming' : ''} ${arriving && effects ? 'is-arriving' : ''} phase-${phase}`}
      data-phase={phase}
      aria-label={`Response from ${message.model || 'Assistant'}`}
    >
      <div className="assistant-avatar" aria-hidden="true">
        <span className="avatar-mark"><ModelIcon icon={message.icon || 'hydroxide'} size={21} /></span>
        {(waiting || showDots) && (
          <span className="traveling-dots"><Orb active={effects} /></span>
        )}
      </div>
      <div className="assistant-body">
        <div className="message-heading">
          <strong>
            <bdi>{message.model || 'Assistant'}</bdi>
          </strong>
          {streaming && !waiting && (
            <span className="generating-label">
              {status || 'Generating'}
            </span>
          )}
          {completed && effects && (
            <span className="response-ready" aria-hidden="true">
              <Check size={12} weight="bold" /> Ready
            </span>
          )}
        </div>
        {(waiting || showDots) && (
          <div className="thinking-space">
            <div>
              <div className="thinking-stage">
                {waiting && !hasVisibleText && <bdi>{thinkingLabel}</bdi>}
              </div>
            </div>
          </div>
        )}
        {reasoningStatus === null && (
          <details className="reasoning">
            <summary>
              <CaretRight size={13} aria-hidden="true" /> Thinking
            </summary>
            <p dir="auto">{message.reasoning}</p>
          </details>
        )}
        <div className="markdown" dir="auto">
          <Suspense fallback={<p>{message.content}</p>}>
            <Markdown streaming={streaming} animateWords={effects} onVisibleText={setHasVisibleText}>{message.content}</Markdown>
          </Suspense>
        </div>
        {children}
        <Sources sources={message.sources} />
        {message.error && (
          <div className="message-error" role="alert">
            {message.error}
            {isLast && !message.imageRequest && (
              <button onClick={onRetry}>
                <ArrowClockwise size={14} aria-hidden="true" />
                Try again
              </button>
            )}
          </div>
        )}
        {message.interrupted && <p className="interrupted-note">Generation stopped.</p>}
        {!streaming && message.content && (
          <div className="message-actions">
            <button
              title="Copy response"
              className={copied ? 'is-copied' : ''}
              aria-label={copied ? 'Response copied' : 'Copy response'}
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(message.content);
                  setCopied(true);
                  setCopyStatus('Response copied to clipboard.');
                  clearTimeout(copyTimer.current);
                  copyTimer.current = setTimeout(() => {
                    setCopied(false);
                    setCopyStatus('');
                  }, 2000);
                } catch {
                  const error =
                    'Clipboard unavailable. Select the response text and copy it manually.';
                  setCopyStatus(error);
                  onToast?.(error);
                }
              }}
            >
              {copied ? (
                <Check size={15} aria-hidden="true" />
              ) : (
                <Copy size={15} aria-hidden="true" />
              )}
            </button>
            {isLast && !message.imageRequest && (
              <button
                title="Regenerate response"
                aria-label="Regenerate response"
                onClick={onRetry}
              >
                <ArrowClockwise size={15} aria-hidden="true" />
              </button>
            )}
          </div>
        )}
        <span className="visually-hidden" role="status">
          {copyStatus}
        </span>
      </div>
    </article>
  );
}
