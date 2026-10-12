/* 06 · CÓMO TRABAJAMOS (#proceso) — pinned steps + scroll-filled funnel (reference RwFunnel, ref-motion §3.15).
 *
 * Modes (motion.js data-sticky="(min-width:1200px)" toggles .is-pinned / .is-flat on the section):
 *   PINNED  320svh track, 100svh sticky stage. motion.js writes the lerped (.18) pin progress --pin on the section;
 *           the CSS turns it into each band's fill  f_i = clamp(((pin − .04)/.86 · 4 − i) · 1.25).  This script reads
 *           the same --pin once per frame (shared GC loop, no layout reads) and derives the discrete state:
 *           active = floor(n) (−1 while n ≤ .02) → .is-act / .is-done on the steps, .is-on / .is-act on the bands; a band
 *           that switches on counts its figure 0 → value over 1,400 ms easeOutQuart, a band that switches off shows 0.
 *           Bands become focusable (tip on :focus-visible). Particle canvas: dots fall through the trapezoids
 *           (26–56 /s, 70–130 px/s, sinusoidal drift), survive into the next band with p = .34 / .30 / .36 up to the active
 *           band, the ones reaching "Clientes" turn Growco blue; capped at 420, only while the funnel is near the viewport.
 *   FLAT    tablet / phone / reduced motion: each card fills its bar (CSS, 1.3 s) and counts up when ≥ 50 % visible.
 *   Reduced motion: final values, bars full, no canvas. No JS: flat cards with the final values (HTML text).
 * Figures are real client results per stage (attributed in each tip + the foot line, see the fragment). A band value
 * counts up from data-v (optional data-dec decimals, data-pre / data-suf around the number); a band without data-v
 * (e.g. "6–7") keeps its authored text.
 */
const sec = document.getElementById('proceso');
if (!sec || !sec.classList.contains('fn')) return;
const GC = window.GC || {};
const RMq = matchMedia('(prefers-reduced-motion: reduce)');
/* group reveal (the section carries data-reveal-manual). motion.js would derive its threshold from offsetHeight, and the
   320svh pin track pushes that until ~half the stage is on screen; reveal instead when the section top is 33 % into the
   viewport (≈ 600 px at 1440×900), like the other sections and the reference .rwfn. Runs before any other guard so the
   content can never stay hidden behind a later early return; focus entering the section still reveals it instantly. */
if (typeof GC.reveal === 'function') {
  const show = () => GC.reveal(sec);
  if (RMq.matches || !('IntersectionObserver' in window)) show();
  else {
    try {
      const rio = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { rio.disconnect(); show(); } }, { rootMargin: '0px 0px -33% 0px', threshold: 0 });
      rio.observe(sec);
    } catch (_) { show(); }
  }
}
const bands = [...sec.querySelectorAll('.fn-band')];
const steps = [...sec.querySelectorAll('.fn-step')];
const vals = bands.map(b => b.querySelector('.fn-band-v'));
const fun = sec.querySelector('.fn-fun');
const cv = sec.querySelector('.fn-cv');
if (!bands.length || typeof GC.onFrame !== 'function') return; // static flat cards stay as authored
sec.classList.add('fn-live'); // CSS may now hide the flat bars until they fill (never without this script)
/* pause the eyebrow halo loop while the section is off screen */
if ('IntersectionObserver' in window) {
  try { new IntersectionObserver(es => { const e = es[es.length - 1]; sec.classList.toggle('fn-vis', !!(e && e.isIntersecting)); }).observe(sec); } catch (_) { sec.classList.add('fn-vis'); }
} else sec.classList.add('fn-vis');
const N = bands.length;
const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
const spec = vals.map(v => ({
  n: v ? parseFloat(v.getAttribute('data-v')) : NaN,
  dec: v ? parseInt(v.getAttribute('data-dec') || '0', 10) || 0 : 0,
  pre: (v && v.getAttribute('data-pre')) || '',
  suf: (v && v.getAttribute('data-suf')) || '',
  txt: v ? v.textContent : '',
}));
/* value of band i at fraction p (0 = start, 1 = final); bands without data-v keep their authored text */
const fmt = (i, p) => {
  const o = spec[i];
  if (Number.isNaN(o.n)) return o.txt;
  const x = o.n * p;
  const t = o.dec ? x.toFixed(o.dec) : Math.round(x).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return o.pre + t + o.suf;
};

