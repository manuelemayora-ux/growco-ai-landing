/* 01 · HERO (#inicio) — reference RwHero, re-implemented without WebGL.
 *
 * Entrance (ref-motion §3.5): motion.js reveals the hero group ([data-reveal-group]) on load; this script sets the
 * word delays (130 ms + (line×4 + word)×35 ms, half the reference), the .475 s marker delay, and rolls the "+$150K" odometer (monthly managed ad spend).
 *
 * "Crowd reach" (ref-motion §3.6), one canvas over the photo, driven by the shared rAF loop (GC.onFrame), paused
 * off-screen / hidden tab:
 *   - desktop mouse: base photo is greyscale (CSS filter); the canvas paints the COLOUR photo only inside the cursor
 *     spotlight and inside expanding "campaign" waves (soft-edged radial masks, source-in), plus a green glowing rim on
 *     each wave front. Custom cursor (ring + "Alcance" label, lerp .28; btn / dot / out modes).
 *   - touch: colour photo stays static; the canvas only draws the wave rims of a tap.
 *   - reduced motion: .is-still → static colour photo, green lens ring, three static example chips. No waves.
 * Waves: ONLY on click / tap (rev2, client 2026-10-12: no automatic pulse waves — the cursor spotlight is the motion), strong
 * wave. Chips: when a wave front crosses one of the hand-placed "person" anchors (outside edges and the copy box,
 * 7 s cooldown, max 4 visible), an example-event chip pops above that person.
 */
const hero = document.getElementById('inicio');
if (!hero || !hero.classList.contains('hero')) return;
const doc = document;
const GC = window.GC || {};
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const FINE = matchMedia('(hover: hover) and (pointer: fine)').matches;

/* ---------------------------------------------------------------- entrance timing */
const h1 = hero.querySelector('.hero__h1');
if (h1 && !h1.classList.contains('is-split') && GC.splitWords) GC.splitWords(h1);
if (h1) {
  h1.querySelectorAll('.hd-l').forEach((line, li) => {
    line.querySelectorAll('.hd-w').forEach((w, wi) => {
      const inner = w.firstElementChild;
      if (inner) inner.style.transitionDelay = (130 + (li * 4 + wi) * 35) + 'ms';
      if (w.classList.contains('is-accw')) w.style.setProperty('--pd', '475ms');
    });
  });
}
const odo = hero.querySelector('[data-hero-odo]');
let started = false, fxOn = false;
const onReveal = () => {
  if (started) return;
  started = true;
  // once the words have landed, lift the masks so the H1's soft text-shadow is no longer cut into boxes
  if (h1) setTimeout(() => h1.classList.add('is-done'), RM ? 0 : 1000);
  if (odo && GC.odometer) GC.odometer(odo, odo.textContent.trim() || '+$150K', { turns: 2, dur: 800, delay: RM ? 0 : 500 });
  if (fxOn) startFx();
};
const whenRevealed = () => {
  if (hero.classList.contains('is-on')) onReveal();
  else hero.addEventListener('gc:reveal', e => { if (e.target === hero) onReveal(); });
};

/* ---------------------------------------------------------------- still mode */
if (RM) { hero.classList.add('is-still'); whenRevealed(); return; }

/* ---------------------------------------------------------------- crowd reach */
const media = hero.querySelector('.hero__media');
const img = hero.querySelector('.hero__img');
const fx = hero.querySelector('.hero__fx');
const copy = hero.querySelector('.hero__copy');
const cv = doc.createElement('canvas');
cv.className = 'hero__cv';
cv.setAttribute('aria-hidden', 'true');
const ctx = cv.getContext && cv.getContext('2d');
if (!media || !img || !ctx) { hero.classList.add('is-flat'); whenRevealed(); return; }
media.appendChild(cv);
fxOn = true;
let REVEAL = FINE; // colour-reveal mode (desktop mouse); touch → rims only on a colour photo (also the perf fallback)
if (!REVEAL) hero.classList.add('is-flat');

