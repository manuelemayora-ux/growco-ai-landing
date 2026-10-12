/* 05 · TRABAJO (#trabajo) — reference RwWork (ref-motion §3.14) with Growco's real client cases.
 *
 * Shared pieces: motion.js reveals the section ([data-reveal-group]: eyebrow 0 ms, words 80 + 55 ms, head-right 300,
 * tabs 360, viewer 420, info 480) and runs the tabs ([data-tabs] roving tabindex, arrows/Home/End, 7 s auto-rotation
 * writing --tp, paused on hover / focus / off-screen). site.js opens the player for any [data-play].
 * This script adds:
 *   - case switch: the outgoing case's media cross-fades for .8 s over the incoming one (.is-out, 900 ms), the info
 *     re-rises (CSS), the headline figure rolls (GC.odometer), the strip keeps the active tab in view (phone);
 *   - before/after viewer (OSMO, cost per new account Mar → Sep 2026, index 100 → big figure −43 %; percentages only): --dv/--dt engine with the reference modes — scroll scrub
 *     (st = (vh·.88 − top) / max(80, min(vh·.76, vh·.88 − (vh·.7 − h))), dv .85 → .15, lerp .2), replay after a tab
 *     change (1.7 s easeInOutCubic), manual drag (mouse anywhere; touch from the handle or after a horizontal move
 *     > 8 px), keyboard slider (±5 %, PageUp/Down ±20 %, Home/End); leaving the viewport resets to scroll mode.
 *     The big figure counts (timed, 1.7 s, data-wk-from → data-wk-to, optional data-wk-pre / data-wk-suf, true minus
 *     sign) when the scrub starts and on each replay; it never follows the drag and always lands on the real figure;
 *   - while the scrub is still running (st ≤ .94) the shared auto-rotation is held (reference gate), and while
 *     the player dialog is open (so focus can return to a live control);
 *   - cursor tag ("Arrastra" on the drag case, "Ver video" over a reel of the UGC wall) following the mouse (lerp .22);
 *   - UGC wall previews (Academia Europea): muted 6 s loops only while that case is active and its viewer ≥ 50 %
 *     visible — the hovered / focused reel first, then reels ≥ 60 % in view (phone strip) in order; never more than 2;
 *     paused otherwise / hidden tab; none under reduced motion (posters only). Each reel opens the shared player;
 *   - Valderrama week rows and the reels get their index (--i) for the CSS stagger.
 * All frame work goes through GC.onFrame (one rAF loop), gated to the viewer's vicinity.
 */
const sec = document.getElementById('trabajo');
if (!sec || !sec.classList.contains('wk')) return;
const doc = document;
const GC = window.GC || {};
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const FINE = matchMedia('(hover: hover) and (pointer: fine)').matches;
const clamp = GC.clamp || ((v, a = 0, b = 1) => (v < a ? a : v > b ? b : v));
const inOut = (GC.ease && GC.ease.inOutCubic) || (t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2));
const onFrame = GC.onFrame || null;
const wake = GC.wake || (() => {});

const main = sec.querySelector('.wk-main');
const strip = sec.querySelector('.wk-tabs');
const tabs = [...sec.querySelectorAll('.wk-tab')];
const panels = [...sec.querySelectorAll('.wk-panel')];
if (!main || !panels.length) return;
const views = panels.map(p => p.querySelector('.wk-view'));
const vids = [...sec.querySelectorAll('.wk-vid')];
let cur = Math.max(0, panels.findIndex(p => p.classList.contains('is-active')));

sec.querySelectorAll('.wk-wr').forEach(r => [...r.querySelectorAll('i')].forEach((d, i) => d.style.setProperty('--i', i)));
sec.querySelectorAll('.wk-reels').forEach(r => [...r.children].forEach((d, i) => d.style.setProperty('--i', i)));

/* ---------------------------------------------------------------- auto-rotation hold
 * motion.js pauses its rotation while focus is inside the tabs root (focusin / focusout on the root). A non-bubbling
 * synthetic focusin holds it; a synthetic focusout releases it unless real focus is still inside. */
