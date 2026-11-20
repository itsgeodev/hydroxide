import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { Check, Copy } from '@phosphor-icons/react';
import rehypeStreamingWords, { rehypeStreamingCursor } from '../lib/streaming-markdown.js';

function CodeBlock({ children }) {
  const [copied, setCopied] = useState(false);
  const [copyStatus, setCopyStatus] = useState('');
  const [overflowing, setOverflowing] = useState(false);
  const code = useRef(null);
  const timer = useRef(null);
  const language = /language-([\w+-]+)/.exec(children?.props?.className || '')?.[1];
  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => {
    const element = code.current;
    const update = () => setOverflowing(element.scrollWidth > element.clientWidth + 1);
    const observer = new ResizeObserver(update);
    observer.observe(element);
    update();
    return () => observer.disconnect();
  }, [children]);
  return (
    <div className="code-block">
      <div className="code-toolbar">
        <span className="code-language">
          {language || 'Code'}
          {overflowing && <span className="code-scroll-hint">Scroll for more</span>}
        </span>
        <button
          type="button"
          onClick={async () => {
            try {
              const text = code.current.textContent;
              await navigator.clipboard.writeText(text);
              setCopied(true);
              setCopyStatus('Code copied to clipboard.');
              clearTimeout(timer.current);
              timer.current = setTimeout(() => {
                setCopied(false);
                setCopyStatus('');
              }, 2000);
            } catch {
              setCopied(false);
              setCopyStatus('Clipboard unavailable. Select the code and copy it manually.');
            }
          }}
        >
          {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}{' '}
          {copied ? 'Copied' : 'Copy code'}
        </button>
      </div>
      <pre
        ref={code}
        tabIndex={0}
        aria-label={`${language || 'Code'} block, scroll horizontally to read long lines`}
      >
        {children}
      </pre>
      <span
        className={copyStatus.startsWith('Clipboard') ? 'code-copy-error' : 'visually-hidden'}
        role="status"
      >
        {copyStatus}
      </span>
    </div>
  );
}

function ScrollableTable({ children }) {
  const container = useRef(null);
  const [overflowing, setOverflowing] = useState(false);
  useEffect(() => {
    const element = container.current;
    const update = () => setOverflowing(element.scrollWidth > element.clientWidth + 1);
    const observer = new ResizeObserver(update);
    observer.observe(element);
    update();
    return () => observer.disconnect();
  }, [children]);
  return (
    <div className="markdown-table-container">
      {overflowing && <p className="table-scroll-hint">Scroll horizontally to see all columns.</p>}
      <div
        ref={container}
        className="markdown-table-scroll"
        role="region"
        aria-label="Table, scroll horizontally for more columns"
        tabIndex={0}
      >
        <table>{children}</table>
      </div>
    </div>
  );
}

const components = {
  pre: CodeBlock,
  a: ({ children, href }) => (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
      <span className="visually-hidden"> (opens in a new tab)</span>
    </a>
  ),
  table: ScrollableTable,
  img: ({ alt, ...props }) => <img {...props} alt={alt || ''} loading="lazy" />,
};
const staticPlugins = [rehypeHighlight];
const streamingPlugins = [rehypeHighlight, rehypeStreamingWords, rehypeStreamingCursor];
const cursorPlugins = [rehypeHighlight, rehypeStreamingCursor];

export default function Markdown({ children, streaming = false, animateWords, onVisibleText }) {
  const body = useRef(null);
  useEffect(() => {
    if (streaming && body.current?.querySelector('.stream-tip')) onVisibleText?.(true);
  }, [children, streaming, onVisibleText]);
  return (
    <div ref={body}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={
          streaming ? (animateWords ? streamingPlugins : cursorPlugins) : staticPlugins
        }
        components={components}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
