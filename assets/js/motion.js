/*! Growco motion core — /assets/js/motion.js  (no dependencies, load with `defer`)
 *
 * One requestAnimationFrame loop (all reads, then all writes), IntersectionObserver gating,
 * sleeps when nothing moves, pauses off-screen, honours prefers-reduced-motion.
 * Content stays readable without JS: CSS only hides things under `html.js` (set inline in <head>).
 *
 * DATA-ATTRIBUTE API ----------------------------------------------------------------------------
 *  data-reveal                     Element rises + fades in once when it enters the viewport (or when its
 *                                  [data-reveal-group] reveals). data-reveal-delay="420" (ms → --rv-d),
 *                                  data-reveal-y="30" (px → --rv-y, default 22). Adds .is-on.
 *  data-reveal-group               Container revealed as one (reference behaviour): its [data-reveal],
 *                                  [data-words], [data-odometer], [data-count] children start together,
 *                                  each with its own delay. Optional data-reveal-group="120" = base delay for
 *                                  headlines inside it. Add data-reveal-manual when a script decides the moment
 *                                  (GC.reveal(el)) — e.g. the curtain footer, revealed by site.js.
 *  data-words                      Word-mask headline. Split per word; <br> = new line; <mark>…</mark> words
 *                                  get the marker (green box on light / green text on dark / navy underline
 *                                  on green). data-words-delay="80" data-words-step="55" (hero/CTA: 70),
 *                                  data-marker-delay="500" (box wipe starts N ms after its word lands).
 *  data-marker                     Inline green marker box outside headlines (wipes in on reveal / with its group).
 *                                  data-marker-delay="500" (ms → --pd).
 *  data-odometer[="7"]             Rolling digits; value = attribute or text. data-odometer-turns="2" (KPI
 *                                  odometer, default) | "1" (live roller); data-odometer-stagger="90";
 *                                  data-odometer-dur="1600". Starts on reveal. GC.odometer(el, '12') re-rolls.
 *  data-count="1284300"            Count-up text (easeOutQuart 1400 ms, es-SV format). data-count-dur,
 *                                  data-count-prefix / data-count-suffix, data-count-decimals.
 *  data-ticker                     Marquee: <div class="ticker" data-ticker><div class="ticker__track">
 *                                  <ul class="ticker__list">…</ul></div></div>. The list is cloned once
 *                                  (aria-hidden). --ticker-dur (default 48s). Pauses on hover / off-screen.
 *  data-magnetic                   Magnetic pull ≤ 8 px toward the cursor (fine pointers only). Every .btn
 *                                  gets it automatically; data-magnetic="off" opts out.
 *  data-progress                   Writes --p (0 = top enters at viewport bottom → 1 = bottom leaves at top)
 *                                  and --pin (progress through a pinned wrapper taller than the viewport),
 *                                  lerped .18, only while near the viewport. Reduced motion → 1 / 1.
 *  data-sticky="(min-width:1200px)" Pinned wrapper: .is-pinned while the media query matches and motion is
 *                                  allowed, else .is-flat. Implies data-progress.
 *  data-accordion[="multi"]        Items [data-acc-item] > button[data-acc-trigger] + [data-acc-panel].
 *                                  Single-open by default; data-acc-open="0" opens an item at start.
 *                                  Sets aria-expanded / aria-controls / inert; toggles .is-open on the item.
 *  data-tabs                       Buttons [data-tab] + panels [data-tab-panel] (same order). Roving tabindex,
 *                                  arrows/Home/End. data-autorotate="7000" → auto-advance with --tp (0→1)
 *                                  on the root and the active tab; pauses on hover, focus, off-screen,
 *                                  hidden tab; off under reduced motion. data-tabs-keep → panels are not
 *                                  `hidden`, only .is-active + inert (for cross-fades).
 *  data-parallax="-60"             translateY range in px across the viewport pass (→ --par, CSS uses
 *                                  `translate:0 var(--par)`). 0 under reduced motion.
 *  data-spotlight                  Cursor flashlight: writes --fx/--fy/--fr (px) on the element, lerped
 *                                  .16 / .12. Radius = data-spotlight-r × element height while hovering
 *                                  (default .55). Wanders on touch; .is-still under reduced motion.
 *  data-native-scroll              Inside it the optional smooth wheel never intercepts (scrollable boxes).
 *  <html data-smooth>              Opt-in lightweight smooth wheel scrolling (lerp .1) for mouse users only.
 *
 * EVENTS: 'gc:reveal' (bubbles, on the revealed element) · 'gc:tab' {detail:{index}} · 'gc:accordion'
 *         {detail:{index, open}}.
 * JS API: window.GC = { RM, FINE, bp(), onFrame(fn | {read, write}, {el, margin}), wake(), inView(el, cb,
 *         opts), progress(el, cb, opts), reveal(el), splitWords(el), odometer(el, value, opts),
 *         countUp(el, to, opts), scrollTo(target, {offset}), scan(root), clamp, lerp, ease }
 *         onFrame callbacks return true while they still need frames; the loop sleeps otherwise and wakes on
 *         scroll / resize / pointer / visibility (or GC.wake()).
 */
