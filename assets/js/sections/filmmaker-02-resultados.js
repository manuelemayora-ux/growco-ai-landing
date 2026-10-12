/* 02 · RESULTADOS (#resultados) — reference rwsd band (ref-subpages.md §1) + the "Más trabajo" gallery. v2.
 *
 * v3: OSMO / Academia Europea imagery + facts; +3 Academia Europea UGC reels (ae-2/4/6) in the vertical row (9 pieces).
 * rev1: vertical row = osmo-ugc-1..3, ae-2/4/5/6, video5, video2 (no pixelated-product pieces; no end cards).
 * motion.js reveals the head ([data-reveal-group]: eyebrow 0, words 80 + 55 ms, sub 280), the case cards (300 / 420 ms;
 * .is-on draws their sparkline over 1.6 s, CSS) and the gallery / other-services rows. site.js opens the player for any
 * [data-play] (case "Ver comercial" links are stretched over their card; gallery cards are links to the MP4).
 * This script adds the gallery previews (muted -preview.mp4, created on demand, preload none):
 *   - fine pointer: the hovered / keyboard-focused card plays (priority 3);
 *   - touch / coarse pointer: cards ≥ 60 % visible play, the first two in DOM order (priority 1);
 *   - page-wide budget of 2 playing previews (window.__fVB, shared with the #inicio stage, created here if needed);
 *   - none under reduced motion / Save-Data / hidden tab.
 * Reduced motion: .is-fin (sparklines drawn, CSS). No JS: greyscale posters, links open the MP4 files.
 */
const sec = document.getElementById('resultados');
if (!sec || !sec.classList.contains('f-bd')) return;
const RMq = matchMedia('(prefers-reduced-motion: reduce)');
const FINEq = matchMedia('(hover: hover) and (pointer: fine)');
const SAVE = !!(navigator.connection && navigator.connection.saveData);
if (RMq.matches) { sec.classList.add('is-fin'); return; }
if (SAVE) return;

const VB = window.__fVB || (window.__fVB = (() => {
  const on = new Map(); // video → priority
  return {
    play(v, prio) {
      if (!on.has(v) && on.size >= 2) {
        let low = null;
        on.forEach((p, k) => { if (p < prio && (!low || p < on.get(low))) low = k; });
        if (!low) return false;
        low.pause(); on.delete(low); low.dispatchEvent(new Event('fvb:evict'));
      }
      on.set(v, prio);
      const p = v.play();
      if (p && p.catch) p.catch(() => { on.delete(v); });
      return true;
    },
    stop(v) { if (on.has(v)) on.delete(v); if (!v.paused) v.pause(); },
  };
})());

const items = [...sec.querySelectorAll('.f-bd__it[data-preview]')].map(el => ({ el, name: el.getAttribute('data-preview'), v: null, vis: false, hover: false }));
if (!items.length) return;

function videoOf(it) {
  if (it.v) return it.v;
  const v = document.createElement('video');
  v.muted = true; v.defaultMuted = true; v.loop = true; v.playsInline = true;
  v.setAttribute('muted', ''); v.setAttribute('playsinline', ''); v.setAttribute('aria-hidden', 'true');
  v.setAttribute('disablepictureinpicture', ''); v.tabIndex = -1; v.preload = 'none';
  v.src = `/assets/videos/web/${it.name}-preview.mp4`;
  v.addEventListener('playing', () => it.el.classList.add('is-play'));
  v.addEventListener('pause', () => it.el.classList.remove('is-play'));
  v.addEventListener('fvb:evict', () => it.el.classList.remove('is-play'));
  const im = it.el.querySelector('.f-bd__im');
  im.insertBefore(v, im.querySelector('i'));
  it.v = v;
  return v;
}

function sync() {
  if (document.hidden) { items.forEach(it => it.v && VB.stop(it.v)); return; }
  if (FINEq.matches) {
    items.forEach(it => {
      if (it.hover) VB.play(videoOf(it), 3);
      else if (it.v) VB.stop(it.v);
    });
    return;
  }
  const want = items.filter(it => it.vis).slice(0, 2);
  items.forEach(it => {
    if (want.includes(it)) VB.play(videoOf(it), 1);
    else if (it.v) VB.stop(it.v);
  });
}

items.forEach(it => {
  const on = () => { it.hover = true; sync(); };
  const off = () => { it.hover = false; sync(); };
  it.el.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse' || e.pointerType === 'pen') on(); });
  it.el.addEventListener('pointerleave', off);
  it.el.addEventListener('focus', () => { if (FINEq.matches) on(); });
  it.el.addEventListener('blur', off);
});
if ('IntersectionObserver' in window) {
  const io = new IntersectionObserver(es => {
    es.forEach(e => { const it = items.find(x => x.el === e.target); if (it) it.vis = e.isIntersecting && e.intersectionRatio >= 0.6; });
    if (!FINEq.matches) sync();
  }, { threshold: [0, 0.6, 1] });
  items.forEach(it => io.observe(it.el));
}
document.addEventListener('visibilitychange', sync);
