const TAU = Math.PI * 2;

// Each glider has a place in a loose V and banks on its own rhythm.
function makeGliders(count) {
  return Array.from({ length: count }, (_, i) => {
    const rank = Math.floor(i / 3);
    const side = rank % 2 ? -1 : 1;
    return {
      flock: i % 3,
      lag: rank * 0.018 + 0.012 * Math.sin(i * 4.2),
      spread: side * rank * 0.009 + 0.022 * Math.cos(i * 5.1),
      phase: i * 2.4,
      size: 0.68 + 0.32 * Math.sin(i * 3.7 + 1),
      lead: rank === 0,
      wake: rank % 4 === 0 ? [] : null,
      lastX: null,
      lastY: null,
      dx: 0,
      dy: 0,
    };
  });
}

function paintWake(ctx, points, x, y, ink, lead) {
  points.push([x, y]);
  if (points.length > (lead ? 68 : 26)) points.shift();
  ctx.lineCap = 'round';
  ctx.strokeStyle = ink;
  for (let i = 1; i < points.length; i++) {
    const strength = i / points.length;
    ctx.globalAlpha = (lead ? 0.74 : 0.38) * strength;
    ctx.lineWidth = (0.5 + 1.3 * strength) * (lead ? 1 : 0.65);
    ctx.beginPath();
    ctx.moveTo(...points[i - 1]);
    ctx.lineTo(...points[i]);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function paintGlider(ctx, bank, ink, underside, paper) {
  // A long leading point, a raised fold and two swept-back wing tips.
  ctx.fillStyle = underside;
  ctx.beginPath();
  ctx.moveTo(1.35, 0);
  ctx.lineTo(-1.08, 0.82 * bank);
  ctx.lineTo(-0.54, 0.04);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = ink;
  ctx.beginPath();
  ctx.moveTo(1.35, 0);
  ctx.lineTo(-0.54, 0.04);
  ctx.lineTo(-1.45, -0.92 * bank);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = paper;
  ctx.globalAlpha = 0.68;
  ctx.beginPath();
  ctx.moveTo(1.35, 0);
  ctx.lineTo(-0.54, 0.04);
  ctx.lineTo(-0.79, 0.26 * bank);
  ctx.closePath();
  ctx.fill();
}

export function createPaperFlight(canvas) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const stage = canvas.closest('.image-generation-stage, .main-workspace');
  const pointer = { x: -1000, y: -1000 };
  let width = 0,
    height = 0,
    clock = 0,
    previous = 0,
    frame = 0;
  let gliders = [],
    palette = [];
  let running = false;

  function draw(dt) {
    ctx.clearRect(0, 0, width, height);
    const scale = Math.min(1, width / 780);
    for (const glider of gliders) {
      const group = glider.flock;
      const direction = group === 1 ? -1 : 1;
      const cycle = clock / 16 + group / 3 + 0.23 - glider.lag;
      const progress = cycle - Math.floor(cycle);
      const u = progress * 1.36 - 0.18;
      const x = (direction > 0 ? u : 1 - u) * width;
      const angle = TAU * (u * 0.85 + group * 0.31) + 0.28 * Math.sin(clock * 0.29);
      const amplitude = 0.13 + group * 0.02;
      const y =
        height * (0.46 + 0.09 * group + amplitude * Math.sin(angle) + glider.spread) +
        7 * Math.sin(clock * 0.9 + glider.phase);
      const turn = Math.max(0, Math.min(1, (u - (0.04 + group * 0.2)) / 0.34));
      const arc = TAU * turn * turn * (3 - 2 * turn);
      const radius = Math.min(width * 0.078, height * 0.108);
      const pathX = x + direction * radius * Math.sin(arc);
      const pathY = y + radius * (Math.cos(arc) - 1) * (group === 1 ? -1 : 1);
      const vx = pathX - pointer.x,
        vy = pathY - pointer.y;
      const distance = Math.hypot(vx, vy);
      const push = Math.max(0, 1 - distance / 135) ** 2 * 75;
      const follow = 1 - Math.exp(-dt * 6);
      glider.dx += ((push * vx) / Math.max(1, distance) - glider.dx) * follow;
      glider.dy += ((push * vy) / Math.max(1, distance) - glider.dy) * follow;

      const size = (glider.lead ? 14 : 3.5 + 6 * glider.size) * (0.72 + 0.28 * scale);
      const px = pathX + glider.dx,
        py = pathY + glider.dy;
      const wrapped = glider.lastX === null || Math.abs(px - glider.lastX) > width * 0.5;
      if (wrapped && glider.wake) glider.wake.length = 0;
      const heading =
        wrapped || !dt
          ? Math.atan2(height * amplitude * TAU * 0.85 * Math.cos(angle), direction * width)
          : Math.atan2(py - glider.lastY, px - glider.lastX);
      glider.lastX = px;
      glider.lastY = py;
      const bank = 0.76 + 0.35 * Math.sin(clock * 2 + glider.phase) - 0.64 * Math.sin(arc / 2);
      ctx.save();
      if (glider.wake && dt) paintWake(ctx, glider.wake, px, py, palette[group], glider.lead);
      ctx.translate(px, py);
      ctx.rotate(heading);
      ctx.scale(size, size);
      paintGlider(ctx, bank, palette[group], palette[(group + 1) % 3], palette[3]);
      ctx.restore();
    }
  }

  function resize() {
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    gliders = makeGliders(Math.min(39, Math.max(15, Math.round(width / 34))));
    draw(0);
  }
  function colors() {
    const style = getComputedStyle(canvas);
    palette = ['--magic-cyan', '--magic-blue', '--magic-violet', '--text'].map((key) =>
      style.getPropertyValue(key).trim(),
    );
    draw(0);
  }
  function tick(now) {
    const elapsed = (now - previous) / 1000;
    if (elapsed >= 1 / 31) {
      const dt = Math.min(elapsed, 0.08);
      previous = now;
      clock += dt;
      draw(dt);
    }
    frame = requestAnimationFrame(tick);
  }
  function move(event) {
    if (event.pointerType === 'touch') return;
    const bounds = canvas.getBoundingClientRect();
    pointer.x = event.clientX - bounds.left;
    pointer.y = event.clientY - bounds.top;
  }
  function leave() {
    pointer.x = pointer.y = -1000;
  }
  colors();
  resize();
  const bounds = new ResizeObserver(resize);
  bounds.observe(canvas);
  const theme = new MutationObserver(colors);
  theme.observe(document.documentElement, { attributes: true, attributeFilter: ['style'] });
  stage?.addEventListener('pointermove', move, { passive: true });
  stage?.addEventListener('pointerleave', leave);
  return {
    play(active) {
      if (running === active) return;
      running = active;
      cancelAnimationFrame(frame);
      if (active) {
        previous = performance.now();
        frame = requestAnimationFrame(tick);
      }
    },
    dispose() {
      cancelAnimationFrame(frame);
      bounds.disconnect();
      theme.disconnect();
      stage?.removeEventListener('pointermove', move);
      stage?.removeEventListener('pointerleave', leave);
    },
  };
}