(() => {
  'use strict';
  const doc = document, html = doc.documentElement;
  const RMq = matchMedia('(prefers-reduced-motion: reduce)');
  const FINEq = matchMedia('(hover: hover) and (pointer: fine)');
  const GC = (window.GC = window.GC || {});
  const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = {
    outCubic: t => 1 - Math.pow(1 - t, 3),
    outQuart: t => 1 - Math.pow(1 - t, 4),
    inOutCubic: t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  };
  const report = (e) => { try { console.error('[GC]', e); } catch (_) { /* noop */ } };
  const num = (v, d) => { const n = parseFloat(v); return Number.isFinite(n) ? n : d; };
  const fmtCache = new Map();
  const nf = (dec = 0) => {
    if (!fmtCache.has(dec)) fmtCache.set(dec, new Intl.NumberFormat('es-SV', { minimumFractionDigits: dec, maximumFractionDigits: dec }));
    return fmtCache.get(dec);
  };
  const bp = () => (innerWidth >= 1200 ? 'desktop' : innerWidth >= 810 ? 'tablet' : 'phone');

  /* ---------------------------------------------------------------- frame loop */
  const subs = new Set();
  /* Re-entrancy: a subscriber may call wake()/onFrame() from inside a frame (e.g. a section activating a
     counter in its write()). That only flags `pending`; the frame schedules exactly ONE follow-up at its end,
     so there is never more than one rAF chain (one callback per vsync). */
  let raf = 0, last = 0, inFrame = false, pending = false;
  function frame(t) {
    raf = 0;
    inFrame = true;
    pending = false;
    const dt = last ? Math.min(64, t - last) : 16.7;
    last = t;
    const act = [];
    subs.forEach(s => { if (s.on) act.push(s); });
    for (const s of act) if (s.read) { try { s.read(t, dt); } catch (e) { report(e); } }
    let more = false;
    for (const s of act) if (s.write) { try { if (s.write(t, dt)) more = true; } catch (e) { report(e); } }
    inFrame = false;
    if ((more || pending) && !doc.hidden) { if (!raf) raf = requestAnimationFrame(frame); }
    else last = 0;
    pending = false;
  }
  function wake() {
    if (inFrame) { pending = true; return; }
    if (!raf && !doc.hidden) raf = requestAnimationFrame(frame);
  }
  function onFrame(fn, opts = {}) {
    const s = typeof fn === 'function' ? { write: fn } : { read: fn.read, write: fn.write };
    s.on = !opts.el;
    subs.add(s);
    let io = null;
    if (opts.el) {
      io = new IntersectionObserver(([e]) => { s.on = e.isIntersecting; if (s.on) wake(); }, { rootMargin: opts.margin || '25% 0px' });
      io.observe(opts.el);
    }
    wake();
    return () => { subs.delete(s); if (io) io.disconnect(); };
  }
  addEventListener('scroll', wake, { passive: true });
  addEventListener('resize', wake, { passive: true });
  addEventListener('pointermove', wake, { passive: true });
  doc.addEventListener('visibilitychange', () => { if (!doc.hidden) wake(); });

  /* ---------------------------------------------------------------- in-view helper */
  function inView(el, cb, { once = true, margin = '0px 0px -6% 0px', threshold } = {}) {
    if (!('IntersectionObserver' in window)) { cb(true); return () => {}; }
    const th = threshold != null ? threshold : Math.min(0.16, Math.max(0.005, (innerHeight * 0.3) / Math.max(1, el.offsetHeight)));
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { cb(true, e); if (once) io.disconnect(); }
      else if (!once) cb(false, e);
    }, { rootMargin: margin, threshold: th });
    io.observe(el);
    return () => io.disconnect();
  }

  /* ---------------------------------------------------------------- word split */
  function splitWords(h) {
    if (!h || h.classList.contains('is-split')) return;
    const group = h.closest('[data-reveal-group]');
    const gBase = group && group !== h ? num(group.getAttribute('data-reveal-group'), NaN) : NaN;
    const base = num(h.dataset.wordsDelay, Number.isFinite(gBase) ? gBase : 80);
    const step = num(h.dataset.wordsStep, 55);
    const mOff = num(h.dataset.markerDelay, 500);
    const lines = [[]];
    const pushWords = (text, acc) => {
      text.split(/(\s+)/).forEach(tok => {
        if (!tok) return;
        if (/^\s+$/.test(tok)) lines[lines.length - 1].push({ space: true });
        else lines[lines.length - 1].push({ w: tok, acc });
      });
    };
    h.childNodes.forEach(n => {
      if (n.nodeType === 3) pushWords(n.nodeValue, false);
      else if (n.nodeType === 1) {
        if (n.tagName === 'BR') lines.push([]);
        else pushWords(n.textContent, n.tagName === 'MARK' || n.classList.contains('mk'));
      }
    });
    const frag = doc.createDocumentFragment();
    let i = 0;
    lines.forEach(line => {
      while (line.length && line[0].space) line.shift();
      while (line.length && line[line.length - 1].space) line.pop();
      if (!line.length) return;
      const l = doc.createElement('span');
      l.className = 'hd-l';
      line.forEach(tok => {
        if (tok.space) { l.appendChild(doc.createTextNode(' ')); return; }
        const w = doc.createElement('span');
        w.className = 'hd-w' + (tok.acc ? ' is-accw' : '');
        w.setAttribute('aria-hidden', 'true');
        const inner = doc.createElement('span');
        const d = base + i++ * step;
        inner.className = 'hd-i' + (tok.acc ? ' is-acc' : '');
        inner.style.transitionDelay = d + 'ms';
        if (tok.acc) w.style.setProperty('--pd', d + mOff + 'ms');
        inner.textContent = tok.w;
        w.appendChild(inner);
        l.appendChild(w);
      });
      frag.appendChild(l);
    });
    const label = lines.map(l => l.filter(t => !t.space).map(t => t.w).join(' ')).filter(Boolean).join(' ');
    h.setAttribute('aria-label', label);
    h.replaceChildren(frag);
    h.classList.add('is-split');
  }

  /* ---------------------------------------------------------------- odometer */
  function buildOdometer(el, text, turns) {
    const cells = turns === 2 ? '01234567890123456789' : '0123456789';
    el.textContent = '';
    const sr = doc.createElement('span');
    sr.className = 'sr';
    sr.textContent = text;
    const vis = doc.createElement('span');
    vis.className = 'odo';
    vis.setAttribute('aria-hidden', 'true');
    for (const ch of text) {
      if (/\d/.test(ch)) {
        const d = doc.createElement('span');
        d.className = 'odo__d';
        const c = doc.createElement('span');
        c.className = 'odo__c';
        c.innerHTML = [...cells].map(x => '<i>' + x + '</i>').join('');
        d.appendChild(c);
        vis.appendChild(d);
      } else {
        const s = doc.createElement('span');
        s.className = 'odo__s';
        s.textContent = ch;
        vis.appendChild(s);
      }
    }
    el.append(sr, vis);
    el.dataset.odoShape = text.replace(/\d/g, '0') + '|' + turns;
  }
  function odometer(el, value, opts = {}) {
    if (!el) return;
    const text = String(value != null ? value : el.dataset.odometer || el.textContent).trim();
    const turns = num(opts.turns != null ? opts.turns : el.dataset.odometerTurns, 2) === 1 ? 1 : 2;
    const stagger = num(opts.stagger != null ? opts.stagger : el.dataset.odometerStagger, turns === 2 ? 90 : 0);
    const dur = num(opts.dur != null ? opts.dur : el.dataset.odometerDur, turns === 2 ? 1600 : 700);
    if (RMq.matches) { el.textContent = text; delete el.dataset.odoShape; return; }
    const shape = text.replace(/\d/g, '0') + '|' + turns;
    if (el.dataset.odoShape !== shape) buildOdometer(el, text, turns);
    else { const sr = el.querySelector('.sr'); if (sr) sr.textContent = text; }
    const digits = text.replace(/\D/g, '');
    const cols = el.querySelectorAll('.odo__c');
    const n = turns === 2 ? 20 : 10;
    const fromRight = !!opts.fromRight;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      cols.forEach((c, i) => {
        const d = +digits[i] || 0;
        const k = fromRight ? cols.length - 1 - i : i;
        c.style.setProperty('--od-dur', dur + 'ms');
        c.style.setProperty('--od-delay', (num(opts.delay, 0) + k * stagger) + 'ms');
        c.style.transform = 'translateY(' + (-(turns === 2 ? 10 + d : d) * (100 / n)) + '%)';
      });
    }));
  }
  function prepOdometer(el) {
    if (RMq.matches || el.dataset.odoShape) return;
    const text = String(el.dataset.odometer || el.textContent).trim();
    if (!/\d/.test(text)) return;
    if (!el.dataset.odometer) el.dataset.odometer = text;
    const turns = num(el.dataset.odometerTurns, 2) === 1 ? 1 : 2;
    buildOdometer(el, text, turns);
  }

  /* ---------------------------------------------------------------- count-up */
  function countUp(el, to, opts = {}) {
    if (!el) return;
    const target = num(to != null ? to : el.dataset.count, 0);
    const dec = num(opts.decimals != null ? opts.decimals : el.dataset.countDecimals, 0);
    const pre = opts.prefix != null ? opts.prefix : el.dataset.countPrefix || '';
    const suf = opts.suffix != null ? opts.suffix : el.dataset.countSuffix || '';
    const dur = num(opts.dur != null ? opts.dur : el.dataset.countDur, 1400);
    const e = opts.ease || ease.outQuart;
    const f = opts.format || (v => nf(dec).format(v));
    const from = num(opts.from, 0);
    if (RMq.matches) { el.textContent = pre + f(target) + suf; return; }
    const t0 = performance.now();
    const step = t => {
      const p = clamp((t - t0) / dur);
      const v = from + (target - from) * e(p);
      el.textContent = pre + f(dec ? v : Math.round(v)) + suf;
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  /* ---------------------------------------------------------------- reveal */
  const ownGroup = (el) => { const g = el.parentElement && el.parentElement.closest('[data-reveal-group]'); return g; };
  function startInner(el) {
    if (el.hasAttribute('data-odometer')) odometer(el);
    if (el.hasAttribute('data-count')) countUp(el);
  }
  function reveal(el, instant) {
    if (!el || el.classList.contains('is-on')) return;
    if (instant) {
      el.setAttribute('data-kb', '');
      requestAnimationFrame(() => requestAnimationFrame(() => el.removeAttribute('data-kb')));
    }
    el.classList.add('is-on');
    if (el.hasAttribute('data-reveal-group')) {
      el.querySelectorAll('[data-reveal],[data-words],[data-marker],[data-odometer],[data-count]').forEach(c => {
        if (ownGroup(c) !== el) return;
        if (instant) { c.setAttribute('data-kb', ''); requestAnimationFrame(() => requestAnimationFrame(() => c.removeAttribute('data-kb'))); }
        c.classList.add('is-on');
        startInner(c);
      });
    } else startInner(el);
    el.dispatchEvent(new CustomEvent('gc:reveal', { bubbles: true }));
  }
  function setupReveal(el) {
    if (el.__gcRv) return;
    el.__gcRv = 1;
    const d = el.getAttribute('data-reveal-delay');
    if (d) el.style.setProperty('--rv-d', num(d, 0) + 'ms');
    const y = el.getAttribute('data-reveal-y');
    if (y) el.style.setProperty('--rv-y', num(y, 22) + 'px');
    const isGroup = el.hasAttribute('data-reveal-group');
    if (!isGroup && ownGroup(el)) return; // its group starts it
    if (RMq.matches) { reveal(el); return; }
    if (el.hasAttribute('data-reveal-manual')) return; // owner script calls GC.reveal(el)
    inView(el, () => reveal(el));
  }
  doc.addEventListener('focusin', e => {
    const t = e.target;
    if (!(t instanceof Element)) return;
    let focusVisible = true;
    try { focusVisible = t.matches(':focus-visible'); } catch (_) { /* old engines */ }
    if (!focusVisible) return;
    let g = t.closest('[data-reveal-group]:not(.is-on)');
    while (g) { reveal(g, true); g = g.parentElement && g.parentElement.closest('[data-reveal-group]:not(.is-on)'); }
    const r = t.closest('[data-reveal]:not(.is-on)');
    if (r) reveal(r, true);
  });

  /* ---------------------------------------------------------------- section progress */
  function progress(el, cb, { lerp: k = 0.18 } = {}) {
    if (RMq.matches) {
      el.style.setProperty('--p', 1); el.style.setProperty('--pin', 1);
      if (cb) cb(1, 1);
      return () => {};
    }
    let top = 0, h = 1, vh = innerHeight, sp = -1, pp = -1, lastW = -9;
    return onFrame({
      read() { const r = el.getBoundingClientRect(); top = r.top; h = r.height; vh = innerHeight; },
      write() {
        const a = clamp((vh - top) / (vh + h));
        const b = h > vh * 1.05 ? clamp(-top / (h - vh)) : a;
        if (sp < 0) { sp = a; pp = b; }
        else {
          sp += (a - sp) * k; pp += (b - pp) * k;
          if (Math.abs(a - sp) < 5e-4) sp = a;
          if (Math.abs(b - pp) < 5e-4) pp = b;
        }
        if (Math.abs(sp + pp - lastW) >= 3e-4) {
          lastW = sp + pp;
          el.style.setProperty('--p', sp.toFixed(4));
          el.style.setProperty('--pin', pp.toFixed(4));
          if (cb) cb(sp, pp);
        }
        return sp !== a || pp !== b;
      },
    }, { el, margin: '25% 0px' });
  }

  /* ---------------------------------------------------------------- sticky (pinned) */
  function setupSticky(el) {
    const q = el.getAttribute('data-sticky') || '(min-width:1200px)';
    const mq = matchMedia(q);
    let stop = null;
    const apply = () => {
      const pin = mq.matches && !RMq.matches;
      el.classList.toggle('is-pinned', pin);
      el.classList.toggle('is-flat', !pin);
      if (pin && !stop) stop = progress(el);
      if (!pin && stop) { stop(); stop = null; el.style.setProperty('--pin', 1); }
    };
    mq.addEventListener ? mq.addEventListener('change', apply) : mq.addListener(apply);
    apply();
  }

  /* ---------------------------------------------------------------- parallax */
  function setupParallax(el) {
    const amt = num(el.getAttribute('data-parallax'), 60);
    if (RMq.matches) { el.style.setProperty('--par', '0px'); return; }
    progress(el, sp => el.style.setProperty('--par', ((sp - 0.5) * amt).toFixed(2) + 'px'));
  }

  /* ---------------------------------------------------------------- ticker */
  function setupTicker(el) {
    const track = el.querySelector('.ticker__track');
    const list = track && track.querySelector('.ticker__list');
    if (!list) return;
    if (!RMq.matches && !track.querySelector('[data-clone]')) {
      const c = list.cloneNode(true);
      c.setAttribute('aria-hidden', 'true');
      c.setAttribute('data-clone', '');
      c.querySelectorAll('a,button,[tabindex]').forEach(n => n.setAttribute('tabindex', '-1'));
      track.appendChild(c);
    }
    el.classList.add('is-ready');
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([e]) => el.classList.toggle('is-off', !e.isIntersecting), { rootMargin: '10% 0px' }).observe(el);
    }
  }

  /* ---------------------------------------------------------------- magnetic (hover only, ≤ 8px) */
  let magEl = null, magRect = null, px = 0, py = 0;
  function setupMagnetic() {
    if (!FINEq.matches || RMq.matches) return;
    doc.addEventListener('pointerover', e => {
      const b = e.target instanceof Element && e.target.closest('[data-magnetic]:not([data-magnetic="off"]),.btn:not([data-magnetic="off"])');
      if (b === magEl) return;
      if (magEl) { magEl.style.removeProperty('--mx'); magEl.style.removeProperty('--my'); }
      magEl = b || null; magRect = null;
    }, { passive: true });
    doc.addEventListener('pointermove', e => { px = e.clientX; py = e.clientY; }, { passive: true });
    addEventListener('scroll', () => { magRect = null; }, { passive: true });
    onFrame({
      read() { if (magEl && !magRect) magRect = magEl.getBoundingClientRect(); },
      write() {
        if (!magEl || !magRect) return false;
        const cx = magRect.left + magRect.width / 2, cy = magRect.top + magRect.height / 2;
        const dx = px - cx, dy = py - cy, d = Math.hypot(dx, dy) || 1;
        const k = Math.min(1, d / Math.max(40, magRect.width / 2)) * 8;
        magEl.style.setProperty('--mx', ((dx / d) * k).toFixed(2) + 'px');
        magEl.style.setProperty('--my', ((dy / d) * k).toFixed(2) + 'px');
        return false;
      },
    });
  }

  /* ---------------------------------------------------------------- spotlight */
  function setupSpotlight(el) {
    if (el.__gcSp) return; el.__gcSp = 1;
    if (RMq.matches) { el.classList.add('is-still'); return; }
    const rk = num(el.getAttribute('data-spotlight-r'), 0.55);
    let fx = -999, fy = -999, fr = 0, tx = 0, ty = 0, tr = 0, inside = false, w = 1, h = 1;
    const t0 = performance.now();
    el.addEventListener('pointermove', e => {
      if (e.pointerType !== 'mouse') return;
      const r = el.getBoundingClientRect();
      tx = e.clientX - r.left; ty = e.clientY - r.top;
      if (fx < -900) { fx = tx; fy = ty; }
      inside = true;
    }, { passive: true });
    el.addEventListener('pointerleave', () => { inside = false; wake(); });
    onFrame({
      read() { w = el.clientWidth; h = el.clientHeight; },
      write(t) {
        const wander = !FINEq.matches;
        if (wander) {
          const s = (t - t0) / 1000;
          tx = w * (0.5 + 0.42 * Math.sin(s * 0.45));
          ty = h * (0.52 + 0.1 * Math.sin(s * 0.9));
          tr = h * (0.42 + 0.16 * Math.sin(s * 2.1));
          if (fx < -900) { fx = tx; fy = ty; }
        } else tr = inside ? h * rk : 0;
        fx += (tx - fx) * 0.16; fy += (ty - fy) * 0.16; fr += (tr - fr) * 0.12;
        el.style.setProperty('--fx', fx.toFixed(1) + 'px');
        el.style.setProperty('--fy', fy.toFixed(1) + 'px');
        el.style.setProperty('--fr', Math.max(0, fr).toFixed(1) + 'px');
        return wander || Math.abs(tr - fr) > 0.3 || Math.abs(tx - fx) > 0.3 || Math.abs(ty - fy) > 0.3;
      },
    }, { el, margin: '10% 0px' });
  }

  /* ---------------------------------------------------------------- accordion */
  let uid = 0;
  const ensureId = (el, p) => el.id || (el.id = p + '-' + (++uid));
  function setupAccordion(root) {
    if (root.__gcAcc) return; root.__gcAcc = 1;
    const multi = root.getAttribute('data-accordion') === 'multi';
    const items = [...root.querySelectorAll('[data-acc-item]')].filter(it => it.closest('[data-accordion]') === root);
    const set = (it, open, i, silent) => {
      const btn = it.querySelector('[data-acc-trigger]'), panel = it.querySelector('[data-acc-panel]');
      it.classList.toggle('is-open', open);
      if (btn) btn.setAttribute('aria-expanded', String(open));
      if (panel) { if (open) panel.removeAttribute('inert'); else panel.setAttribute('inert', ''); }
      if (!silent) root.dispatchEvent(new CustomEvent('gc:accordion', { bubbles: true, detail: { index: i, open } }));
    };
    items.forEach((it, i) => {
      const btn = it.querySelector('[data-acc-trigger]'), panel = it.querySelector('[data-acc-panel]');
      if (!btn || !panel) return;
      btn.setAttribute('aria-controls', ensureId(panel, 'acc-p'));
      panel.setAttribute('role', panel.getAttribute('role') || 'region');
      panel.setAttribute('aria-labelledby', ensureId(btn, 'acc-b'));
      set(it, it.classList.contains('is-open'), i, true);
      btn.addEventListener('click', () => {
        const open = !it.classList.contains('is-open');
        if (open && !multi) items.forEach((o, j) => { if (o !== it && o.classList.contains('is-open')) set(o, false, j); });
        set(it, open, i);
      });
    });
    const first = root.getAttribute('data-acc-open');
    if (first != null && items[+first] && !items.some(it => it.classList.contains('is-open'))) set(items[+first], true, +first, true);
    root.__gcSet = (i, open) => items[i] && set(items[i], open, i);
  }

  /* ---------------------------------------------------------------- tabs (+ autorotate) */
  function setupTabs(root) {
    if (root.__gcTabs) return; root.__gcTabs = 1;
    const tabs = [...root.querySelectorAll('[data-tab]')].filter(t => t.closest('[data-tabs]') === root);
    const panels = [...root.querySelectorAll('[data-tab-panel]')].filter(p => p.closest('[data-tabs]') === root);
    if (!tabs.length) return;
    const keep = root.hasAttribute('data-tabs-keep');
    let elapsed = 0;
    const list = tabs[0].parentElement;
    if (list && !list.getAttribute('role')) list.setAttribute('role', 'tablist');
    let cur = Math.max(0, tabs.findIndex(t => t.classList.contains('is-active') || t.getAttribute('aria-selected') === 'true'));
    const select = (i, { focus = false, silent = false, user = false } = {}) => {
      i = (i + tabs.length) % tabs.length;
      cur = i;
      tabs.forEach((t, j) => {
        const on = j === i;
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
        t.classList.toggle('is-active', on);
        if (!on) t.style.removeProperty('--tp');
      });
      panels.forEach((p, j) => {
        const on = j === i;
        p.classList.toggle('is-active', on);
        if (keep) { if (on) p.removeAttribute('inert'); else p.setAttribute('inert', ''); p.setAttribute('aria-hidden', String(!on)); }
        else p.hidden = !on;
      });
      if (focus) tabs[i].focus();
      if (user) elapsed = 0;
      if (!silent) root.dispatchEvent(new CustomEvent('gc:tab', { bubbles: true, detail: { index: i, user } }));
    };
    tabs.forEach((t, i) => {
      t.setAttribute('role', 'tab');
      if (panels[i]) {
        t.setAttribute('aria-controls', ensureId(panels[i], 'tab-p'));
        panels[i].setAttribute('role', 'tabpanel');
        panels[i].setAttribute('aria-labelledby', ensureId(t, 'tab-b'));
      }
      t.addEventListener('click', () => select(i, { user: true }));
      t.addEventListener('keydown', e => {
        const k = e.key;
        const m = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[k];
        if (m) { e.preventDefault(); select(cur + m, { focus: true, user: true }); }
        else if (k === 'Home') { e.preventDefault(); select(0, { focus: true, user: true }); }
        else if (k === 'End') { e.preventDefault(); select(tabs.length - 1, { focus: true, user: true }); }
      });
    });
    select(cur, { silent: true });
    root.__gcSelect = (i) => select(i, { user: true });
    /* autorotate */
    const period = num(root.getAttribute('data-autorotate'), 0);
    if (!period || RMq.matches) return;
    let hover = false, focusIn = false, visible = false;
    root.addEventListener('pointerenter', () => { hover = true; });
    root.addEventListener('pointerleave', () => { hover = false; wake(); });
    root.addEventListener('focusin', () => { focusIn = true; });
    root.addEventListener('focusout', e => { if (!root.contains(e.relatedTarget)) { focusIn = false; wake(); } });
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) wake(); }, { threshold: 0.25 }).observe(root);
    onFrame((t, dt) => {
      if (!visible) return false;
      if (hover || focusIn) return false;
      elapsed += dt;
      const p = clamp(elapsed / period);
      root.style.setProperty('--tp', p.toFixed(4));
      tabs[cur].style.setProperty('--tp', p.toFixed(4));
      if (p >= 1) { elapsed = 0; select(cur + 1); }
      return true;
    });
  }

  /* ---------------------------------------------------------------- off-screen pause for CSS loops */
  function setupOffscreen(root) {
    if (!('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver(es => es.forEach(e => e.target.classList.toggle('is-off', !e.isIntersecting)), { rootMargin: '15% 0px' });
    root.querySelectorAll('main > section, main > [data-theme], [data-theme]:is(section,footer)').forEach(s => io.observe(s));
  }

  /* ---------------------------------------------------------------- smooth wheel (optional) */
  const smooth = { active: false, target: 0, cur: 0, el: null, off: 0 };
  function setupSmooth() {
    if (!html.hasAttribute('data-smooth') || !FINEq.matches || RMq.matches) return;
    const maxY = () => Math.max(0, doc.documentElement.scrollHeight - innerHeight);
    const scrollableUp = (node) => {
      for (let n = node, i = 0; n && n !== doc.body && n.nodeType === 1 && i < 12; n = n.parentElement, i++) {
        if (n.hasAttribute('data-native-scroll')) return true;
        if (n.scrollHeight > n.clientHeight + 1) {
          const oy = getComputedStyle(n).overflowY;
          if (oy === 'auto' || oy === 'scroll') return true;
        }
      }
      return false;
    };
    addEventListener('wheel', e => {
      if (e.ctrlKey || e.defaultPrevented || html.classList.contains('is-locked')) return;
      let dy = e.deltaY;
      if (e.deltaMode === 1) dy *= 16; else if (e.deltaMode === 2) dy *= innerHeight;
      if (Math.abs(e.deltaX) > Math.abs(dy) || !dy) return;
      if (scrollableUp(e.target)) return;
      e.preventDefault();
      smooth.el = null; // the wheel takes over from an anchor scroll
      if (!smooth.active) { smooth.target = smooth.cur = scrollY; }
      smooth.target = clamp(smooth.target + dy, 0, maxY());
      smooth.active = true;
      wake();
    }, { passive: false });
    addEventListener('scroll', () => {
      if (smooth.active && Math.abs(scrollY - Math.round(smooth.cur)) > 3) { smooth.active = false; smooth.el = null; }
    }, { passive: true });
    onFrame({
      /* anchor scroll: follow the target while it moves (sections above it may change height mid-scroll) */
      read() { if (smooth.active && smooth.el) smooth.target = destOf(smooth.el, smooth.off); },
      write() {
        if (smooth.active && html.classList.contains('is-locked')) smooth.active = false;
        if (!smooth.active) { smooth.el = null; return false; }
        smooth.cur += (smooth.target - smooth.cur) * 0.1;
        if (Math.abs(smooth.target - smooth.cur) < 0.5) { smooth.cur = smooth.target; smooth.active = false; smooth.el = null; }
        window.scrollTo({ top: smooth.cur, behavior: 'instant' });
        return smooth.active;
      },
    });
    GC.smoothOn = true;
  }
  const maxScroll = () => Math.max(0, doc.documentElement.scrollHeight - innerHeight);
  const destOf = (el, off) => clamp(el.getBoundingClientRect().top + scrollY - off, 0, maxScroll());
  /* Native smooth scroll (touch, no smooth wheel): it aims once at click time, so re-check where the target is
     when it settles and correct (≤ 2 times) if it drifted > 4 px. Any user input cancels the correction. */
  function settle(el, off, tries) {
    if (tries <= 0) return;
    let done = false, tm = 0;
    const evs = ['wheel', 'touchstart', 'keydown', 'pointerdown'];
    const stop = () => { done = true; clearTimeout(tm); removeEventListener('scrollend', check); evs.forEach(e => removeEventListener(e, stop, true)); };
    function check() {
      if (done) return;
      stop();
      const y = destOf(el, off);
      if (Math.abs(y - scrollY) > 4) { window.scrollTo({ top: y, behavior: 'smooth' }); settle(el, off, tries - 1); }
    }
    evs.forEach(e => addEventListener(e, stop, { capture: true, passive: true }));
    if ('onscrollend' in window) addEventListener('scrollend', check);
    tm = setTimeout(check, 1500);
  }
  function scrollTo(target, { offset, instant = false } = {}) {
    let y = typeof target === 'number' ? target : 0, el = null, off = 0;
    if (target instanceof Element) {
      el = target;
      /* The smart header hides on the way down and shows on the way up. Every section's top padding already
         clears it, so a downward jump lands the target flush with the top (no strip of the previous section);
         an upward jump keeps the html scroll-padding-top (header visible). An explicit offset wins. */
      const sp = parseFloat(getComputedStyle(html).scrollPaddingTop) || 0;
      const raw = el.getBoundingClientRect().top + scrollY;
      off = offset != null ? offset : (raw > scrollY + 1 ? 0 : sp);
      y = raw - off;
    }
    y = clamp(y, 0, maxScroll());
    if (instant || RMq.matches) { window.scrollTo({ top: y, behavior: 'instant' }); return; }
    if (GC.smoothOn) { if (!smooth.active) smooth.cur = scrollY; smooth.target = y; smooth.el = el; smooth.off = off; smooth.active = true; wake(); return; }
    window.scrollTo({ top: y, behavior: 'smooth' });
    if (el) settle(el, off, 2);
  }

  /* ---------------------------------------------------------------- scan */
  function scan(root = doc) {
    const all = (sel) => root.querySelectorAll(sel);
    all('[data-words]').forEach(splitWords);
    all('[data-odometer]').forEach(prepOdometer);
    all('[data-marker]').forEach(el => { const d = el.getAttribute('data-marker-delay'); if (d) el.style.setProperty('--pd', num(d, 500) + 'ms'); });
    all('[data-reveal],[data-reveal-group],[data-words],[data-marker]').forEach(el => {
      if ((el.hasAttribute('data-words') || el.hasAttribute('data-marker')) && !el.hasAttribute('data-reveal') && !el.hasAttribute('data-reveal-group')) {
        if (el.__gcRv) return; el.__gcRv = 1;
        if (ownGroup(el)) return;
        if (RMq.matches) reveal(el); else inView(el, () => reveal(el));
        return;
      }
      setupReveal(el);
    });
    all('[data-odometer],[data-count]').forEach(el => {
      if (el.__gcNum || el.hasAttribute('data-reveal') || ownGroup(el)) return;
      el.__gcNum = 1;
      if (RMq.matches) startInner(el); else inView(el, () => startInner(el), { threshold: 0.3 });
    });
    all('[data-ticker]').forEach(el => { if (!el.__gcT) { el.__gcT = 1; setupTicker(el); } });
    all('[data-sticky]').forEach(el => { if (!el.__gcS) { el.__gcS = 1; setupSticky(el); } });
    all('[data-progress]').forEach(el => { if (!el.__gcP && !el.hasAttribute('data-sticky')) { el.__gcP = 1; progress(el); } });
    all('[data-parallax]').forEach(el => { if (!el.__gcPx) { el.__gcPx = 1; setupParallax(el); } });
    all('[data-spotlight]').forEach(setupSpotlight);
    all('[data-accordion]').forEach(setupAccordion);
    all('[data-tabs]').forEach(setupTabs);
  }

  Object.assign(GC, {
    RM: RMq.matches, FINE: FINEq.matches, RMq, FINEq, bp, onFrame, wake, inView, progress, reveal, splitWords,
    odometer, countUp, scrollTo, scan, clamp, lerp, ease,
  });
  RMq.addEventListener && RMq.addEventListener('change', () => { GC.RM = RMq.matches; });
  FINEq.addEventListener && FINEq.addEventListener('change', () => { GC.FINE = FINEq.matches; });

  /* Late load: the inline <head> fail-safe drops html.js after 4 s (or at DOMContentLoaded) if this core has
     not run yet, so content is never left hidden. When we do run — even late on a slow connection — put the
     designed JS state back, otherwise widgets would be live but styled for no-JS (stacked tabs, open FAQ). */
  html.classList.add('js');
  try {
    scan(doc);
    setupMagnetic();
    setupOffscreen(doc);
    setupSmooth();
  } catch (e) { report(e); html.classList.remove('js'); }
  html.classList.add('gc-ready');
})();
