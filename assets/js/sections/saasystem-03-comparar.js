/* 03 · COMPARAR (#comparar) — reference rwcm (ref-subpages.md §4).
 *   Rows [data-cmr] light in order and stay lit once their top is < 0.7·vh (desktop table and the visible phone tab).
 *   .is-stuck on the table wrapper while its thead is pinned under the header (shows the ::before cap above it).
 *   --st follows the real header height (bottom of #site-header) so the sticky thead / phone tabs sit right under it.
 * Reduced motion / no GC: .is-fin (every row lit). No JS: CSS defaults (lit).
 */
const sec = document.getElementById('comparar');
if (!sec || !sec.classList.contains('s-cm')) return;
const GC = window.GC || {};
const RMq = matchMedia('(prefers-reduced-motion: reduce)');
const rows = [...sec.querySelectorAll('tr[data-cmr]')];
const tw = sec.querySelector('.s-cm__tw');
const thead = sec.querySelector('.s-cm__t thead');
const header = document.querySelector('#site-header .nav__bar');
if (!rows.length) return;

const setSt = () => {
  const h = header ? Math.round(header.getBoundingClientRect().bottom + 6) : 0;
  sec.style.setProperty('--st', `${Math.max(64, Math.min(96, h || 84))}px`);
};
setSt();
addEventListener('resize', setSt, { passive: true });

if (RMq.matches || !GC.onFrame) { sec.classList.add('is-fin'); rows.forEach(r => r.classList.add('is-lit')); return; }

let tops = [], vh = innerHeight, stuck = false, twTop = 0, twBottom = 0, st = 84;
GC.onFrame({
  read() {
    vh = innerHeight;
    tops = rows.map(r => (r.offsetParent ? r.getBoundingClientRect().top : Infinity));
    if (tw && thead && tw.offsetParent) {
      const r = tw.getBoundingClientRect();
      twTop = r.top; twBottom = r.bottom;
      st = parseFloat(getComputedStyle(sec).getPropertyValue('--st')) || 84;
    }
  },
  write() {
    rows.forEach((r, i) => { if (tops[i] < vh * 0.7) r.classList.add('is-lit'); });
    if (tw) {
      const s = twTop < st && twBottom > st + 160;
      if (s !== stuck) { stuck = s; tw.classList.toggle('is-stuck', s); }
    }
    return false;
  },
}, { el: sec, margin: '0px' });
/* the phone tables re-run their rows when a tab is shown (newly visible rows above 0.7·vh light at once) */
sec.addEventListener('gc:tab', () => GC.wake && GC.wake());
