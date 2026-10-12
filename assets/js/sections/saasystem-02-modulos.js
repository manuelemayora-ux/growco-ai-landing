/* 02 · MÓDULOS (#modulos) — reference rwsg (ref-subpages.md §2).
 *   A card latches .is-hit once its top is < 0.7·vh (shared GC loop, read/write): ripple rings, stage grey → colour,
 *   status dot blinks, capability ticks draw (CSS). One frame later .is-run plays the mini-UI (rows rise in order,
 *   bars fill, toast pops).
 *   Hover / focus on a hit card replays the mini-UI at 2× (.is-fast), throttled to once per 2.6 s.
 * Reduced motion / no GC: .is-fin, every card hit + run (final frame). No JS: final frame from the CSS defaults.
 */
const sec = document.getElementById('modulos');
if (!sec || !sec.classList.contains('s-sg')) return;
const GC = window.GC || {};
const cards = [...sec.querySelectorAll('.s-sg__card')];
if (!cards.length) return;
const RMq = matchMedia('(prefers-reduced-motion: reduce)');

const finish = () => { sec.classList.add('is-fin'); cards.forEach(c => c.classList.add('is-hit', 'is-run')); };
if (RMq.matches || !GC.onFrame) { finish(); return; }

const hit = c => {
  if (c.classList.contains('is-hit')) return;
  c.classList.add('is-hit');
  requestAnimationFrame(() => requestAnimationFrame(() => c.classList.add('is-run')));
};

/* replay at 2× on hover / keyboard focus */
cards.forEach(c => {
  let last = 0, t = 0;
  const replay = () => {
    if (!c.classList.contains('is-hit')) return;
    const now = performance.now();
    if (now - last < 2600) return;
    last = now;
    c.classList.remove('is-run');
    c.classList.add('is-fast');
    void c.offsetWidth;
    c.classList.add('is-run');
    clearTimeout(t);
    t = setTimeout(() => c.classList.remove('is-fast'), 1600);
  };
  c.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') replay(); });
  c.addEventListener('focusin', () => hit(c));
});

let tops = [], vh = innerHeight;
const stop = GC.onFrame({
  read() { vh = innerHeight; tops = cards.map(c => c.getBoundingClientRect().top); },
  write() {
    let left = 0;
    cards.forEach((c, i) => { if (tops[i] < vh * 0.7) hit(c); if (!c.classList.contains('is-hit')) left++; });
    if (!left && stop) stop();
    return false;
  },
}, { el: sec, margin: '0px' });
