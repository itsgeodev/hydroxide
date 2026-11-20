import { memo } from 'react';

// Offset rows form a lozenge. A diagonal pulse passes through the stationary lattice.
const dots = [3, 5, 7, 9, 7, 5, 3].flatMap((count, row) =>
  Array.from({ length: count }, (_, column) => {
    const x = (column - (count - 1) / 2) * 5.5;
    return { x: 32 + x, y: 14 + row * 6, delay: (x / 5.5 + row) * -0.105 };
  }),
);

export default memo(function Orb({ active }) {
  return (
    <svg
      className="thought-dots"
      data-active={active}
      viewBox="0 0 64 64"
      width="64"
      height="64"
      aria-hidden="true"
    >
      {dots.map(({ x, y, delay }) => (
        <circle key={x + ':' + y} cx={x} cy={y} r="1.9" style={{ animationDelay: delay + 's' }} />
      ))}
    </svg>
  );
});