const holds = new Set();
const fireFocus = (type) => {
  try { main.dispatchEvent(new FocusEvent(type, { bubbles: false, relatedTarget: null })); }
  catch (_) { const e = doc.createEvent('Event'); e.initEvent(type, false, false); main.dispatchEvent(e); }
};
const hold = (why, on) => {
  const had = holds.size > 0;
  if (on) holds.add(why); else holds.delete(why);
  if (holds.size > 0 && !had) fireFocus('focusin');
  else if (!holds.size && had && !main.contains(doc.activeElement)) { fireFocus('focusout'); wake(); }
};
// a real focus leaving the root clears motion.js' flag: re-assert any active hold
main.addEventListener('focusout', e => {
  if (!e.isTrusted || !holds.size || main.contains(e.relatedTarget)) return;
  setTimeout(() => { if (holds.size && !main.contains(doc.activeElement)) fireFocus('focusin'); }, 0);
});

/* ---------------------------------------------------------------- previews (≥ 50 % visible, active case only) */
let viewVisible = false;
const reelHover = new Set();
const reelVis = new Set();
const play = (v) => {
  if (!v.getAttribute('src') && v.dataset.src) v.src = v.dataset.src;
  try { const p = v.play(); if (p && p.catch) p.catch(() => { /* autoplay refused: poster stays */ }); } catch (_) { /* noop */ }
};
const pause = (v) => { try { if (!v.paused) v.pause(); } catch (_) { /* noop */ } };
function syncVideos(restart) {
  let want = [];
  if (!RM && viewVisible && !doc.hidden) {
    const all = [...panels[cur].querySelectorAll('.wk-vid')];
    const reel = (v) => v.closest('.wk-reel');
    const isWall = all.some(reel);
    want = isWall
      ? [...all.filter(v => reelHover.has(reel(v))), ...all.filter(v => reelVis.has(reel(v)) && !reelHover.has(reel(v)))].slice(0, 2)
      : all.slice(0, 2);
  }
  vids.forEach(v => { if (!want.includes(v)) pause(v); });
  want.forEach(v => {
    if (restart && v.readyState > 0) { try { v.currentTime = 0; } catch (_) { /* noop */ } }
    play(v);
  });
}
vids.forEach(v => {
  v.addEventListener('playing', () => v.classList.add('is-on'));
  v.addEventListener('error', () => v.classList.remove('is-on'));
});
if ('IntersectionObserver' in window && views[0]) {
  new IntersectionObserver(([e]) => {
    const vis = e.isIntersecting && e.intersectionRatio >= 0.5;
    if (vis !== viewVisible) { viewVisible = vis; syncVideos(false); }
  }, { threshold: [0, 0.5, 0.75] }).observe(views[0]); // panels share one grid cell → one geometry
}
doc.addEventListener('visibilitychange', () => syncVideos(false));
/* UGC wall: hover / focus promotes a reel; on touch the strip's most visible reels play */
sec.querySelectorAll('.wk-reel').forEach(r => {
  const on = () => { reelHover.clear(); reelHover.add(r); syncVideos(false); };
  const off = () => { if (reelHover.delete(r)) syncVideos(false); };
  r.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse' || e.pointerType === 'pen') on(); });
  r.addEventListener('pointerleave', off);
  r.addEventListener('focus', on);
  r.addEventListener('blur', off);
});
if ('IntersectionObserver' in window) {
  const rio = new IntersectionObserver(es => {
    es.forEach(e => { const r = e.target; if (e.isIntersecting && e.intersectionRatio >= 0.6) reelVis.add(r); else reelVis.delete(r); });
    syncVideos(false);
  }, { threshold: [0, 0.6, 1] });
  sec.querySelectorAll('.wk-reel').forEach(r => rio.observe(r));
}
// keep the greyscale "before" copy on the colour piece's clock (drift > 150 ms → re-seek)
sec.querySelectorAll('.wk-vid-b').forEach(b => {
  const a = b.closest('.wk-case') && b.closest('.wk-case').querySelector('.wk-after .wk-vid');
  if (!a) return;
  a.addEventListener('timeupdate', () => {
    if (b.paused || b.readyState < 2 || !a.duration) return;
    const d = Math.abs(b.currentTime - a.currentTime);
    if (d > 0.15 && d < a.duration - 0.3) { try { b.currentTime = a.currentTime; } catch (_) { /* noop */ } }
  });
});

/* ---------------------------------------------------------------- early image fetch
 * Native lazy loading starts late when the section is reached quickly. The first case's photo goes eager at 1.5
 * viewports; the other cases' photos and the 6 reel posters (~650 KB in total) follow once the section is in view. */
