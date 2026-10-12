/* 04 · PARA TU GIRO (#giros) — reference rwwg (ref-subpages.md §3).
 * Scan reveal (shared GC loop, per visible cover):
 *   --k = clamp((0.94·vh − cov.top) / max(120, min(1.05·cov.h, 0.62·vh)))  → grey layer clip, scan line, Antes / Con Stockly
 * Filter (chips, aria-pressed): matching cards are re-flowed into the two masonry columns in their original order
 *   (left: wide / sq alternating, right: tall / land), the others get .is-out. FLIP: cards that stay glide from their old
 *   rect (760 ms, cubic-bezier(.7,0,.2,1)); new ones rise from translateY(40px) scale(.94) (700 ms, delay 120 + n·60 ms).
 *   The counter is padded to 2 digits (aria-live); the module chip that matches the filter turns green; empty state.
 * Reduced motion: .is-fin (no scan, k = 1, no FLIP). No JS: all cards in colour, chips hidden (.js-only).
 */
const sec = document.getElementById('giros');
if (!sec || !sec.classList.contains('s-wg')) return;
const GC = window.GC || {};
const RMq = matchMedia('(prefers-reduced-motion: reduce)');
const cols = [...sec.querySelectorAll('.s-wg__colm')];
const cards = [...sec.querySelectorAll('.s-wg__card')].sort((a, b) => a.dataset.i - b.dataset.i);
const chips = [...sec.querySelectorAll('.s-wg__chips button')];
const countB = sec.querySelector('.s-wg__count b');
const countS = sec.querySelector('.s-wg__count span');
const empty = sec.querySelector('.s-wg__empty');
if (cols.length < 2 || !cards.length) return;
const RM = RMq.matches;
const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
const pad2 = n => String(n).padStart(2, '0');
const SHAPES = [['wide', 'sq'], ['tall', 'land']];
const EASE_FLIP = 'cubic-bezier(.7,0,.2,1)', EASE_OUT = 'cubic-bezier(.2,.8,.2,1)';

if (RM) sec.classList.add('is-fin');

/* ---------------------------------------------------------------- scan */
if (!RM && GC.onFrame) {
  const covs = cards.map(c => c.querySelector('.s-wg__cov'));
  let rects = [], vh = innerHeight;
  const ks = cards.map(() => -1);
  GC.onFrame({
    read() { vh = innerHeight; rects = covs.map(c => (c.offsetParent ? c.getBoundingClientRect() : null)); },
    write() {
      rects.forEach((r, i) => {
        if (!r) return;
        const k = clamp((vh * 0.94 - r.top) / Math.max(120, Math.min(r.height * 1.05, vh * 0.62)));
        if (Math.abs(k - ks[i]) > 0.001) { ks[i] = k; cards[i].style.setProperty('--k', k.toFixed(4)); }
      });
      return false;
    },
  }, { el: sec, margin: '10% 0px' });
}

/* ---------------------------------------------------------------- filter */
let cur = 'all';
const apply = f => {
  if (f === cur) return;
  cur = f;
  const first = new Map(cards.map(c => [c, c.classList.contains('is-out') ? null : c.getBoundingClientRect()]));
  const match = cards.filter(c => f === 'all' || c.dataset.svs.split(' ').includes(f));
  cards.forEach(c => c.classList.toggle('is-out', !match.includes(c)));
  match.forEach((c, n) => {
    const col = n % 2, pos = Math.floor(n / 2);
    cols[col].appendChild(c);
    c.classList.remove('is-wide', 'is-sq', 'is-tall', 'is-land');
    c.classList.add(`is-${SHAPES[col][pos % 2]}`);
    c.querySelectorAll('.s-wg__svs li').forEach(li => li.classList.toggle('is-on', li.dataset.sv === f));
  });
  if (!match.length) cards.forEach(c => c.querySelectorAll('.s-wg__svs li').forEach(li => li.classList.remove('is-on')));
  chips.forEach(b => { const on = b.dataset.f === f; b.classList.toggle('is-sel', on); b.setAttribute('aria-pressed', String(on)); });
  if (countB) countB.textContent = pad2(match.length);
  if (countS) countS.textContent = match.length === 1 ? 'giro' : 'giros';
  if (empty) empty.hidden = match.length > 0;
  if (RM || !Element.prototype.animate) return;
  let nNew = 0;
  match.forEach(c => {
    const a = first.get(c);
    if (a) {
      const b = c.getBoundingClientRect();
      const dx = a.left - b.left, dy = a.top - b.top, s = a.width / Math.max(1, b.width);
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1 && Math.abs(s - 1) < 0.01) return;
      c.animate([{ transform: `translate(${dx}px,${dy}px) scale(${s})`, transformOrigin: '0 0' }, { transform: 'none', transformOrigin: '0 0' }], { duration: 760, easing: EASE_FLIP });
    } else {
      c.animate([{ opacity: 0, transform: 'translateY(40px) scale(.94)' }, { opacity: 1, transform: 'none' }], { duration: 700, easing: EASE_OUT, delay: 120 + nNew * 60, fill: 'backwards' });
      nNew++;
    }
  });
  GC.wake && GC.wake();
};
chips.forEach(b => b.addEventListener('click', () => apply(b.dataset.f)));
