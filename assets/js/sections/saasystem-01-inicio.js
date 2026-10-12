/* 01 · INICIO (#inicio) — reference rwph (ref-subpages.md §2) as a product hero.
 *   --ex = clamp(−top / height), lerped .2 → copy translate 72·ex + fade, object lift −90·ex + scale (CSS).
 *   Pointer tilt (fine pointers only): --tx / --ty in [−.5, .5] around the object centre, lerped .08 → rotateX/Y (CSS).
 *   Panel entrance once ≥ 30 % visible: .is-on on .s-ph__obj (bars grow in order),
 *   KPI counts up (1.4 s), the "stock bajo" chip pops at +1.7 s (SPRING).
 * Reduced motion: .is-fin (final frame, no tilt / exit). No JS: final frame from the markup.
 */
const sec = document.getElementById('inicio');
if (!sec || !sec.classList.contains('s-ph')) return;
const GC = window.GC || {};
const RMq = matchMedia('(prefers-reduced-motion: reduce)');
const FINEq = matchMedia('(hover: hover) and (pointer: fine)');
const obj = sec.querySelector('.s-ph__obj');
const pop = sec.querySelector('.s-ph__pop');
const kpi = sec.querySelector('.s-ph__kpi b');
if (!obj) return;
const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);

if (RMq.matches || !GC.onFrame) {
  sec.classList.add('is-fin');
  obj.classList.add('is-on');
  if (pop) pop.classList.add('is-up');
  return;
}

/* entrance */
let started = false;
const start = () => {
  if (started) return;
  started = true;
  obj.classList.add('is-on');
  if (kpi && GC.countUp) GC.countUp(kpi, 48920, { prefix: '$', dur: 1400 });
  setTimeout(() => pop && pop.classList.add('is-up'), 1700);
};
if (GC.inView) GC.inView(obj, start, { threshold: 0.3, margin: '0px' });
else start();
/* a keyboard user landing inside the hero never waits for the animation */
sec.addEventListener('focusin', start);

/* exit + tilt */
let top = 0, h = 1, ex = 0, tx = 0, ty = 0, gx = 0, gy = 0;
const onMove = e => {
  if (!FINEq.matches) return;
  const r = obj.getBoundingClientRect();
  gx = clamp((e.clientX - (r.left + r.width / 2)) / Math.max(1, r.width), -0.5, 0.5);
  gy = clamp((e.clientY - (r.top + r.height / 2)) / Math.max(1, r.height), -0.5, 0.5);
};
sec.addEventListener('pointermove', onMove, { passive: true });
sec.addEventListener('pointerleave', () => { gx = 0; gy = 0; GC.wake && GC.wake(); });

GC.onFrame({
  read() { const r = sec.getBoundingClientRect(); top = r.top; h = r.height || 1; },
  write() {
    const tex = clamp(-top / h);
    ex += (tex - ex) * 0.2;
    tx += (gx - tx) * 0.08;
    ty += (gy - ty) * 0.08;
    sec.style.setProperty('--ex', ex.toFixed(4));
    sec.style.setProperty('--tx', tx.toFixed(4));
    sec.style.setProperty('--ty', ty.toFixed(4));
    return Math.abs(tex - ex) > 0.0005 || Math.abs(gx - tx) > 0.001 || Math.abs(gy - ty) > 0.001;
  },
}, { el: sec, margin: '10% 0px' });
