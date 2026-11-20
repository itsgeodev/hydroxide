import { memo, useEffect, useRef, useState } from 'react';
import { createPaperFlight } from '../lib/paper-flight.js';
import { touchLayout } from '#workspace-edition';

export function useVisualEffects(enabled = true) {
  const [reduced, setReduced] = useState(
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
  const [visible, setVisible] = useState(() => !document.hidden);
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updateMotion = () => setReduced(media.matches);
    const updateVisibility = () => setVisible(!document.hidden);
    media.addEventListener('change', updateMotion);
    document.addEventListener('visibilitychange', updateVisibility);
    return () => {
      media.removeEventListener('change', updateMotion);
      document.removeEventListener('visibilitychange', updateVisibility);
    };
  }, []);
  return enabled && !reduced && visible;
}

export const FlowField = memo(function FlowField({ active }) {
  const canvas = useRef(null);
  const flight = useRef(null);
  const playing = useVisualEffects(active);
  useEffect(() => {
    flight.current = createPaperFlight(canvas.current);
    return () => flight.current?.dispose();
  }, []);
  useEffect(() => flight.current?.play(playing), [playing]);
  return <canvas ref={canvas} className="flow-field" aria-hidden="true" />;
});

// The event stays delegated: no per-button listeners or React renders on a press.
export function playInteraction(event, enabled) {
  if (!enabled || event.button !== 0) return;
  const button = event.target.closest('button, [role="menuitem"], [role="option"]');
  if (!button || button.disabled || button.getAttribute('aria-disabled') === 'true') return;
  if (touchLayout?.playPress(button)) return;
  const rect = button.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height);
  const ripple = document.createElement('span');
  ripple.className = 'interaction-ripple';
  ripple.setAttribute('aria-hidden', 'true');
  Object.assign(ripple.style, {
    width: `${size}px`,
    height: `${size}px`,
    left: `${event.clientX - size / 2}px`,
    top: `${event.clientY - size / 2}px`,
  });
  (button.closest('dialog[open]') || event.currentTarget).appendChild(ripple);
  const animation = ripple.animate(
    [
      { opacity: 0.3, transform: 'scale(0.95)' },
      { opacity: 0, transform: 'scale(1.65)' },
    ],
    {
      duration: 280,
      easing: getComputedStyle(event.currentTarget).getPropertyValue('--ease-out').trim(),
    },
  );
  animation.onfinish = animation.oncancel = () => ripple.remove();
}
