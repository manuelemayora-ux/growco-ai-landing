/* 01 · INICIO (#inicio) — reference rwsd (service detail), ref-subpages.md §1, re-implemented in vanilla. v2.
 *
 * Scroll (shared GC loop, read/write phases, only while the section is near the viewport):
 *   --lp   = clamp((0.62·vh − steps.top) / steps.height)      → progress line scaleY on the steps list
 *   count  = number of steps whose top + 30 < 0.62·vh          → .is-on on steps (dot, title, tick draw)
 *   A count change re-keys the stage: scene max(1,count), replayed at 1.4× speed after the first one (--k):
 *     1 guion (script card over the phone, ae-1) · 2 escena generada con IA (phone switches to osmo-ugc-1, CSS by
 *     data-step) · 3 versiones A/B (osmo-ugc-2 vs osmo-ugc-3, same campaign) · 4 entrega (comercial-aventura
 *     reframed 16:9 → 1:1 → 9:16).
 *   The toast remounts as "✓ <paso> · listo", the caption "Paso 0N / 04" and the segment bars follow.
 *   count 0 → scene 1, no toast, no bars.
 * Media: muted -preview.mp4 files play only while their scene is on, the stage is ≥ 35 % visible and the tab is
 *   visible; never under reduced motion / Save-Data. Page-wide budget of 2 playing previews (window.__fVB, shared
 *   with the #resultados gallery). Posters of scenes 3–4 load lazily (first step reached, or idle after load).
 * Loops (scene on + stage visible): 3 — the selected variation alternates A ↔ B every 1.6 s;
 *   4 — the frame reframes 16:9 → 1:1 → 9:16 every 1.7 s.
 * Reduced motion: .is-fin — every step on, line full, scene 04 static (16:9 poster), no autoplay.
 * No JS: the markup shows every step on and scene 01 with its poster (CSS html:not(.js)).
 */
const sec = document.getElementById('inicio');
if (!sec || !sec.classList.contains('f-sd')) return;
const GC = window.GC || {};
const RMq = matchMedia('(prefers-reduced-motion: reduce)');
const stage = sec.querySelector('.f-sd__stage');
const list = sec.querySelector('.f-sd__steps');
const steps = list ? [...list.querySelectorAll('.f-sd__step')] : [];
if (!stage || !steps.length) return;
const N = steps.length;
const $ = (s, r = sec) => r.querySelector(s);
const $$ = (s, r = sec) => [...r.querySelectorAll(s)];
const pad2 = n => String(n).padStart(2, '0');

/* page-wide preview budget (max 2 playing), shared with #resultados — first file to run creates it */
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

const uis = { ph: $('.f-sd__ui--ph', stage), ab: $('.f-sd__ui--ab', stage), wd: $('.f-sd__ui--wd', stage) };
const uiOf = s => (s <= 2 ? uis.ph : s === 3 ? uis.ab : uis.wd);
const toast = $('.f-sd__ptoast', stage);
const toastTx = toast && toast.querySelector('span');
const capN = $('.f-sd__pcap2 b');
const segs = $$('.f-sd__seg i');
const pcap = $('.f-sd__pcap span', stage);
const pcapEl = $('.f-sd__pcap', stage);
const hrt = $('.f-sd__hrt', stage);
const mon = $('.f-sd__mon', stage);
const ratios = $$('.f-sd__ratios b', stage);
const mphs = $$('.f-sd__mph', stage);
const vids = $$('video.f-sd__vid', stage);
const vidsOf = s => (s === 1 ? [$('[data-vid="ae-1"]', stage)] : s === 2 ? [$('[data-vid="osmo-ugc-1"]', stage)] : s === 3 ? $$('.f-sd__ui--ab video', stage) : [$('.f-sd__ui--wd video', stage)]).filter(Boolean);
const saveData = !!(navigator.connection && navigator.connection.saveData);
vids.forEach(v => v.addEventListener('playing', () => v.classList.add('is-playing')));

let count = -1, scene = 0, stageVisible = false;
let timer = 0;
const later = (ms, fn) => { clearTimeout(timer); timer = setTimeout(() => { try { fn(); } catch (e) { console.error('[inicio]', e); } }, ms); };

/* ---------------------------------------------------------------- lazy posters (scenes 3–4) */
let postersAsked = false;
function loadPosters() {
  if (postersAsked) return;
  postersAsked = true;
  $$('img[data-src]', stage).forEach(im => { im.src = im.getAttribute('data-src'); im.removeAttribute('data-src'); });
}