if ('IntersectionObserver' in window) {
  const eager = (sel) => sec.querySelectorAll(sel).forEach(img => { img.loading = 'eager'; });
  const pre = new IntersectionObserver(es => {
    if (!es.some(e => e.isIntersecting)) return;
    pre.disconnect();
    eager('.wk-tab img[loading="lazy"]');
    if (panels[cur]) panels[cur].querySelectorAll('img[loading="lazy"]').forEach(img => { img.loading = 'eager'; });
  }, { rootMargin: '150% 0px 150% 0px' });
  pre.observe(sec);
  const rest = new IntersectionObserver(es => {
    if (!es.some(e => e.isIntersecting)) return;
    rest.disconnect();
    eager('img[loading="lazy"]');
  }, { rootMargin: '0px' });
  rest.observe(main);
}

/* ---------------------------------------------------------------- headline figure roll */
function rollNumeral(panel) {
  const big = panel.querySelector('[data-wk-odo]');
  if (!big || !GC.odometer) return;
  if (RM) { big.textContent = big.getAttribute('data-wk-odo'); return; }
  delete big.dataset.odoShape; // rebuild → digits restart from 0 and roll in
  GC.odometer(big, big.getAttribute('data-wk-odo'), { turns: 2, dur: 1400, stagger: 90, delay: 180 });
}

/* ---------------------------------------------------------------- before/after engine */
const START = 0.85, END = 0.15;
const ab = panels.findIndex(p => p.dataset.kind === 'ab');
const abView = ab >= 0 ? views[ab] : null;
const handle = abView && abView.querySelector('.wk-handle');
const bigAB = abView && abView.querySelector('[data-wk-from]');
const F = bigAB ? {
  from: parseFloat(bigAB.dataset.wkFrom), to: parseFloat(bigAB.dataset.wkTo), pre: bigAB.dataset.wkPre || '',
  suf: bigAB.dataset.wkSuf || '', dec: ((bigAB.dataset.wkTo.split('.')[1]) || '').length,
} : null;
const S = { mode: 'scroll', dv: RM ? END : START, man: END, r0: 0, st: 0, near: false, lastW: -1, lastA: -1, counted: false };
/* the big figure: a timed count from the real before to the real after (1.7 s, same curve as the replay), started
   when the scrub gets going (st > .35) and on every replay. It always lands on the real value and never follows the
   drag, so no invented in-between figure is left on screen (the reference interpolates it with --dt). */