const TAU = Math.PI * 2;
const GREEN = '181,244,127';
// hand-placed "person" anchors in normalised image coordinates (hero-crowd-*.webp, 1600×904)
const ANCHORS = [
  [.116, .105], [.194, .133], [.097, .177], [.288, .221], [.356, .111], [.425, .188], [.516, .105], [.613, .105],
  [.688, .072], [.725, .21], [.8, .127], [.859, .166], [.925, .155], [.913, .26], [.819, .26], [.628, .265],
  [.572, .238], [.506, .277], [.45, .299], [.316, .31], [.216, .315], [.156, .343], [.178, .426], [.275, .481],
  [.366, .454], [.466, .426], [.559, .442], [.706, .393], [.775, .365], [.816, .42], [.866, .42], [.894, .531],
  [.966, .592], [.781, .614], [.8125, .686], [.903, .736], [.703, .553], [.6125, .559], [.666, .514], [.516, .531],
  [.434, .542], [.331, .575], [.203, .614], [.1375, .553], [.2875, .675], [.453, .702], [.556, .675], [.644, .73],
  [.094, .708], [.166, .708], [.394, .785], [.469, .78], [.603, .879], [.659, .89], [.859, .846], [.119, .863],
  [.234, .852], [.275, .874], [.45, .902], [.334, .946], [.544, .957], [.931, .968],
];
// example events (what campaigns and automations produce) — no figures
const ICON = {
  plus: '<path d="M12 5v14M5 12h14"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  play: '<path d="M8 5.8v12.4a.8.8 0 0 0 1.2.7l10-6.2a.8.8 0 0 0 0-1.4l-10-6.2A.8.8 0 0 0 8 5.8z" fill="currentColor" stroke="none"/>',
  chat: '<path d="M20 11.5a7.5 7.5 0 0 1-10.9 6.7L4.5 19.5l1.3-4.2A7.5 7.5 0 1 1 20 11.5z"/>',
  cal: '<rect x="4" y="5.5" width="16" height="14.5" rx="2.5"/><path d="M8 3.5v4M16 3.5v4M4 10h16"/>',
  send: '<path d="M21 3 10.5 13.5"/><path d="M21 3 14.5 21l-4-7.5L3 9.5z"/>',
};
const MSGS = [
  ['plus', 'nuevo lead'], ['check', 'anuncio aprobado'], ['play', 'video listo para publicar'],
  ['chat', 'mensaje respondido'], ['cal', 'cita agendada'], ['send', 'seguimiento enviado'],
];
const svg = (k) => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + ICON[k] + '</svg>';

let W = 1, H = 1, diag = 1, dpr = 1, dprCap = 1.25;
let fit = { x: 0, y: 0, w: 1, h: 1 };
let anchors = [];                  // media-local px
const cool = new Float64Array(ANCHORS.length).fill(-99);
let copyBox = null;                // hero-local px
let off = null, offCtx = null, offOk = false, drewLast = true;
let imgReady = false;

const imgOk = () => img.complete && img.naturalWidth > 0;
function measureCopy() {
  if (!copy) return;
  const h = hero.getBoundingClientRect(), c = copy.getBoundingClientRect();
  copyBox = { l: c.left - h.left, r: c.right - h.left, t: c.top - h.top, b: c.bottom - h.top };
}
function layout() {
  W = Math.max(1, hero.clientWidth);
  H = Math.max(1, hero.clientHeight);
  diag = Math.hypot(W, H);
  dpr = Math.min(window.devicePixelRatio || 1, dprCap);
  const cw = Math.round(W * dpr), ch = Math.round(H * dpr);
  if (cv.width !== cw || cv.height !== ch) { cv.width = cw; cv.height = ch; drewLast = true; }
  const ia = imgOk() ? img.naturalWidth / img.naturalHeight : 1600 / 904;
  if (W / H > ia) fit = { w: W, h: W / ia, x: 0, y: (H - W / ia) / 2 };
  else fit = { w: H * ia, h: H, x: (W - H * ia) / 2, y: 0 };
  anchors = ANCHORS.map(([nx, ny]) => [fit.x + nx * fit.w, fit.y + ny * fit.h]);
  measureCopy();
  offOk = false;
}
// pre-rendered colour layer at canvas resolution (cover fit, darkened to sit with the shaded photo)
function renderOff() {
  if (!REVEAL || !imgReady) return;
  if (!off) { off = doc.createElement('canvas'); offCtx = off.getContext('2d'); }
  if (!offCtx) return;
  off.width = cv.width; off.height = cv.height;
  offCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  offCtx.globalCompositeOperation = 'source-over';
  try { offCtx.drawImage(img, fit.x, fit.y, fit.w, fit.h); } catch (_) { return; }
  offCtx.fillStyle = 'rgba(3,6,18,.16)';
  offCtx.fillRect(0, 0, W, H);
  offOk = true;
}
// (re)load also covers a srcset swap after a resize
img.addEventListener('load', () => { imgReady = imgOk(); layout(); renderOff(); });
imgReady = imgOk();
layout();
renderOff();
if ('ResizeObserver' in window) {
  let rt = 0;
  new ResizeObserver(() => { clearTimeout(rt); rt = setTimeout(() => { layout(); renderOff(); }, 120); }).observe(hero);
}
if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(measureCopy).catch(() => {});