/* ---------------------------------------------------------------- counters (one writer in the shared loop) */
const cnt = bands.map(() => ({ t0: 0, run: false }));
let stopCount = null;
const countWrite = (t) => {
  let more = false;
  cnt.forEach((c, i) => {
    if (!c.run) return;
    const p = clamp((t - c.t0) / 1400);
    if (vals[i]) vals[i].textContent = fmt(i, 1 - Math.pow(1 - p, 4));
    if (p < 1) more = true; else c.run = false;
  });
  if (!more && stopCount) { const s = stopCount; stopCount = null; Promise.resolve().then(s); }
  return more;
};
function setOn(i, on) {
  const b = bands[i];
  if (!b || b.classList.contains('is-on') === on) return;
  b.classList.toggle('is-on', on);
  const c = cnt[i];
  if (!on) { c.run = false; if (vals[i]) vals[i].textContent = fmt(i, 0); return; }
  if (RMq.matches) { if (vals[i]) vals[i].textContent = fmt(i, 1); return; }
  c.t0 = performance.now(); c.run = true;
  if (!stopCount) stopCount = GC.onFrame(countWrite);
  else GC.wake();
}
const showFinal = () => bands.forEach((b, i) => { b.classList.add('is-on'); cnt[i].run = false; if (vals[i]) vals[i].textContent = fmt(i, 1); });

/* ---------------------------------------------------------------- pinned driver */
let act = -2, stopPin = null, stopCv = null, flatIO = null;
const setAct = (a) => {
  if (a === act) return;
  act = a;
  steps.forEach((s, i) => { s.classList.toggle('is-act', i === a); s.classList.toggle('is-done', i < a); });
  bands.forEach((b, i) => { b.classList.toggle('is-act', i === a); setOn(i, i <= a); });
};
let lastPin = '';
const pinWrite = () => {
  const raw = sec.style.getPropertyValue('--pin');
  if (raw === lastPin) return false;
  lastPin = raw;
  const n = clamp((parseFloat(raw) - 0.04) / 0.86) * N;
  pinState.n = n;
  setAct(n <= 0.02 ? -1 : Math.min(N - 1, Math.floor(n)));
  return false;
};
const pinState = { n: 0 };