const fmt = (v) => { const a = Math.abs(v).toFixed(F.dec); return (v < 0 && +a !== 0 ? '−' : '') + F.pre + a + F.suf; };
const CNT = { t0: -1, last: '' };
const setNum = (v) => { const s = fmt(v); if (s !== CNT.last) { CNT.last = s; bigAB.textContent = s; } };
function countAB() {
  if (!F) return;
  if (RM || !onFrame) { setNum(F.to); return; }
  CNT.t0 = performance.now();
  setNum(F.from);
  wake();
}
if (F && !RM && onFrame) {
  setNum(F.from);
  onFrame((t) => {
    if (CNT.t0 < 0) return false;
    const e = clamp((t - CNT.t0) / 1700);
    setNum(F.from + (F.to - F.from) * inOut(e));
    if (e >= 1) { CNT.t0 = -1; setNum(F.to); }
    return e < 1;
  });
}
function writeDv(dv) {
  if (!abView) return;
  const dt = clamp((START - dv) / (START - END));
  abView.style.setProperty('--dv', dv.toFixed(4));
  abView.style.setProperty('--dt', dt.toFixed(4));
  const a = Math.round((1 - dv) * 100); // share of the frame showing "después"
  if (a !== S.lastA && handle) {
    S.lastA = a;
    handle.setAttribute('aria-valuenow', String(Math.round(dv * 100)));
    handle.setAttribute('aria-valuetext', a + (handle.dataset.vt || ' %'));
  }
}
function setManual(v) {
  S.mode = 'manual';
  S.man = clamp(v, 0.03, 0.97);
  S.dv = S.man;
  writeDv(S.dv);
  updateGate();
  wake();
}
function updateGate() {
  // reference: the rotation only runs once the scrub has finished (st > .94) or a replay / manual mode is active
  const gate = !RM && ab === cur && S.mode === 'scroll' && S.st <= 0.94;
  hold('scrub', gate);
}
if (abView) {
  if (RM || !onFrame) { S.st = 1; S.mode = 'hold'; } // no scrub → final state, never hold the rotation for it
  writeDv(S.dv);
  if (!RM && onFrame) {
    let top = 0, h = 1, vh = innerHeight;
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([e]) => {
        S.near = e.isIntersecting;
        if (!S.near && S.mode !== 'scroll') { S.mode = 'scroll'; updateGate(); }
        if (S.near) wake();
      }, { rootMargin: '10% 0px 10% 0px' }).observe(abView);
    } else S.near = true;
    onFrame({
      read() { if (ab !== cur) return; const r = abView.getBoundingClientRect(); top = r.top; h = r.height; vh = innerHeight || 1; },
      write(t) {
        if (ab !== cur) return false;
        const span = Math.max(80, Math.min(vh * 0.76, vh * 0.88 - (vh * 0.7 - h)));
        const st = clamp((vh * 0.88 - top) / span);
        const gateWas = S.st <= 0.94;
        S.st = st;
        if (!S.counted && st > 0.35) { S.counted = true; countAB(); }
        let f, anim = false;
        if (S.mode === 'manual') f = S.man;
        else if (S.mode === 'replay') {
          const e = clamp((t - S.r0) / 1700);
          f = START + (END - START) * inOut(e);
          if (e >= 1) S.mode = 'hold';
          anim = true;
        } else if (S.mode === 'hold') f = END;
        else f = START + (END - START) * st;
        if (S.mode === 'manual' || S.mode === 'replay' || S.lastW < 0) S.dv = f;
        else { S.dv += (f - S.dv) * 0.2; if (Math.abs(S.dv - f) < 6e-4) S.dv = f; }
        if (Math.abs(S.dv - S.lastW) > 4e-4 || (S.dv === f && S.dv !== S.lastW)) { S.lastW = S.dv; writeDv(S.dv); }
        if (gateWas !== (st <= 0.94) || anim) updateGate();
        return anim || S.dv !== f;
      },
    }, { el: abView, margin: '25% 0px' });
  }

  /* drag (mouse anywhere; touch from the handle or after a clear horizontal move) */
  let pid = -1, sx = 0, sy = 0, dragging = false;
  const xToV = (x) => { const r = abView.getBoundingClientRect(); return (x - r.left) / Math.max(1, r.width); };
  abView.addEventListener('pointerdown', e => {
    if (e.button > 0 || (e.target instanceof Element && e.target.closest('a,button'))) return;
    pid = e.pointerId; sx = e.clientX; sy = e.clientY;
    dragging = e.pointerType === 'mouse' || (e.target instanceof Element && !!e.target.closest('.wk-handle'));
    if (dragging) {
      try { abView.setPointerCapture(pid); } catch (_) { /* noop */ }
      abView.classList.add('is-drag');
      setManual(xToV(e.clientX));
      if (e.pointerType === 'mouse') e.preventDefault();
    }
  });
  abView.addEventListener('pointermove', e => {
    if (e.pointerId !== pid) return;
    if (!dragging && Math.abs(e.clientX - sx) > 8 && Math.abs(e.clientX - sx) > Math.abs(e.clientY - sy)) {
      dragging = true;
      try { abView.setPointerCapture(pid); } catch (_) { /* noop */ }
      abView.classList.add('is-drag');
    }
    if (dragging) setManual(xToV(e.clientX));
  });
  const end = () => { pid = -1; dragging = false; abView.classList.remove('is-drag'); };
  abView.addEventListener('pointerup', end);
  abView.addEventListener('pointercancel', end);
  abView.addEventListener('lostpointercapture', end);

  /* keyboard slider */
  if (handle) handle.addEventListener('keydown', e => {
    let v = S.mode === 'manual' ? S.man : S.dv;
    switch (e.key) {
      case 'ArrowLeft': case 'ArrowDown': v -= 0.05; break;
      case 'ArrowRight': case 'ArrowUp': v += 0.05; break;
      case 'PageDown': v -= 0.2; break;
      case 'PageUp': v += 0.2; break;
      case 'Home': v = 0.03; break;
      case 'End': v = 0.97; break;
      default: return;
    }
    e.preventDefault();
    setManual(v);
  });
  updateGate();
}

