/* 05 · IMPLEMENTACIÓN (#implementacion) — reference rwab-dark (ref-subpages.md §5).
 * Desktop (≥1100px) + motion → .is-pin (CSS pins the stage for 220svh). Track maths (W = section width):
 *   pad = .16·W · G = max(360, .3·W) · trackW = 2·pad + (L−1)·G · xᵢ = pad + i·G
 *   pp = clamp(−pin.top / (pin.h − vh)), lerped .18 · r = clamp((pp − .05) / .86)
 *   --tx = −r·(trackW − W) (track translate) · --hx = pad + r·(trackW − 2·pad) (lit trace width + head position)
 *   milestone i is hit when hx ≥ xᵢ − 2; the readout shows the last hit step ("0N / 04").
 *   The trace is a dashed line with an ECG spike at every milestone (path built here for the current W).
 * Otherwise (narrow or reduced motion) → .is-vl: --fv = clamp((0.68·vh − list.top) / list.h) fills the rail;
 *   an item is hit when offsetTop + 24 ≤ fv·h + 1. Reduced motion: every item hit, rail full. No JS: CSS list (all lit).
 */
const sec = document.getElementById('implementacion');
if (!sec || !sec.classList.contains('s-ab')) return;
const GC = window.GC || {};
const RMq = matchMedia('(prefers-reduced-motion: reduce)');
const WIDE = matchMedia('(min-width: 1100px)');
const pin = sec.querySelector('.s-ab__pin');
const track = sec.querySelector('.s-ab__track');
const ms = [...sec.querySelectorAll('.s-ab__m')];
const vl = sec.querySelector('.s-ab__vl');
const vms = [...sec.querySelectorAll('.s-ab__vm')];
const ry = sec.querySelector('.s-ab__ry');
const rn = sec.querySelector('.s-ab__rn');
const paths = [...sec.querySelectorAll('.s-ab__tr path')];
const svgs = [...sec.querySelectorAll('.s-ab__tr')];
if (!pin || !track || !ms.length || !GC.onFrame) return;
const L = ms.length;
const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
const pad2 = n => String(n).padStart(2, '0');
const names = ms.map(m => (m.querySelector('.s-ab__tx b') || {}).textContent || '');

let mode = '', W = 0, padX = 0, G = 0, trackW = 0, pp = -1, lastHit = -2;
const layout = () => {
  W = sec.clientWidth;
  padX = 0.16 * W;
  G = Math.max(360, 0.3 * W);
  trackW = 2 * padX + (L - 1) * G;
  track.style.width = `${trackW}px`;
  ms.forEach((m, i) => { m.style.left = `${padX + i * G}px`; });
  /* dashed trace with an ECG spike at each milestone */
  let d = 'M0 50';
  for (let i = 0; i < L; i++) {
    const x = padX + i * G;
    d += ` H${(x - 15).toFixed(1)} l5 4 l5 -34 l5 52 l5 -30 l5 8`;
  }
  d += ` H${trackW.toFixed(1)}`;
  paths.forEach(p => p.setAttribute('d', d));
  svgs.forEach(s => { s.setAttribute('width', String(Math.ceil(trackW))); s.setAttribute('viewBox', `0 0 ${Math.ceil(trackW)} 100`); });
};
const setMode = () => {
  const m = WIDE.matches && !RMq.matches ? 'pin' : 'vl';
  if (m === mode) return;
  mode = m;
  sec.classList.toggle('is-pin', m === 'pin');
  sec.classList.toggle('is-vl', m === 'vl');
  if (m === 'pin') layout();
  if (RMq.matches) { vms.forEach(v => v.classList.add('is-hit')); if (vl) vl.style.setProperty('--fv', '1'); }
  pp = -1; lastHit = -2;
  GC.wake && GC.wake();
};
setMode();
WIDE.addEventListener && WIDE.addEventListener('change', setMode);
addEventListener('resize', () => { if (mode === 'pin') layout(); }, { passive: true });

let pTop = 0, pH = 1, vh = innerHeight, lTop = 0, lH = 1, tops = [];
GC.onFrame({
  read() {
    vh = innerHeight;
    if (mode === 'pin') { const r = pin.getBoundingClientRect(); pTop = r.top; pH = r.height; }
    else if (vl) { const r = vl.getBoundingClientRect(); lTop = r.top; lH = r.height || 1; tops = vms.map(v => v.offsetTop); }
  },
  write() {
    if (mode === 'pin') {
      const target = clamp(-pTop / Math.max(1, pH - vh));
      if (pp < 0) pp = target;
      pp += (target - pp) * 0.18;
      const r = clamp((pp - 0.05) / 0.86);
      const tx = -r * (trackW - W);
      const hx = padX + r * (trackW - 2 * padX);
      track.style.setProperty('--tx', `${tx.toFixed(1)}px`);
      track.style.setProperty('--hx', `${hx.toFixed(1)}px`);
      let hit = -1;
      ms.forEach((m, i) => { const on = hx >= padX + i * G - 2; m.classList.toggle('is-hit', on); if (on) hit = i; });
      if (hit !== lastHit) {
        lastHit = hit;
        const k = Math.max(0, hit);
        if (ry) ry.textContent = names[k];
        if (rn) rn.textContent = `${pad2(k + 1)} / ${pad2(L)}`;
      }
      return Math.abs(target - pp) > 0.0005;
    }
    if (RMq.matches || !vl) return false;
    const fv = clamp((vh * 0.68 - lTop) / lH);
    vl.style.setProperty('--fv', fv.toFixed(4));
    vms.forEach((v, i) => { if (tops[i] + 24 <= fv * lH + 1) v.classList.add('is-hit'); });
    return false;
  },
}, { el: sec, margin: '10% 0px' });