/* ---------------------------------------------------------------- state */
const waves = []; // {x, y, t0, s, pr}
let t0 = 0, sNow = 0, lastWave = -9;
let px = 0, py = 0, tx = 0, ty = 0, str = 0;
let ptrIn = false, lastMove = -99, cx = -1, cy = -1;
let mr = null, hr = null, lastSy = -1, chipK = Math.floor(Math.random() * MSGS.length);

function launch(x, y, s) {
  waves.push({ x, y, t0: sNow, s, pr: 0 });
  if (waves.length > 8) waves.shift();
  lastWave = sNow;
}
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/* chips: a chip sits above its person (stem 18 px, body ~40 px); it must not cover the copy, another chip or the
   header / strip bands, and it stays inside the frame */
const liveChips = []; // {el, l, r, t, b}
let lastChip = -9;
const chipW = (txt) => 56 + txt.length * 7.3;
const hits = (a, b, pad) => a.l < b.r + pad && a.r > b.l - pad && a.t < b.b + pad && a.b > b.t - pad;
function retire(c) {
  if (!c || c.classList.contains('is-out')) return;
  c.classList.add('is-out');
  c.classList.remove('is-up');
  const i = liveChips.findIndex(k => k.el === c);
  if (i >= 0) liveChips.splice(i, 1);
  setTimeout(() => c.remove(), 650);
}
function chipFits(x, y, txt) {
  const w = chipW(txt);
  const box = { l: x - w / 2, r: x + w / 2, t: y - 62, b: y };
  if (box.l < 16 || box.r > W - 16 || y < 190 || y > H - 190) return null;
  if (copyBox && hits(box, copyBox, 18)) return null;
  for (const k of liveChips) if (hits(box, k, 10)) return null;
  return box;
}
function chipAt(x, y, box, ic, txt) {
  if (!fx) return;
  if (liveChips.length >= 4) retire(liveChips[0].el);
  const c = doc.createElement('span');
  c.className = 'hero__chip';
  c.style.left = x.toFixed(1) + 'px';
  c.style.top = y.toFixed(1) + 'px';
  c.innerHTML = '<b class="hero__chip-i">' + svg(ic) + '</b>' + txt + '<i class="hero__chip-p"></i>';
  fx.appendChild(c);
  liveChips.push(Object.assign(box, { el: c }));
  requestAnimationFrame(() => requestAnimationFrame(() => { if (!c.classList.contains('is-out')) c.classList.add('is-up'); }));
  setTimeout(() => retire(c), 2600);
}
function chips(z) {
  if (sNow - lastChip < 0.22) return;              // stagger pops; crossing windows stay open meanwhile
  for (const w of waves) {
    const age = sNow - w.t0;
    if (age < 0) continue;
    const R = age * diag * (0.2 + 0.07 * w.s);
    if (R > diag) { w.pr = R; continue; }
    for (let i = 0; i < anchors.length; i++) {
      if (sNow - cool[i] < 7) continue;
      const [ax, ay] = anchors[i];
      const d = Math.hypot(ax - w.x, ay - w.y);
      if (d < w.pr - 2 || d > R + 2) continue;      // the front has not crossed this person since the last pass
      const hx = (ax - W / 2) * z + W / 2, hy = (ay - H / 2) * z + H / 2;
      const [ic, txt] = MSGS[chipK % MSGS.length];
      const box = chipFits(hx, hy, txt);
      if (!box) continue;
      cool[i] = sNow; lastChip = sNow; chipK++;
      chipAt(hx, hy, box, ic, txt);
      return;
    }
    w.pr = R;
  }
}

