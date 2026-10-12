/* 06 · PREGUNTAS (#faq, SaaSystem v2; was 12-faq) — reference RwFaq (ref-motion §3.21). Copied from home-12-faq.js (fq- → s-fq-).
 *
 * The accordion itself is the shared [data-accordion] (motion.js: single-open, aria-expanded / aria-controls, closed
 * panels inert, Q01 open at start). The entrance is the shared [data-reveal-group] (eyebrow, word-mask H2 with the
 * green box at a fixed ~.7 s, card fade-up at 420 ms / 26 px, rows at 200 + i·60 ms / 18 px).
 *
 * This script adds the scroll progress rail, exactly like the reference:
 *   f = clamp((vh·0.62 − listTop) / listHeight), lerped .18 per frame (snaps under 5e-4), written as --f on the list
 *   only when it moves ≥ 4e-4; a row is "hit" (node lights green) once f ≥ (row.offsetTop + 34) / listHeight.
 * Runs on the shared rAF loop (GC.onFrame, reads before writes) only while the list is near the viewport. Opening or
 * closing a row changes the list height without scrolling, so the loop is kept awake through the .55 s transition.
 * Reduced motion → .is-set (rail full, every node lit, no loop). No JS → CSS shows the same final state.
 */
const sec = document.getElementById('faq');
if (!sec || !sec.classList.contains('s-fq')) return;
const GC = window.GC || {};
const list = sec.querySelector('.s-fq-list');
if (!list) return;
const rows = [...list.querySelectorAll('.s-fq-row')];
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;

if (RM || typeof GC.onFrame !== 'function') {
  sec.classList.add('is-set');
  rows.forEach(r => r.setAttribute('data-hit', ''));
  return;
}

const clamp01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);
let top = 0, h = 1, vh = innerHeight, marks = [];
let cur = -1, written = -1, lastHit = -2, busyUntil = 0;

GC.onFrame({
  read() {
    const r = list.getBoundingClientRect();
    top = r.top; h = r.height || 1; vh = innerHeight;
    marks = rows.map(row => (row.offsetTop + 34) / h);
  },
  write(t) {
    const target = clamp01((vh * 0.62 - top) / h);
    cur = cur < 0 ? target : cur + (target - cur) * 0.18;
    if (Math.abs(cur - target) < 5e-4) cur = target;
    if (Math.abs(cur - written) >= 4e-4) {
      written = cur;
      list.style.setProperty('--f', cur.toFixed(4));
      let hit = -1;
      for (let i = 0; i < marks.length; i++) if (cur >= marks[i]) hit = i;
      if (hit !== lastHit) {
        lastHit = hit;
        rows.forEach((row, i) => row.toggleAttribute('data-hit', i <= hit));
      }
    }
    return cur !== target || performance.now() < busyUntil;
  },
}, { el: list, margin: '20% 0px' });

/* height changes from the accordion (and late font / layout shifts) keep the loop awake briefly */
const keepAwake = (ms) => { busyUntil = performance.now() + ms; if (GC.wake) GC.wake(); };
list.addEventListener('gc:accordion', () => keepAwake(800));
if ('ResizeObserver' in window) new ResizeObserver(() => keepAwake(120)).observe(list);