/* ---------------------------------------------------------------- cursor tag */
const cursor = { el: null, view: null, x: 0, y: 0, tx: 0, ty: 0, on: false };
views.forEach((view) => {
  if (!view) return;
  const tag = view.querySelector('.wk-cur');
  if (FINE && tag) {
    view.addEventListener('pointerenter', e => {
      if (e.pointerType !== 'mouse') return;
      const r = view.getBoundingClientRect();
      cursor.el = tag; cursor.view = view; cursor.on = true;
      cursor.tx = cursor.x = e.clientX - r.left; cursor.ty = cursor.y = e.clientY - r.top;
      tag.style.transform = 'translate3d(' + cursor.x.toFixed(1) + 'px,' + cursor.y.toFixed(1) + 'px,0)';
      if (!view.querySelector('.wk-reels')) view.classList.add('is-hov');
      wake();
    });
    view.addEventListener('pointermove', e => {
      if (e.pointerType !== 'mouse' || cursor.view !== view) return;
      const r = view.getBoundingClientRect();
      cursor.tx = e.clientX - r.left; cursor.ty = e.clientY - r.top;
      // UGC wall: the tag only shows over a reel
      if (view.querySelector('.wk-reels')) view.classList.toggle('is-hov', e.target instanceof Element && !!e.target.closest('.wk-reel'));
    }, { passive: true });
    view.addEventListener('pointerleave', () => { view.classList.remove('is-hov'); if (cursor.view === view) cursor.on = false; });
  }
});
if (FINE && onFrame) {
  onFrame(() => {
    if (!cursor.el || !cursor.on) return false;
    cursor.x += (cursor.tx - cursor.x) * 0.22;
    cursor.y += (cursor.ty - cursor.y) * 0.22;
    cursor.el.style.transform = 'translate3d(' + cursor.x.toFixed(1) + 'px,' + cursor.y.toFixed(1) + 'px,0)';
    return Math.abs(cursor.tx - cursor.x) > 0.3 || Math.abs(cursor.ty - cursor.y) > 0.3;
  });
}

/* ---------------------------------------------------------------- player open → hold the rotation until it closes */
doc.addEventListener('click', e => {
  const t = e.target instanceof Element && e.target.closest('[data-play]');
  if (!t || !sec.contains(t)) return;
  hold('player', true);
  const dlg = doc.querySelector('dialog.vp');
  if (dlg && !dlg.__wk) {
    dlg.__wk = 1;
    dlg.addEventListener('close', () => setTimeout(() => hold('player', false), 0));
  } else if (!dlg) setTimeout(() => hold('player', false), 0);
});

/* ---------------------------------------------------------------- case switch */
let outT = 0;
function keepTabVisible(i) {
  const t = tabs[i];
  if (!strip || !t || strip.scrollWidth <= strip.clientWidth + 2) return;
  const pad = parseFloat(getComputedStyle(strip).paddingLeft) || 0;
  const left = t.offsetLeft - pad;
  if (left < strip.scrollLeft || t.offsetLeft + t.offsetWidth > strip.scrollLeft + strip.clientWidth - pad) {
    try { strip.scrollTo({ left, behavior: RM ? 'auto' : 'smooth' }); } catch (_) { strip.scrollLeft = left; }
  }
}
main.addEventListener('gc:tab', e => {
  const i = e.detail && typeof e.detail.index === 'number' ? e.detail.index : -1;
  if (i < 0 || i === cur || !panels[i]) return;
  const prev = panels[cur];
  cur = i;
  panels.forEach(p => p.classList.toggle('is-out', p === prev));
  clearTimeout(outT);
  outT = setTimeout(() => prev.classList.remove('is-out'), 900);
  if (i === ab && abView) {
    if (RM) { S.mode = 'hold'; S.dv = END; writeDv(END); }
    else { S.mode = 'replay'; S.r0 = performance.now(); S.dv = START; writeDv(START); S.counted = true; countAB(); }
  } else rollNumeral(panels[i]);
  updateGate();
  syncVideos(true);
  keepTabVisible(i);
  wake();
});

/* first paint: if the first case is not the drag one, roll its figure when the section reveals */
if (cur !== ab) {
  const go = () => rollNumeral(panels[cur]);
  if (sec.classList.contains('is-on')) go();
  else sec.addEventListener('gc:reveal', ev => { if (ev.target === sec) go(); });
}