/* drawing */
function maskDisc(x, y, r0, r1, a, mid) {
  if (r1 <= 0 || a <= 0.004) return;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r1);
  const k = Math.min(0.999, Math.max(0, r0 / r1));
  g.addColorStop(0, 'rgba(0,0,0,' + a + ')');
  g.addColorStop(k, 'rgba(0,0,0,' + a + ')');
  if (mid) { g.addColorStop(k + (1 - k) * 0.33, 'rgba(0,0,0,' + (a * 0.74) + ')'); g.addColorStop(k + (1 - k) * 0.66, 'rgba(0,0,0,' + (a * 0.26) + ')'); }
  else g.addColorStop(k + (1 - k) * 0.5, 'rgba(0,0,0,' + (a * 0.5) + ')');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r1, 0, TAU);
  ctx.fill();
}
const GAUSS = [0.0079, 0.0657, 0.298, 0.739, 1, 0.739, 0.298, 0.0657, 0.0079];
function rim(x, y, R, band, a) {
  const r0 = Math.max(0, R - band * 2.2), r1 = R + band * 2.2;
  const g = ctx.createRadialGradient(x, y, r0, x, y, r1);
  for (let i = 0; i < 9; i++) g.addColorStop(i / 8, 'rgba(' + GREEN + ',' + (a * GAUSS[i]).toFixed(4) + ')');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r1, 0, TAU);
  if (r0 > 0) ctx.arc(x, y, r0, 0, TAU, true);
  ctx.fill();
}
const farCorner = (x, y) => Math.max(Math.hypot(x, y), Math.hypot(W - x, y), Math.hypot(x, H - y), Math.hypot(W - x, H - y));
function draw() {
  const live = [];
  let full = false;                                  // one wave already colours the whole frame → skip the masks
  for (let i = waves.length - 1; i >= 0; i--) {
    const w = waves[i], age = sNow - w.t0, life = 2.4 + 2.6 * w.s;
    if (age > life) { waves.splice(i, 1); continue; }
    if (age < 0) continue;
    const R = age * diag * (0.2 + 0.07 * w.s), band = diag * (0.008 + 0.006 * w.s);
    const fade = 1 - smooth(life * 0.4, life, age);
    const far = farCorner(w.x, w.y);
    if (fade >= 0.999 && R - band * 5 >= far) full = true;
    live.push({ w, R, band, fade, rimA: 0.62 * (1 - smooth(0, life * 0.75, age)), far });
  }
  const lit = REVEAL && offOk && (live.length || str > 0.01);
  if (!lit && !live.length) {
    if (drewLast) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height); drewLast = false; }
    return;
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
  if (lit && full) ctx.drawImage(off, 0, 0);         // opaque copy replaces the whole frame, no clear needed
  else {
    ctx.clearRect(0, 0, cv.width, cv.height);
    if (lit) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      for (const v of live) maskDisc(v.w.x, v.w.y, v.R - v.band * 5, v.R + v.band, v.fade, false);
      if (str > 0.01) maskDisc(px, py, diag * 0.035, diag * 0.12, 0.85 * str, true);
      ctx.globalCompositeOperation = 'source-in';
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(off, 0, 0);
      ctx.globalCompositeOperation = 'source-over';
    }
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  for (const v of live) if (v.rimA > 0.004 && v.R - v.band * 2.2 < v.far) rim(v.w.x, v.w.y, v.R, v.band, v.rimA);
  drewLast = true;
  if (!hero.classList.contains('is-gl')) hero.classList.add('is-gl');
}

/* ---------------------------------------------------------------- input */
const mapPoint = (clientX, clientY) => {
  const r = media.getBoundingClientRect();
  const z = r.width / W || 1;
  return [(clientX - r.left) / z, (clientY - r.top) / z];
};
const blocked = (t) => t instanceof Element && !!t.closest('a,button,input,select,textarea,label,nav');
let touchDown = false;
function launchAt(e) {
  if (!started || blocked(e.target)) return;
  const [x, y] = mapPoint(e.clientX, e.clientY);
  if (!REVEAL) { tx = px = x; ty = py = y; lastMove = sNow; }
  launch(x, y, 1.6);
  if (GC.wake) GC.wake();
}
hero.addEventListener('pointerdown', e => {
  if (e.pointerType === 'touch') { touchDown = true; return; }
  if (e.button !== 0) return;
  launchAt(e);
});
hero.addEventListener('click', e => { if (touchDown) { touchDown = false; launchAt(e); } });

