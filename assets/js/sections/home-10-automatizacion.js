/* 10 · AUTOMATIZACIÓN (#automatizacion) — phone lock screen, notifications stacking in (reference RwReviews,
 * ref-motion §3.19).
 *
 * Entrance: motion.js reveals the section group (eyebrow 0 ms, score 120, pills 220, words 260 + 55 ms·i with the green
 * boxes at a fixed ≈ .8 s, lock 200 ms / 40 px, sub 480, button 560) — all declared in the fragment.
 *
 * Stack (scroll-linked, shared rAF loop via GC.onFrame, only while the lock is near the viewport):
 *   e = clamp((vh·.9 − top)/(vh·.62)) with top = lock top in the viewport → shown J = floor(e·N + .35).
 *   DOM order = final order (newest first). Note i (0-based) gets r = i − (N − J): r < 0 → waiting (no .is-in),
 *   r = 0 newest (.is-new: its app icon pings). CSS turns --r into translate/scale/opacity/z-index (offsets 168 px,
 *   158 px on phone; deeper notes +12 px, −.045 scale, −.28 opacity, hidden from the 6th).
 *   Position labels ("ahora", "hace 2 min", …) follow r like the reference. Notes deeper than the visible three are
 *   tabindex −1, hidden ones aria-hidden. The stack freezes while focus is inside it.
 * Reduced motion / no JS: every note shown in its final place (inline --r in the fragment).
 * The notifications illustrate what a Growco automation sends (descriptive product illustration, no metrics).
 */
const sec = document.getElementById('automatizacion');
if (!sec) return;
const lock = sec.querySelector('.au-lock');
const stack = lock && lock.querySelector('.au-stack');
if (!lock || !stack) return;
const notes = Array.from(stack.querySelectorAll('.au-note'));
const N = notes.length;
if (!N) return;
const GC = window.GC || {};
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const countEl = lock.querySelector('[data-au-count]');
const labelEl = lock.querySelector('[data-au-label]');
const WHEN = ['ahora', 'hace 2 min', 'hace 9 min', 'hace 26 min', 'hace 1 h', 'hace 3 h'];
const whens = notes.map(n => n.querySelector('.au-when'));
const clamp = GC.clamp || ((v, a = 0, b = 1) => (v < a ? a : v > b ? b : v));

let shown = -1;
function apply(J) {
  if (J === shown) return;
  shown = J;
  notes.forEach((n, i) => {
    const r = i - (N - J);
    const on = r >= 0;
    n.classList.toggle('is-in', on);
    n.classList.toggle('is-new', r === 0);
    if (on) n.style.setProperty('--r', r);
    const hidden = !on || r >= 5;
    n.tabIndex = on && r <= 2 ? 0 : -1;
    if (hidden) n.setAttribute('aria-hidden', 'true');
    else n.removeAttribute('aria-hidden');
    const w = whens[i];
    if (w && on) w.textContent = WHEN[Math.min(r, WHEN.length - 1)];
  });
  if (countEl) countEl.textContent = String(J);
  if (labelEl) labelEl.textContent = J === 1 ? 'notificación nueva' : 'notificaciones nuevas';
}

if (RM || typeof GC.onFrame !== 'function') { apply(N); return; }

let frozen = false;
stack.addEventListener('focusin', () => { frozen = true; });
stack.addEventListener('focusout', e => {
  if (stack.contains(e.relatedTarget)) return;
  frozen = false;
  if (typeof GC.wake === 'function') GC.wake(); // catch up with any scroll that happened while frozen
});

let top = 0, vh = 1;
// below the viewport at start → begin empty (notes enter as the phone scrolls up)
if (lock.getBoundingClientRect().top > innerHeight) apply(0);
GC.onFrame({
  read() { top = lock.getBoundingClientRect().top; vh = innerHeight || 1; },
  write() {
    if (frozen) return false;
    const e = clamp((vh * 0.9 - top) / (vh * 0.62));
    apply(Math.max(0, Math.min(N, Math.floor(e * N + 0.35))));
    return false; // the loop wakes again on scroll / resize
  },
}, { el: lock, margin: '30% 0px' });
