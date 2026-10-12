/* 04 · SERVICIOS (#servicios) — reference RwServices (ref-motion §3.13), re-implemented in vanilla.
 *
 * Accordion (one panel always open):
 *   - scroll switching (not pinned): --ap = clamp((vh·.72 − top) / (h + vh·.54)) on the accordion box, active index =
 *     floor(ap·N). Read/write through the shared rAF loop (GC.onFrame, only while near the viewport). A switch only
 *     happens when the scroll index changes, and never during a manual hold.
 *   - manual choice (click, hover-intent 140 ms on desktop mouse, arrows / Home / End) holds scroll switching 4 s;
 *     keyboard focus holds it until the pointer moves again.
 *   - ≥1240px horizontal: --ow = accordion width − (N−1)·(cw+8) − cw (fixed content width, copy never re-wraps);
 *     <1240px vertical: --oh = tallest panel content (fixed open slot); heights animated by switchTo() (WAAPI) so the
 *     panels' total, and the page length, never changes mid-switch.
 *   - closed panels' regions are inert; buttons carry aria-expanded / aria-controls.
 * Mini-UIs (run only while their panel is open and the section has revealed; restart on every open):
 *   ads  — segmentation chips pop in, A/B split bars fill, "Anuncio aprobado" toast; Meta ↔ Google preview every 2.8 s.
 *   film — real Growco preview (ae-3, Academia Europea UGC) plays only while open AND ≥50 % visible; heart pop, floating hearts, toast.
 *   chat — WhatsApp-style example conversation with typing indicator, quick reply, "Cita agendada" toast.
 *   inv  — demo KPIs count up, stock bars grow, a sale deducts one unit (14 → 13) + toast.
 *   - phone (≤809px, rev3 2026-10-12): scroll switching is OFF — the open panel is taller than the viewport, so it switched
 *     before its CTA was seen. Tap a panel to open it; the page then scrolls its header under the nav.
 * Fallback: until this script adds .is-ready (end of init) the CSS keeps all four panels open, as without JS.
 * Reduced motion: .is-fin — no scroll switching, no loops, no autoplay; mini-UIs keep their final frame (markup default).
 */
const sec = document.getElementById('servicios');
if (!sec) return;
const acc = sec.querySelector('.sv__acc');
const GC = window.GC;
if (!acc || !GC) return;
const panels = [...acc.querySelectorAll('.sv__p')];
const N = panels.length;
if (!N) return;

const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const FINE = matchMedia('(hover: hover) and (pointer: fine)');
const HQ = matchMedia('(min-width: 1240px)');
const PH = matchMedia('(max-width: 809px)'); // phone: no scroll switching (the tall open panel got cut while scrolling) — tap to open
const now = () => performance.now();
const btns = panels.map(p => p.querySelector('.sv__sp'));
const regions = panels.map(p => p.querySelector('.sv__pc'));
const stages = panels.map(p => p.querySelector('.sv__stage'));
const kinds = panels.map(p => p.getAttribute('data-sv') || '');
const rail = sec.querySelector('.sv__rail');
const segs = rail ? [...rail.querySelectorAll('.sv__seg i')] : [];
const nowB = rail && rail.querySelector('.sv__now b');
const nowName = rail && rail.querySelector('.sv__now > span');
const names = btns.map(b => ((b && b.querySelector('.sv__vt')) || {}).textContent || '');
const pad2 = n => String(n).padStart(2, '0');

let cur = Math.max(0, panels.findIndex(p => p.classList.contains('is-open')));
let hold = 0;            // scroll switching paused until this time
let kbHold = false;      // keyboard focus inside → paused until the pointer moves
let revealed = false;
let ready = false;       // init finished (.is-ready): until then the CSS shows every panel open and nothing may switch
let secVisible = false;  // any part of the section on screen (loops pause otherwise)
let hoverT = -1, hoverId = 0; // hover-intent target / timer (desktop mouse)
if (RM) sec.classList.add('is-fin');

/* ---------------------------------------------------------------- mini-UI controllers */
const timers = new Map(); // stage index → [timeout ids]
const later = (i, ms, fn) => { const id = setTimeout(() => { try { fn(); } catch (e) { console.error('[servicios]', e); } }, ms); timers.get(i).push(id); };
const clearT = (i) => { (timers.get(i) || []).forEach(id => { clearTimeout(id); clearInterval(id); }); timers.set(i, []); };
panels.forEach((_, i) => timers.set(i, []));
const qa = (el, s) => (el ? [...el.querySelectorAll(s)] : []);
const on = (el, v = true) => el && el.classList.toggle('is-on', v);