/* ---------------------------------------------------------------- particles */
const INS = [0, 7, 14, 21, 27];
const SURV = [0.34, 0.3, 0.36];
function startCanvas() {
  const ctx = cv && cv.getContext ? cv.getContext('2d') : null;
  if (!ctx || !fun) return null;
  let W = 1, H = 1, dpr = 1, rows = [], parts = [], acc = 0, lastT = 0, dirty = true;
  const measure = () => {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = fun.clientWidth; H = fun.clientHeight;
    cv.width = Math.max(1, Math.round(W * dpr)); cv.height = Math.max(1, Math.round(H * dpr));
    const fr = fun.getBoundingClientRect();
    rows = bands.map(b => { const r = b.getBoundingClientRect(); return [r.top - fr.top, r.bottom - fr.top]; });
    dirty = false;
  };
  const ro = 'ResizeObserver' in window ? new ResizeObserver(() => { dirty = true; GC.wake(); }) : null;
  if (ro) ro.observe(fun);
  const inset = (y) => {
    for (let k = 0; k < rows.length; k++) {
      const [a, b] = rows[k];
      if (y <= b) return y < a ? INS[k] / 100 : (INS[k] + (INS[k + 1] - INS[k]) * ((y - a) / Math.max(1, b - a))) / 100;
    }
    return INS[rows.length] / 100;
  };
  const stop = GC.onFrame({
    read() { if (dirty) measure(); },
    write(t) {
      if (!rows.length || !W) { lastT = t; return true; }
      const dt = Math.min(0.05, (t - (lastT || t)) / 1000);
      lastT = t;
      const n = pinState.n, cur = Math.min(rows.length - 1, Math.floor(Math.max(0, n))), all = n >= rows.length - 0.02;
      for (acc += dt * (26 + 30 * clamp(n)); acc > 1; acc--) {
        parts.push({ u: 0.04 + Math.random() * 0.92, y: rows[0][0] - 6, v: 70 + Math.random() * 60, k: 0, die: 0, s: 1.6 + Math.random() * 1.2, ph: Math.random() * 6.28 });
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      for (let j = parts.length - 1; j >= 0; j--) {
        const p = parts[j];
        p.y += p.v * dt * (1 + p.k * 0.25);
        p.u = clamp(p.u + Math.sin(t / 500 + p.ph) * 9e-4 + (0.5 - p.u) * dt * 0.08 * Math.min(p.k, 3), 0.01, 0.99);
        const row = rows[Math.min(p.k, rows.length - 1)];
        if (!p.die && p.y > row[1]) {
          const lim = all ? rows.length - 1 : cur;
          if (p.k >= lim) { p.die = 0.001; if (p.k === rows.length - 1 && all) p.k = 9; }
          else if (Math.random() < SURV[p.k]) p.k++;
          else p.die = 0.001;
        }
        if (p.die) p.die += dt * 2.2;
        if (p.die > 1 || p.y > H + 10) { parts.splice(j, 1); continue; }
        const ins = inset(p.y), x = W * (ins + p.u * (1 - 2 * ins));
        const a = (1 - (p.die || 0)) * (0.35 + 0.15 * Math.min(3, p.k));
        ctx.beginPath();
        ctx.arc(x, p.y, p.s + (p.k >= 3 ? 1.4 : p.k * 0.3), 0, 6.283);
        ctx.fillStyle = p.k >= 3 ? `rgba(2,72,247,${Math.min(1, a + 0.4)})` : `rgba(11,19,49,${a})`;
        ctx.fill();
      }
      if (parts.length > 420) parts.splice(0, parts.length - 420);
      return true;
    },
  }, { el: fun, margin: '10% 0px' });
  return () => { stop(); if (ro) ro.disconnect(); ctx.clearRect(0, 0, cv.width, cv.height); };
}

/* ---------------------------------------------------------------- flat driver */
function startFlat() {
  if (RMq.matches || !('IntersectionObserver' in window)) { showFinal(); return null; }
  bands.forEach((b, i) => { if (!b.classList.contains('is-on') && vals[i]) vals[i].textContent = fmt(i, 0); });
  const io = new IntersectionObserver(es => {
    es.forEach(e => {
      if (!e.isIntersecting) return;
      const i = bands.indexOf(e.target);
      if (i >= 0) setOn(i, true);
      io.unobserve(e.target);
    });
  }, { threshold: 0.5 });
  bands.forEach(b => { if (!b.classList.contains('is-on')) io.observe(b); });
  return io;
}

/* ---------------------------------------------------------------- mode switch */
let mode = '';
function apply() {
  const pinned = sec.classList.contains('is-pinned') && !RMq.matches;
  const m = pinned ? 'pin' : 'flat';
  if (m === mode) return;
  mode = m;
  if (stopPin) { stopPin(); stopPin = null; }
  if (stopCv) { stopCv(); stopCv = null; }
  if (flatIO) { flatIO.disconnect(); flatIO = null; }
  steps.forEach(s => s.classList.remove('is-act', 'is-done'));
  bands.forEach(b => b.classList.remove('is-act'));
  if (pinned) {
    bands.forEach((b, i) => { b.setAttribute('tabindex', '0'); b.classList.remove('is-on'); cnt[i].run = false; if (vals[i]) vals[i].textContent = fmt(i, 0); });
    act = -2; lastPin = ''; pinState.n = 0;
    stopPin = GC.onFrame(pinWrite, { el: sec, margin: '25% 0px' });
    stopCv = startCanvas();
  } else {
    bands.forEach(b => b.removeAttribute('tabindex'));
    flatIO = startFlat();
  }
}
apply();
try { new MutationObserver(apply).observe(sec, { attributes: true, attributeFilter: ['class'] }); } catch (_) { /* old engines: mode fixed at load */ }
if (RMq.addEventListener) RMq.addEventListener('change', apply);
