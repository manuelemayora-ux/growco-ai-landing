/* 08 · CONTENIDO (#contenido) — reference RwFeed (ref-motion §3.17), re-implemented on the shared core.
 *
 * - Column parallax: pure CSS from the section progress --p (motion.js data-progress on the section, lerp .18);
 *   each column: −50 % + static stagger --o + (p − .5)·2·dir·spd·T.
 * - Velocity skew: one GC.onFrame subscriber (only while the section is near the viewport) follows the scroll
 *   velocity like the reference: r += (Δy − r)·.25 → target = clamp(r·.16, ±4°) → sk += (target − sk)·.14,
 *   written as --sk on the wall. Sleeps when settled.
 * - Hover previews (fine pointer): the card's muted -preview.mp4 is created on first hover (preload none), plays
 *   while hovered and ≥50 % visible, max 2 playing (the oldest is paused). A card without data-preview stays poster-only. Click / Enter / Space → site.js player
 *   (data-play on the card).
 * - Keyboard: when a card receives focus outside the visible band of the wall, its column leaves the parallax and
 *   centres that card (--kc) and the page scrolls the wall into view; released when focus leaves the wall.
 * - Reduced motion: no skew, no previews (CSS parks the columns). No JS: static centred columns, posters only.
 */
const sec = document.getElementById('contenido');
if (!sec || !sec.classList.contains('fd')) return;
const GC = window.GC || {};
const wall = sec.querySelector('.fd-wall');
if (!wall) return;
const RMq = matchMedia('(prefers-reduced-motion: reduce)');
const FINEq = matchMedia('(hover: hover) and (pointer: fine)');
const cards = Array.prototype.slice.call(wall.querySelectorAll('.fd-card'));

/* ------------------------------------------------------------------ velocity skew */
if (!RMq.matches && typeof GC.onFrame === 'function') {
  let y0 = -1, y = 0, r = 0, sk = 0, written = '', tPrev = 0;
  GC.onFrame({
    read() { y = window.scrollY; },
    write() {
      // after a sleep (section off-screen / loop idle) the stored y is stale: an anchor jump would read as a huge
      // velocity and kick the wall to 4°. Re-base instead.
      const now = performance.now();
      if (y0 < 0 || now - tPrev > 120) y0 = y;
      tPrev = now;
      const v = y - y0;
      y0 = y;
      r += (v - r) * 0.25;
      const t = Math.max(-4, Math.min(4, r * 0.16));
      sk += (t - sk) * 0.14;
      if (Math.abs(sk) < 0.01 && Math.abs(r) < 0.05) { sk = 0; r = 0; }
      const s = sk.toFixed(2) + 'deg';
      if (s !== written) { written = s; wall.style.setProperty('--sk', s); }
      return sk !== 0 || r !== 0;
    },
  }, { el: sec, margin: '10% 0px' });
}

/* ------------------------------------------------------------------ hover previews (max 2 playing) */
const playing = [];
const visible = new WeakMap();
let io = null;
if ('IntersectionObserver' in window) {
  io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      const ok = e.isIntersecting && e.intersectionRatio >= 0.5;
      visible.set(e.target, ok);
      if (!ok) stop(e.target);
    });
  }, { threshold: [0, 0.5, 1] });
}
function stop(card) {
  const v = card.__fdV;
  if (!v) return;
  try { v.pause(); } catch (_) { /* noop */ }
  v.classList.remove('is-playing');
  const i = playing.indexOf(card);
  if (i > -1) playing.splice(i, 1);
}
function start(card) {
  if (RMq.matches || !FINEq.matches) return;
  if (io && visible.get(card) === false) return;
  const media = card.querySelector('.fd-media');
  const name = media && media.getAttribute('data-preview');
  if (!name || !/^[\w-]+$/.test(name)) return;
  let v = card.__fdV;
  if (!v) {
    v = document.createElement('video');
    v.muted = true; v.defaultMuted = true; v.loop = true; v.playsInline = true;
    v.setAttribute('muted', ''); v.setAttribute('playsinline', ''); v.setAttribute('loop', '');
    v.setAttribute('preload', 'none'); v.setAttribute('aria-hidden', 'true'); v.setAttribute('tabindex', '-1');
    v.disablePictureInPicture = true;
    v.poster = '/assets/videos/web/' + name + '-poster.webp';
    v.src = '/assets/videos/web/' + name + '-preview.mp4';
    v.addEventListener('playing', () => { if (playing.indexOf(card) > -1) v.classList.add('is-playing'); });
    media.insertBefore(v, media.firstChild.nextSibling);
    card.__fdV = v;
  }
  if (playing.indexOf(card) > -1) return;
  while (playing.length >= 2) stop(playing[0]);
  playing.push(card);
  const p = v.play();
  if (p && p.catch) p.catch(() => stop(card));
  else if (!v.paused) v.classList.add('is-playing');
}
cards.forEach(card => {
  if (io) io.observe(card);
  card.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') start(card); });
  card.addEventListener('pointerleave', () => stop(card));
});
// a section that scrolls away stops everything (IO above also covers single cards)
if (typeof GC.inView === 'function') {
  GC.inView(sec, on => { if (!on) playing.slice().forEach(stop); }, { once: false, margin: '0px', threshold: 0 });
}
document.addEventListener('visibilitychange', () => { if (document.hidden) playing.slice().forEach(stop); });

/* ------------------------------------------------------------------ keyboard: keep the focused card in view */
// The wall clips its columns, so a focused card can sit outside the visible band. Its column then leaves the parallax
// and centres that card in the wall (--kc), and the page scrolls the wall into view. Released when focus leaves.
let kbTimer = 0;
const kbEase = () => {
  wall.classList.add('is-kb');
  clearTimeout(kbTimer);
  kbTimer = setTimeout(() => wall.classList.remove('is-kb'), 650);
};
wall.addEventListener('focusin', e => {
  const card = e.target instanceof Element && e.target.closest('.fd-card');
  if (!card) return;
  let focusVisible = true;
  try { focusVisible = card.matches(':focus-visible'); } catch (_) { /* old engines */ }
  if (!focusVisible) return;
  const col = card.parentElement;
  const w = wall.getBoundingClientRect();
  const c = card.getBoundingClientRect();
  const inBand = c.top >= w.top + w.height * 0.12 && c.bottom <= w.top + w.height * 0.88;
  if (inBand && !col.classList.contains('is-kbf')) return;
  sec.querySelectorAll('.fd-col.is-kbf').forEach(x => { if (x !== col) x.classList.remove('is-kbf'); });
  kbEase();
  col.style.setProperty('--kc', -Math.round(card.offsetTop + card.offsetHeight / 2) + 'px');
  col.classList.add('is-kbf');
  if (w.top < 0 || w.bottom > innerHeight) {
    window.scrollBy({ top: (w.top + w.height / 2) - innerHeight / 2, behavior: RMq.matches ? 'instant' : 'smooth' });
  }
});
wall.addEventListener('focusout', e => {
  if (e.relatedTarget instanceof Node && wall.contains(e.relatedTarget)) return;
  if (!sec.querySelector('.fd-col.is-kbf')) return;
  kbEase();
  sec.querySelectorAll('.fd-col.is-kbf').forEach(x => x.classList.remove('is-kbf'));
});