const UI = {
  ads: {
    reset(st) {
      qa(st, '.sv-a').forEach(el => on(el, false));
      this.plat(st, 0);
    },
    plat(st, g) {
      const p = st.querySelector('.sv-plat');
      if (p) { p.classList.toggle('is-g', !!g); qa(p, 'b').forEach((b, k) => b.classList.toggle('is-on', k === (g ? 1 : 0))); }
      qa(st, '.sv-ad').forEach((a, k) => on(a, k === (g ? 1 : 0)));
    },
    run(st, i) {
      qa(st, '.sv-seg__c li').forEach((li, k) => later(i, 500 + k * 140, () => on(li)));
      qa(st, '.sv-ab__c em').forEach((em, k) => later(i, 900 + k * 160, () => on(em)));
      const t = st.querySelector('.sv-toast');
      later(i, 1850, () => on(t));
      let g = 0;
      const id = setInterval(() => { if (!secVisible || document.hidden) return; g ^= 1; this.plat(st, g); }, 2800);
      timers.get(i).push(id);
    },
  },
  film: {
    reset(st) { qa(st, '.sv-a').forEach(el => on(el, false)); on(st.querySelector('.sv-float'), false); },
    run(st, i) {
      later(i, 700, () => { on(st.querySelector('.sv-hrt')); on(st.querySelector('.sv-float')); });
      later(i, 950, () => on(st.querySelector('.sv-toast')));
    },
  },
  chat: {
    reset(st) {
      qa(st, '.sv-a').forEach(el => on(el, false));
      qa(st, '.sv-qr').forEach(el => el.classList.remove('is-sel'));
      on(st.querySelector('.sv-typing'), false);
    },
    run(st, i) {
      const m = qa(st, '.sv-msg');
      const qr = st.querySelector('.sv-qr');
      const ty = st.querySelector('.sv-typing');
      const log = st.querySelector('.sv-chat__log');
      // keep the typing bubble as the last item of the log
      const typing = (v) => { if (ty && log) { log.appendChild(ty); on(ty, v); } };
      later(i, 350, () => on(m[0]));
      later(i, 750, () => typing(true));
      later(i, 1550, () => { typing(false); on(m[1]); });
      later(i, 1950, () => on(qr));
      later(i, 2650, () => qr && qr.classList.add('is-sel'));
      later(i, 2850, () => on(m[2]));
      later(i, 3150, () => typing(true));
      later(i, 3950, () => { typing(false); on(m[3]); });
      later(i, 4400, () => on(st.querySelector('.sv-toast')));
    },
  },
  inv: {
    reset(st) {
      qa(st, '.sv-a').forEach(el => on(el, false));
      qa(st, '[data-sv-n]').forEach(b => { b.textContent = '0'; });
      const u = st.querySelector('[data-sv-u]');
      if (u) u.textContent = u.getAttribute('data-sv-u');
      const r = st.querySelector('.sv-inv__r--hit');
      if (r) r.classList.remove('is-hit');
    },
    run(st, i) {
      later(i, 300, () => qa(st, '[data-sv-n]').forEach(b => {
        const to = +b.getAttribute('data-sv-n') || 0;
        if (GC.countUp) GC.countUp(b, to, { dur: 1200 }); else b.textContent = String(to);
      }));
      later(i, 420, () => qa(st, '.sv-bar em').forEach(em => on(em)));
      const u = st.querySelector('[data-sv-u]');
      const r = st.querySelector('.sv-inv__r--hit');
      later(i, 1900, () => {
        if (r) r.classList.add('is-hit');
        if (u) u.textContent = u.getAttribute('data-sv-u2') || u.textContent;
        on(st.querySelector('.sv-toast'));
      });
      later(i, 3100, () => r && r.classList.remove('is-hit'));
    },
  },
};

const ui = (i) => UI[kinds[i]];
function prep(i) { // start state (hidden items) for a panel that is not running
  if (RM || !stages[i] || !ui(i)) return;
  stages[i].classList.add('is-pre');
  ui(i).reset(stages[i]);
}
function startUI(i, delay = 0) {
  if (RM || !revealed || !stages[i] || !ui(i)) return;
  clearT(i);
  prep(i);
  if (delay) later(i, delay, () => ui(i).run(stages[i], i));
  else ui(i).run(stages[i], i);
  syncVideo();
}
function stopUI(i) { clearT(i); syncVideo(); }

