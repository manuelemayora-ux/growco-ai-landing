/* 03 · POR QUÉ (#por-que) — crowd dot-field "Le hablamos solo a quien sí compra" (reference RwIntro, ref-motion §3.12).
 *
 * Entrance: motion.js reveals the section group (eyebrow 0 ms, words 80 + 55 ms·i with the green box +500 ms,
 * panel 200 ms / 30 px, sub 420, button 520, facts 600) — all declared in the fragment.
 *
 * Canvas (one, inside .wy-field), driven by the shared rAF loop (GC.onFrame), only while the panel is near the viewport:
 *   - N dots (1,200 desktop · 900 tablet ≤1099 · 600 phone ≤809), seeded in small groups, idle jitter (±1.4 px sine).
 *   - N/SHARE (1 in 8) are "buyers", split .34/.40/.26 into Búsqueda / Feeds / Audiencias. Sort progress
 *     G = clamp((e − .27)/.4), e = (vh − top)/(vh + h) of the canvas, lerped .12 per frame.
 *   - buyers travel on curved paths (delay 0–.42, window .58) into phyllotaxis discs (golden angle), turning green and
 *     growing ×1.6; the rest dim (.62 → .22) and are pushed away from the nearest cluster (≤ 12 % of min(w, h)).
 *   - halos (green ring + 6 % fill) once G > .55; labels fade with --p (CSS); the status line follows the sort
 *     ("Toda la multitud" → "Detectando señales de compra" → "Compradores identificados").
 *   - rev1 (client): no visible counts / ratio — the old "1 de 12" read as "few clients"; the share of buyer dots is
 *     only a drawing density, never shown.
 *   - fine pointer: dots within 70 px are pushed ≤ 16 px and brighten (lerp .14).
 * Reduced motion: final frame, no jitter, no pointer. No canvas / no JS: static CSS fallback (panel without .is-live).
 */
const sec = document.getElementById('por-que');
if (!sec) return;
const panel = sec.querySelector('.wy-panel');
const cv = panel && panel.querySelector('.wy-cv');
const ctx = cv && cv.getContext ? cv.getContext('2d') : null;
if (!panel || !cv || !ctx) return; // CSS fallback stays visible

const GC = window.GC || {};
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const FINE = matchMedia('(hover: hover) and (pointer: fine)').matches;
const MQ_PH = matchMedia('(max-width: 809px)');
const MQ_TAB = matchMedia('(max-width: 1099px)');
const TAU = Math.PI * 2;
const GOLD = 2.39996;
const WHITE = '255,255,255';
const GREEN = '181,244,127';
const SHARE = 8;                // drawing density of the green "buyer" dots (never displayed)
const SPLIT = [0.34, 0.4, 0.26];
const NAMES = 'Búsqueda, Feeds y Audiencias';
// cluster centres per tier — keep in sync with the --x/--y of .wy-lab / .wy-halo in home-03-por-que.css
const TIERS = {
  desktop: { n: 1200, k: 0.019, c: [[0.42, 0.52], [0.63, 0.38], [0.84, 0.58]] },
  tablet: { n: 900, k: 0.019, c: [[0.36, 0.52], [0.6, 0.4], [0.84, 0.56]] },
  phone: { n: 600, k: 0.021, c: [[0.22, 0.2], [0.22, 0.5], [0.22, 0.8]] },
};