/* custom cursor (desktop mouse) */
let cur = null, curMode = 'out', kx = -200, ky = -200;
const setMode = (m) => { if (m !== curMode && cur) { curMode = m; cur.dataset.m = m; } };
if (REVEAL) {
  cur = doc.createElement('div');
  cur.className = 'hero__cur';
  cur.setAttribute('aria-hidden', 'true');
  cur.dataset.m = 'out';
  cur.innerHTML = '<i class="hero__cur-r"><b>Alcance</b></i><i class="hero__cur-d"></i>';
  hero.appendChild(cur);
  hero.classList.add('has-cur');
  hero.addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse' && e.pointerType !== 'pen') return;
    cx = e.clientX; cy = e.clientY;
    if (!ptrIn) { kx = cx; ky = cy; }
    ptrIn = true; lastMove = sNow;
    const t = e.target instanceof Element ? e.target : null;
    setMode(t && t.closest('a,button,.btn') ? 'btn' : t && t.closest('.hero__copy h1,.hero__copy p') ? 'dot' : 'reach');
  }, { passive: true });
  hero.addEventListener('pointerleave', () => { ptrIn = false; setMode('out'); });
  hero.addEventListener('pointerdown', () => {
    if (curMode === 'btn') return;
    cur.classList.remove('is-ping'); void cur.offsetWidth; cur.classList.add('is-ping');
  });
}

/* ---------------------------------------------------------------- frame-rate guard
   Two consecutive 90-frame windows with a median frame time above 28 ms (≈ below 36 fps) step the quality down:
   1) canvas at .75× resolution, 2) no colour reveal (colour photo + wave rims only, like touch). */
let quality = 0, badWins = 0;
const dts = [];
function watch(dt) {
  if (quality >= 2 || sNow < 2.5 || doc.hidden) return;
  dts.push(dt);
  if (dts.length < 90) return;
  dts.sort((a, b) => a - b);
  const med = dts[45];
  dts.length = 0;
  if (med <= 28) { badWins = 0; return; }
  if (++badWins < 2) return;
  badWins = 0;
  quality++;
  if (quality === 1) dprCap = 0.75;
  else { REVEAL = false; str = 0; hero.classList.add('is-flat'); }
  layout(); renderOff();
}

/* ---------------------------------------------------------------- frame */
function startFx() {
  t0 = performance.now() / 1000;
  px = tx = W / 2; py = ty = H * 0.55;
  if (!GC.onFrame) return;
  GC.onFrame({
    read() {
      hr = hero.getBoundingClientRect();
      mr = media.getBoundingClientRect();
    },
    write(t, dt) {
      sNow = t / 1000 - t0;
      if (!hr || !mr) return true;
      /* scroll: parallax + zoom (--sy = progress of the hero leaving the top) */
      const sy = Math.min(1, Math.max(0, -hr.top / (hr.height || 1)));
      if (Math.abs(sy - lastSy) > 1e-4) { lastSy = sy; hero.style.setProperty('--sy', sy.toFixed(4)); }
      const z = mr.width / W || 1;
      /* spotlight target: pointer, or a slow Lissajous wander when idle */
      const idle = !REVEAL || !ptrIn || sNow - lastMove > 2.6;
      if (idle) {
        const e = sNow * 0.23;
        tx = W * (0.5 + 0.34 * Math.sin(e * 1.3));
        ty = H * (0.5 + 0.28 * Math.sin(e * 0.9 + 1.2));
      } else {
        tx = (cx - mr.left) / z;
        ty = (cy - mr.top) / z;
      }
      const f = idle ? 0.03 : 0.16;
      px += (tx - px) * f; py += (ty - py) * f;
      str += ((REVEAL && !idle ? 1 : 0) - str) * 0.08;
      if (str < 0.002) str = 0;
      /* waves: only on click / tap (rev2, client: the automatic pulse waves were too much) */
      chips(z);
      draw();
      watch(dt);
      /* cursor */
      if (cur && ptrIn) {
        kx += (cx - kx) * 0.28; ky += (cy - ky) * 0.28;
        cur.style.transform = 'translate3d(' + kx.toFixed(1) + 'px,' + ky.toFixed(1) + 'px,0)';
      }
      return true;
    },
  }, { el: hero, margin: '0px' });
}

whenRevealed();