/* ---------------------------------------------------------------- the real video (panel "film") */
const filmI = kinds.indexOf('film');
const vid = filmI >= 0 ? panels[filmI].querySelector('.sv-phone__vid') : null;
let vidVisible = false;
function syncVideo() {
  if (!vid) return;
  const want = !RM && revealed && cur === filmI && vidVisible && !document.hidden;
  if (want) {
    if (vid.paused) {
      const p = vid.play();
      if (p && p.catch) p.catch(() => { /* autoplay refused: the poster stays */ });
    }
  } else if (!vid.paused) vid.pause();
}
if (vid) {
  vid.addEventListener('playing', () => vid.classList.add('is-playing'));
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([e]) => { vidVisible = e.isIntersecting && e.intersectionRatio >= 0.5; syncVideo(); }, { threshold: [0, 0.5, 1] }).observe(vid);
  }
  document.addEventListener('visibilitychange', syncVideo);
}

/* ---------------------------------------------------------------- open / state */
function paint() {
  panels.forEach((p, k) => {
    const o = k === cur;
    p.classList.toggle('is-open', o);
    if (btns[k]) btns[k].setAttribute('aria-expanded', o ? 'true' : 'false');
    if (regions[k]) regions[k].inert = !o;
  });
  segs.forEach((s, k) => { s.classList.toggle('is-on', k === cur); s.classList.toggle('is-past', k < cur); });
  if (nowB) nowB.textContent = pad2(cur + 1) + ' / ' + pad2(N);
  if (nowName) nowName.textContent = names[cur] || '';
}
/* vertical mode (<1240px): the panel heights are animated here, not by a CSS transition. Every panel is restarted from
   its current (possibly mid-animation) height to its new CSS height with the same duration + curve in the same frame,
   so Σ heights = S·(1−e) + S·e stays exactly the open-slot height (--oh) and nothing below the section moves, however
   fast the switches come. A CSS transition reversed mid-way is shortened by the browser and broke that sum. */
const PANEL_MS = 800;
const PANEL_EASE = 'cubic-bezier(.65,0,.25,1)'; // = --ease-panel
const heightAnims = [];
function stopHeights() { heightAnims.splice(0).forEach(a => { try { a.cancel(); } catch (_) { /* noop */ } }); }
function switchTo(i) {
  const anim = !RM && !HQ.matches && regions.every(r => r && typeof r.animate === 'function');
  const from = anim ? regions.map(r => r.getBoundingClientRect().height) : null;
  stopHeights();
  cur = i;
  paint();
  if (!anim) return;
  const to = regions.map(r => parseFloat(getComputedStyle(r).height) || 0);
  regions.forEach((r, k) => {
    if (Math.abs(from[k] - to[k]) < 0.5) return;
    heightAnims.push(r.animate([{ height: from[k] + 'px' }, { height: to[k] + 'px' }], { duration: PANEL_MS, easing: PANEL_EASE }));
  });
}
function open(i) {
  if (!ready || i === cur || i < 0 || i >= N) return;
  const prev = cur;
  switchTo(i);
  stopUI(prev);
  startUI(i);
}
function pick(i, ms = 4000) {
  hold = kbHold ? Infinity : now() + ms;
  const was = cur;
  open(i);
  if (PH.matches && i !== was && panels[i]) {
    // after the height swap, bring the opened panel's header just under the fixed nav
    setTimeout(() => {
      const y = panels[i].getBoundingClientRect().top + scrollY - 84;
      scrollTo({ top: y, behavior: RM ? 'auto' : 'smooth' });
    }, RM ? 0 : PANEL_MS + 40);
  }
}

/* ---------------------------------------------------------------- measuring (--ow / --oh) */
function measure() {
  if (HQ.matches) {
    const cw = parseFloat(getComputedStyle(acc).getPropertyValue('--cw')) || 104;
    acc.style.setProperty('--ow', Math.max(320, acc.clientWidth - (N - 1) * (cw + 8) - cw) + 'px');
  } else {
    let h = 0;
    panels.forEach(p => { const pin = p.querySelector('.sv__pin'); if (pin) h = Math.max(h, pin.scrollHeight); });
    if (h > 0) acc.style.setProperty('--oh', Math.ceil(h) + 'px');
  }
}
measure();
if ('ResizeObserver' in window) {
  const ro = new ResizeObserver(() => measure());
  ro.observe(acc);
  panels.forEach(p => { const pin = p.querySelector('.sv__pin'); if (pin) ro.observe(pin); });
}
const onMode = () => { hoverT = -1; clearTimeout(hoverId); stopHeights(); measure(); };
if (HQ.addEventListener) HQ.addEventListener('change', onMode); else if (HQ.addListener) HQ.addListener(onMode);