/* ---------------------------------------------------------------- reduced motion: final state, nothing moves */
function setUi(s) {
  Object.values(uis).forEach(u => u && u.classList.toggle('is-on', u === uiOf(s)));
  stage.setAttribute('data-step', String(s));
}
if (RMq.matches || typeof GC.onFrame !== 'function') {
  sec.classList.add('is-fin');
  steps.forEach(s => s.classList.add('is-on'));
  segs.forEach(s => s.classList.add('is-on'));
  if (capN) capN.textContent = pad2(N);
  list.style.setProperty('--lp', 1);
  loadPosters();
  setUi(4);
  return;
}
if ('requestIdleCallback' in window) addEventListener('load', () => requestIdleCallback(loadPosters, { timeout: 4000 }), { once: true });
else addEventListener('load', () => setTimeout(loadPosters, 2500), { once: true });

/* ---------------------------------------------------------------- media + loops */
let abI = 0, fmtI = 0;
function setAB(i) { abI = i % 2; mphs.forEach((m, k) => m.classList.toggle('is-sel', k === abI)); }
function setFmt(f) {
  fmtI = f;
  if (mon) mon.setAttribute('data-f', String(f));
  ratios.forEach((b, k) => b.classList.toggle('is-sel', k === f));
}
function loop() {
  clearTimeout(timer);
  if (!stageVisible || document.hidden) return;
  if (scene === 3) later(1600, () => { setAB(abI + 1); loop(); });
  else if (scene === 4) later(1700, () => { setFmt((fmtI + 1) % 3); loop(); });
}
function syncVideo() {
  const want = new Set(stageVisible && !document.hidden && !saveData ? vidsOf(scene) : []);
  vids.forEach(v => { if (want.has(v)) { if (v.paused) VB.play(v, 2); } else VB.stop(v); });
}

/* ---------------------------------------------------------------- re-key the stage */
const replay = (el) => { if (!el) return; el.classList.remove('is-run'); void el.offsetWidth; el.classList.add('is-run'); };
function showScene(s, first) {
  const prevUi = uiOf(scene || 1);
  const prev = scene;
  scene = s;
  stage.style.setProperty('--k', first ? 1 : 0.714);
  setUi(s);
  const ui = uiOf(s);
  if (s <= 2) {
    if (prev === 0 || prevUi !== ui || s === 1) replay(ui);
    if (pcap && pcapEl) pcap.textContent = pcapEl.getAttribute('data-c' + s) || pcap.textContent;
    if (hrt) { hrt.classList.remove('is-pop'); void hrt.offsetWidth; if (s === 2) hrt.classList.add('is-pop'); }
    if (s === 2) replay(ui);
  } else {
    if (s === 3) setAB(0); else setFmt(0);
    replay(ui);
  }
  syncVideo();
  loop();
}
function setCount(c) {
  if (c === count) return;
  const first = count < 0;
  count = c;
  steps.forEach((s, k) => s.classList.toggle('is-on', k < c));
  segs.forEach((s, k) => s.classList.toggle('is-on', k < c));
  if (capN) capN.textContent = pad2(Math.max(1, c));
  if (c >= 1) loadPosters();
  const s = Math.max(1, c);
  if (s !== scene) showScene(s, first || s === 1);
  if (toast) {
    toast.classList.remove('is-on');
    if (c >= 1) {
      if (toastTx) toastTx.textContent = toast.getAttribute('data-k' + c) || '';
      void toast.offsetWidth;
      toast.classList.add('is-on');
    }
  }
}

/* ---------------------------------------------------------------- scroll: line + active count */
let vh = innerHeight, lTop = 0, lH = 1;
const tops = new Array(N).fill(0);
let lastLp = -1;
GC.onFrame({
  read() {
    vh = innerHeight;
    const r = list.getBoundingClientRect();
    lTop = r.top; lH = r.height || 1;
    for (let i = 0; i < N; i++) tops[i] = steps[i].getBoundingClientRect().top;
  },
  write() {
    const lp = Math.min(1, Math.max(0, (vh * 0.62 - lTop) / lH));
    if (Math.abs(lp - lastLp) > 1e-4) { lastLp = lp; list.style.setProperty('--lp', lp.toFixed(4)); }
    let c = 0;
    for (let i = 0; i < N; i++) if (tops[i] + 30 < vh * 0.62) c++;
    setCount(c);
    return false;
  },
}, { el: sec, margin: '10% 0px' });

/* ---------------------------------------------------------------- visibility gates */
if ('IntersectionObserver' in window) {
  new IntersectionObserver(([e]) => { stageVisible = e.isIntersecting && e.intersectionRatio >= 0.35; syncVideo(); loop(); }, { threshold: [0, 0.35, 0.6] }).observe(stage);
} else { stageVisible = true; }
document.addEventListener('visibilitychange', () => { syncVideo(); loop(); });
vids.forEach(v => v.addEventListener('fvb:evict', () => v.classList.remove('is-playing')));