const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
const io3 = t => { t = clamp(t); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
const tierName = () => (MQ_PH.matches ? 'phone' : MQ_TAB.matches ? 'tablet' : 'desktop');

const statusEl = panel.querySelector('[data-wy-status]');
const STATUS = ['Toda la multitud', 'Detectando señales de compra', 'Compradores identificados'];

/* ---------------------------------------------------------------- crowd state */
let T = null, tier = '', N = 0;
let X, Y, R, PH, CL, DL, SL, CU, OX, OY, HL;
let counts = [0, 0, 0];
function build() {
  tier = tierName();
  T = TIERS[tier];
  N = T.n;
  let s = (0x9e3779b1 ^ (N * 2654435761)) >>> 0 || 1; // xorshift32, deterministic per tier
  const rnd = () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  X = new Float32Array(N); Y = new Float32Array(N); R = new Float32Array(N); PH = new Float32Array(N);
  CL = new Int8Array(N).fill(-1); DL = new Float32Array(N); SL = new Float32Array(N); CU = new Float32Array(N);
  OX = new Float32Array(N); OY = new Float32Array(N); HL = new Float32Array(N);
  // people arrive alone or in small groups of 2–4
  for (let i = 0; i < N;) {
    const gx = rnd(), gy = rnd();
    const k = rnd() < 0.3 ? 2 + Math.floor(rnd() * 3) : 1;
    for (let j = 0; j < k && i < N; j++, i++) {
      X[i] = clamp(gx + (j ? (rnd() - 0.5) * 0.018 : 0), 0.01, 0.99);
      Y[i] = clamp(gy + (j ? (rnd() - 0.5) * 0.03 : 0), 0.02, 0.98);
      R[i] = 1.25 + rnd() * 0.6;
      PH[i] = rnd() * TAU;
    }
  }
  // N/SHARE buyers, split .34 / .40 / .26
  const B = Math.round(N / SHARE);
  counts = [Math.round(B * SPLIT[0]), Math.round(B * SPLIT[1])];
  counts.push(B - counts[0] - counts[1]);
  const idx = Array.from({ length: N }, (_, i) => i);
  for (let i = N - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const t = idx[i]; idx[i] = idx[j]; idx[j] = t; }
  let p = 0;
  counts.forEach((c, ci) => {
    for (let q = 0; q < c; q++, p++) {
      const i = idx[p];
      CL[i] = ci; SL[i] = q; DL[i] = rnd() * 0.42; CU[i] = (rnd() - 0.5) * 0.5;
    }
  });
  cv.setAttribute('aria-label', `Una multitud se ordena sola: las personas con intención de compra se separan y se agrupan en ${NAMES}.`);
  lastTxt = '';
}

/* ---------------------------------------------------------------- canvas size */
let w = 1, h = 1, dpr = 1, dirty = true;
function size() {
  const r = cv.getBoundingClientRect();
  dpr = Math.min(2, window.devicePixelRatio || 1);
  w = Math.max(1, r.width); h = Math.max(1, r.height);
  const bw = Math.round(w * dpr), bh = Math.round(h * dpr);
  if (cv.width !== bw) cv.width = bw;
  if (cv.height !== bh) cv.height = bh;
  dirty = true;
}

/* ---------------------------------------------------------------- draw */
let G = RM ? 1 : 0;
const lit = [];
function draw(ms, still) {
  const t = ms / 1000;
  const j = still ? 0 : 1;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  const m = Math.min(w, h);
  const a = m * T.k + 2.2;                       // disc spacing
  const cx = T.c.map(c => c[0] * w), cy = T.c.map(c => c[1] * h);
  const g = io3(G);
  const base = 0.62 - 0.4 * g;
  const reach = m * 0.55, pushMax = m * 0.12 * g;
  // the crowd (one path)
  lit.length = 0;
  ctx.fillStyle = `rgba(${WHITE},${base.toFixed(3)})`;
  ctx.beginPath();
  for (let i = 0; i < N; i++) {
    if (CL[i] >= 0) continue;
    let x = X[i] * w + Math.sin(t * 0.6 + PH[i]) * 1.4 * j;
    let y = Y[i] * h + Math.cos(t * 0.5 + PH[i] * 1.3) * 1.2 * j;
    if (pushMax > 0) {
      let kk = 0, dm = 1e12;
      for (let c = 0; c < 3; c++) { const d = (x - cx[c]) ** 2 + (y - cy[c]) ** 2; if (d < dm) { dm = d; kk = c; } }
      const d = Math.sqrt(dm) || 1;
      const push = Math.max(0, 1 - d / reach) * pushMax;
      x += ((x - cx[kk]) / d) * push; y += ((y - cy[kk]) / d) * push;
    }
    x += OX[i]; y += OY[i];
    if (HL[i] > 0.05) { lit.push(i, x, y); continue; }
    ctx.moveTo(x + R[i], y);
    ctx.arc(x, y, R[i], 0, TAU);
  }
  ctx.fill();
  for (let q = 0; q < lit.length; q += 3) {
    const i = lit[q];
    ctx.fillStyle = `rgba(${WHITE},${Math.min(1, base + HL[i] * 0.7).toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(lit[q + 1], lit[q + 2], R[i] * (1 + HL[i] * 0.6), 0, TAU);
    ctx.fill();
  }
  // halos
  const hp = io3((G - 0.55) / 0.45);
  if (hp > 0) {
    ctx.lineWidth = 1;
    for (let c = 0; c < 3; c++) {
      const r = a * Math.sqrt(counts[c]) * 0.5 + 14;
      ctx.strokeStyle = `rgba(${GREEN},${(0.55 * hp).toFixed(3)})`;
      ctx.fillStyle = `rgba(${GREEN},${(0.06 * hp).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(cx[c], cy[c], r + (1 - hp) * 30, 0, TAU);
      ctx.stroke();
      ctx.fill();
    }
  }
  // buyers travel on a curved path into a phyllotaxis disc
  for (let i = 0; i < N; i++) {
    const c = CL[i];
    if (c < 0) continue;
    const x = io3((G - DL[i]) / 0.58);
    const sx = X[i] * w + Math.sin(t * 0.6 + PH[i]) * 1.4 * j * (1 - x);
    const sy = Y[i] * h + Math.cos(t * 0.5 + PH[i] * 1.3) * 1.2 * j * (1 - x);
    const ang = SL[i] * GOLD, rad = a * 0.5 * Math.sqrt(SL[i] + 0.5);
    const tx = cx[c] + Math.cos(ang) * rad + Math.sin(t * 1.3 + PH[i]) * 0.6 * j;
    const ty = cy[c] + Math.sin(ang) * rad + Math.cos(t * 1.1 + PH[i]) * 0.6 * j;
    const dx = tx - sx, dy = ty - sy, bend = Math.sin(x * Math.PI) * CU[i];
    const px = sx + dx * x - dy * bend + OX[i];
    const py = sy + dy * x + dx * bend + OY[i];
    const rr = R[i] * (1 + 0.6 * x) * (1 + HL[i] * 0.5);
    if (x < 0.999) {
      ctx.fillStyle = `rgba(${WHITE},${(0.62 * (1 - x)).toFixed(3)})`;
      ctx.beginPath(); ctx.arc(px, py, rr, 0, TAU); ctx.fill();
    }
    if (x > 0.001) {
      if (HL[i] > 0.05 || (x > 0.05 && x < 0.95)) {
        ctx.fillStyle = `rgba(${GREEN},${(0.18 * x).toFixed(3)})`;
        ctx.beginPath(); ctx.arc(px, py, rr * 2.6, 0, TAU); ctx.fill();
      }
      ctx.fillStyle = `rgba(${GREEN},${x.toFixed(3)})`;
      ctx.beginPath(); ctx.arc(px, py, rr, 0, TAU); ctx.fill();
    }
  }
}

/* ---------------------------------------------------------------- status line + label progress */
let lastTxt = '', lastP = -1;
function texts() {
  const txt = STATUS[G < 0.3 ? 0 : G < 0.75 ? 1 : 2];
  if (txt !== lastTxt) {
    lastTxt = txt;
    if (statusEl) statusEl.textContent = txt;
  }
  const p = Math.round(G * 1000) / 1000;
  if (p !== lastP) { lastP = p; panel.style.setProperty('--p', p.toFixed(3)); }
}

/* ---------------------------------------------------------------- start */
build();
size();
panel.classList.add('is-live');
texts();
const onTier = () => { if (tierName() !== tier) { build(); size(); texts(); if (RM || !GC.onFrame) draw(0, true); } };
MQ_PH.addEventListener ? MQ_PH.addEventListener('change', onTier) : MQ_PH.addListener(onTier);
MQ_TAB.addEventListener ? MQ_TAB.addEventListener('change', onTier) : MQ_TAB.addListener(onTier);

if (RM || !GC.onFrame) {
  // final frame only (reduced motion, or the shared loop is missing)
  G = 1;
  const still = () => { size(); draw(0, true); texts(); };
  still();
  if ('ResizeObserver' in window) new ResizeObserver(still).observe(cv);
  else addEventListener('resize', still, { passive: true });
  return;
}

if ('ResizeObserver' in window) new ResizeObserver(() => { size(); GC.wake && GC.wake(); }).observe(cv);
else addEventListener('resize', size, { passive: true });

/* pointer: repel + brighten (fine pointers only) */
let mx = -9999, my = -9999, pointer = false, settling = 0;
if (FINE) {
  cv.addEventListener('pointermove', e => {
    const r = cv.getBoundingClientRect();
    mx = e.clientX - r.left; my = e.clientY - r.top; pointer = true;
  }, { passive: true });
  cv.addEventListener('pointerleave', () => { pointer = false; mx = my = -9999; settling = 90; GC.wake && GC.wake(); }, { passive: true });
}
function repel() {
  const free = G <= 0.5; // buyers stop reacting once they are on their way
  for (let i = 0; i < N; i++) {
    let tx = 0, ty = 0, tl = 0;
    if (pointer && (CL[i] < 0 || free)) {
      const dx = X[i] * w - mx, dy = Y[i] * h - my, d2 = dx * dx + dy * dy;
      if (d2 < 4900) { const d = Math.sqrt(d2) || 1, f = 1 - d / 70; tx = (dx / d) * f * 16; ty = (dy / d) * f * 16; tl = f; }
    }
    if (Math.abs(tx - OX[i]) + Math.abs(ty - OY[i]) + Math.abs(tl - HL[i]) > 0.01) {
      OX[i] += (tx - OX[i]) * 0.14; OY[i] += (ty - OY[i]) * 0.14;
      HL[i] += (tl - HL[i]) * (tl > HL[i] ? 0.3 : 0.05);
    }
  }
}

let top = 0, ch = 1, vh = innerHeight;
GC.onFrame({
  read() { const r = cv.getBoundingClientRect(); top = r.top; ch = r.height; vh = innerHeight || 1; },
  write(ms) {
    const e = (vh - top) / (vh + ch);
    const target = clamp((e - 0.27) / 0.4);
    const prev = G;
    G += (target - G) * 0.12;
    if (Math.abs(target - G) < 5e-4) G = target;
    if (pointer || settling > 0) { repel(); if (settling > 0) settling--; }
    draw(ms, false);
    if (G !== prev || dirty) { texts(); dirty = false; }
    return true; // idle jitter keeps the crowd alive while the panel is in view
  },
}, { el: panel, margin: '10% 0px' });