/* ---------------------------------------------------------------- input */
panels.forEach((p, i) => {
  const b = btns[i];
  if (b) {
    b.addEventListener('click', () => pick(i));
    b.addEventListener('keydown', (e) => {
      const k = e.key;
      let r = -1;
      if (k === 'ArrowRight' || k === 'ArrowDown') r = (i + 1) % N;
      else if (k === 'ArrowLeft' || k === 'ArrowUp') r = (i - 1 + N) % N;
      else if (k === 'Home') r = 0;
      else if (k === 'End') r = N - 1;
      if (r < 0) return;
      e.preventDefault();
      pick(r);
      if (btns[r]) btns[r].focus();
    });
    b.addEventListener('focus', () => {
      let fv = false;
      try { fv = b.matches(':focus-visible'); } catch (_) { /* old engines */ }
      if (fv) { kbHold = true; hold = Infinity; }
    });
  }
  // hover intent (desktop mouse, horizontal mode only)
  p.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse' || !FINE.matches || !HQ.matches || (!e.movementX && !e.movementY)) return;
    kbHold = false;
    hold = now() + 4000;
    if (i === cur) { hoverT = i; clearTimeout(hoverId); return; }
    if (hoverT === i) return;
    hoverT = i;
    clearTimeout(hoverId);
    hoverId = setTimeout(() => { if (hoverT === i) open(i); }, 140);
  });
});
acc.addEventListener('pointerleave', () => { clearTimeout(hoverId); hoverT = -1; });
// focus leaving the accordion releases the keyboard hold (scroll switching resumes after the usual 4 s)
acc.addEventListener('focusout', (e) => {
  if (e.relatedTarget && acc.contains(e.relatedTarget)) return;
  if (kbHold) { kbHold = false; hold = now() + 4000; }
});

/* ---------------------------------------------------------------- scroll switching */
if (!RM && N > 1 && GC.onFrame) {
  let top = 0, h = 1, vh = 1, lastIdx = -1, lastAp = -1;
  GC.onFrame({
    read() { const r = acc.getBoundingClientRect(); top = r.top; h = r.height; vh = innerHeight || 1; },
    write() {
      const ap = GC.clamp((vh * 0.72 - top) / (h + vh * 0.54));
      if (Math.abs(ap - lastAp) > 0.002) { lastAp = ap; acc.style.setProperty('--ap', ap.toFixed(3)); }
      const idx = Math.min(N - 1, Math.floor(ap * N));
      if (idx !== lastIdx) { lastIdx = idx; if (!PH.matches && !kbHold && now() > hold) open(idx); }
      return false;
    },
  }, { el: acc, margin: '20% 0px' });
  // the accordion's reveal (28px rise) can finish without a scroll event: wake the shared loop once so the scroll
  // index is re-read at the box's resting position (otherwise it stays as measured mid-reveal until the next scroll)
  acc.addEventListener('transitionend', (e) => {
    if (e.target === acc && (e.propertyName === 'translate' || e.propertyName === 'transform') && GC.wake) GC.wake();
  });
}

/* ---------------------------------------------------------------- visibility + reveal */
if ('IntersectionObserver' in window) {
  new IntersectionObserver(([e]) => { secVisible = e.isIntersecting; }, { rootMargin: '0px' }).observe(sec);
} else secVisible = true;

// .is-ready switches the CSS from the readable fallback (all four panels open) to the accordion. It is set only here,
// after everything above has run, so a missing or failing script (home.js blocked, a runtime error) never leaves
// panels 02-04 collapsed and unreachable.
try {
  paint();
  panels.forEach((_, i) => prep(i));
  sec.classList.add('is-ready');
  measure();
  ready = true;
} catch (e) {
  sec.classList.remove('is-ready');
  regions.forEach(r => { if (r) r.inert = false; });
  stages.forEach(s => { if (s) s.classList.remove('is-pre'); });
  throw e;
}
const onReveal = () => {
  if (revealed) return;
  revealed = true;
  startUI(cur, 380); // the accordion fades up at 380 ms; the open panel's mini-UI starts with it
};
if (sec.classList.contains('is-on')) onReveal();
else sec.addEventListener('gc:reveal', (e) => { if (e.target === sec) onReveal(); });
