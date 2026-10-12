/*! Growco site — /assets/js/site.js  (load with `defer`, after motion.js)
 *
 * Shared page behaviour for /, /filmmaker and /SaaSystem:
 *  - Header (#site-header .nav): glass capsule after 40px, hides on scroll down / shows on scroll up,
 *    light/dark adaptation from the data-theme of the section under it (.is-lt), current link
 *    (aria-current="page" by path, also on footer column links; scroll-spy .is-cur on the current page's
 *    own #anchors), entrance.
 *  - Drawer (#nav-drawer): circle reveal from the burger, focus trap, Esc, inert page, scroll lock.
 *  - In-page anchors: smooth scroll (GC.scrollTo), focus moved to the target for keyboard users.
 *  - Lead forms (form[data-lead-form]): one FormSubmit AJAX handler (DECISIONS §5), validation,
 *    honeypot, inline success / error (data kept on error), analytics on success; service preselect
 *    from ?servicio= or any [data-service] click.
 *  - Video dialog: any [data-play="<name>"] opens /assets/videos/web/<name>-720.mp4 in a modal player
 *    (optional data-play-title; data-captions="es[,en]" adds <track>s from /assets/videos/web/<name>.<lang>.vtt;
 *    data-aspect="16:9" sizes the frame for horizontal pieces — default: the video's own size, i.e. the 9:16 pieces);
 *    focus returns to the trigger on close.
 *  - Analytics helpers: GCSite.track(event, params) + delegated [data-track] clicks.
 *  - Clocks [data-clock] (El Salvador time, data-clock="hms|hm"), [data-year], toast, curtain footer
 *    ([data-curtain]), closing-CTA rings centred on [data-rings-anchor].
 *  - WhatsApp: links [data-whatsapp] stay hidden while CONFIG.WHATSAPP_NUMBER is empty.
 */
(() => {
  'use strict';
  const CONFIG = {
    WHATSAPP_NUMBER: '', // e.g. '503XXXXXXXX' — empty keeps every [data-whatsapp] hidden
    FORM_ENDPOINT: 'https://formsubmit.co/ajax/17702b71fab2c0987274c65cc95a555e',
    EMAIL: 'manuel@growcoai.com',
    TZ: 'America/El_Salvador',
    SERVICES: { pauta: 'Pauta digital', filmmaker: 'AI Filmmaker', automatizacion: 'Automatización', stockly: 'Stockly', nose: 'No estoy seguro' },
  };
  const doc = document, html = doc.documentElement;
  const GC = window.GC || {};
  const RM = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (s, r = doc) => r.querySelector(s);
  const $$ = (s, r = doc) => [...r.querySelectorAll(s)];
  const onFrame = GC.onFrame || ((fn) => { const f = () => { const w = typeof fn === 'function' ? fn : fn.write; if (fn.read) fn.read(); w(performance.now(), 16); requestAnimationFrame(f); }; requestAnimationFrame(f); return () => {}; });
  const safe = (name, fn) => { try { fn(); } catch (e) { console.error('[site:' + name + ']', e); } };

  /* ------------------------------------------------------------------ analytics */
  function track(event, params = {}) {
    try { if (typeof window.gtag === 'function') window.gtag('event', event, params); } catch (_) { /* noop */ }
  }
  function trackLead(form, service) {
    try { if (typeof window.gtag === 'function') window.gtag('event', 'generate_lead', { form, service }); } catch (_) { /* noop */ }
    try { if (typeof window.fbq === 'function') window.fbq('track', 'Lead', { content_category: service || 'general' }); } catch (_) { /* noop */ }
  }
  doc.addEventListener('click', e => {
    const t = e.target instanceof Element && e.target.closest('[data-track]');
    if (!t) return;
    track(t.getAttribute('data-track'), {
      id: t.getAttribute('data-track-id') || undefined,
      location: t.getAttribute('data-track-loc') || undefined,
      link_url: t.getAttribute('href') || undefined,
    });
  });

  /* ------------------------------------------------------------------ toast */
  let toastEl = null, toastT = 0;
  function toast(msg, ms = 3800) {
    if (!toastEl) {
      toastEl = doc.createElement('div');
      toastEl.className = 'toast';
      toastEl.setAttribute('role', 'status');
      toastEl.setAttribute('aria-live', 'polite');
      doc.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    requestAnimationFrame(() => toastEl.classList.add('is-on'));
    clearTimeout(toastT);
    toastT = setTimeout(() => toastEl.classList.remove('is-on'), ms);
  }

  /* ------------------------------------------------------------------ WhatsApp config */
  function setupWhatsApp() {
    const n = String(CONFIG.WHATSAPP_NUMBER || '').replace(/\D/g, '');
    $$('[data-whatsapp]').forEach(a => {
      if (!n) { a.hidden = true; return; }
      const txt = a.getAttribute('data-whatsapp') || '';
      a.href = 'https://wa.me/' + n + (txt ? '?text=' + encodeURIComponent(txt) : '');
      a.hidden = false;
    });
  }

  /* ------------------------------------------------------------------ header */
  const nav = $('.nav');
  const drawer = $('#nav-drawer');
  let drawerOpen = false;
  let refreshTheme = () => {};

  function setupHeader() {
    if (!nav) return;
    /* entrance */
    requestAnimationFrame(() => setTimeout(() => nav.classList.add('is-in'), 40));

    /* glass + hide/show */
    let lastY = scrollY, ticking = false;
    const upd = () => {
      ticking = false;
      const y = scrollY;
      nav.classList.toggle('is-glass', y > 40);
      if (Math.abs(y - lastY) > 6) {
        const down = y > lastY;
        const hide = down && y > 140 && !drawerOpen && !nav.matches(':focus-within');
        nav.classList.toggle('is-hid', hide);
        lastY = y;
      }
    };
    addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(upd); } }, { passive: true });
    nav.addEventListener('focusin', () => nav.classList.remove('is-hid'));
    upd();

    /* light/dark probe: a 1px band at y = 40 px; topmost (DOM-first) themed block wins */
    let blocks = [];
    const hit = new Set();
    let io = null;
    const apply = () => {
      const cur = blocks.find(b => hit.has(b));
      const theme = cur ? cur.getAttribute('data-theme') : 'dark';
      nav.classList.toggle('is-lt', theme === 'light' || theme === 'accent');
      nav.dataset.on = theme;
    };
    const build = () => {
      if (io) io.disconnect();
      hit.clear();
      blocks = $$('[data-theme]').filter(el => !el.parentElement.closest('[data-theme]'));
      const bottom = Math.max(0, innerHeight - 41);
      io = new IntersectionObserver(es => { es.forEach(e => (e.isIntersecting ? hit.add(e.target) : hit.delete(e.target))); apply(); },
        { rootMargin: '-40px 0px -' + bottom + 'px 0px' });
      blocks.forEach(b => io.observe(b));
    };
    refreshTheme = build;
    if ('IntersectionObserver' in window) {
      build();
      let rt = 0;
      addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(build, 150); }, { passive: true });
    }

    /* current link */
    const path = location.pathname.replace(/\/+$/, '').replace(/\.html$/, '').toLowerCase() || '/';
    const links = $$('.nav__lk a, .drw__list a');
    const lpOf = u => u.pathname.replace(/\/+$/, '').replace(/\.html$/, '').toLowerCase() || '/';
    [...links, ...$$('.ft__col a')].forEach(a => {
      const href = a.getAttribute('href') || '';
      if (href.charAt(0) === '#') return; // in-page anchors and placeholder "#" links are never the current page
      const u = new URL(href, location.href);
      if (!u.hash && lpOf(u) === path && u.origin === location.origin) a.setAttribute('aria-current', 'page');
    });
    /* scroll-spy on this page's own anchors (home: /#servicios…; sub-pages: #trabajos…) */
    if ('IntersectionObserver' in window) {
      const map = new Map();
      links.forEach(a => {
        const u = new URL(a.getAttribute('href'), location.href);
        if (u.origin !== location.origin || lpOf(u) !== path) return;
        const h = u.hash;
        const t = h && doc.getElementById(decodeURIComponent(h.slice(1)));
        if (t) { if (!map.has(t)) map.set(t, []); map.get(t).push(a); }
      });
      const vis = new Set();
      const spy = new IntersectionObserver(es => {
        es.forEach(e => (e.isIntersecting ? vis.add(e.target) : vis.delete(e.target)));
        const order = [...map.keys()];
        const cur = order.find(t => vis.has(t));
        links.forEach(a => a.classList.remove('is-cur'));
        if (cur) map.get(cur).forEach(a => a.classList.add('is-cur'));
      }, { rootMargin: '-45% 0px -50% 0px' });
      map.forEach((_, t) => spy.observe(t));
    }
  }

  /* ------------------------------------------------------------------ drawer */
  function setupDrawer() {
    const burger = $('.nav__burger');
    if (!nav || !drawer || !burger) return;
    const outside = () => $$('body > *:not(.nav):not(#nav-drawer):not(script):not(style):not(.toast):not(dialog)');
    const focusables = () => [...$$('a[href],button:not([disabled]),[tabindex]:not([tabindex="-1"])', nav), ...$$('a[href],button:not([disabled]),input,select,textarea,[tabindex]:not([tabindex="-1"])', drawer)]
      .filter(el => !el.hidden && el.offsetParent !== null && getComputedStyle(el).visibility !== 'hidden');
    const setPos = () => {
      const r = burger.getBoundingClientRect();
      const bx = r.left + r.width / 2, by = r.top + r.height / 2;
      const br = Math.hypot(Math.max(bx, innerWidth - bx), Math.max(by, innerHeight - by)) + 8;
      drawer.style.setProperty('--bx', bx.toFixed(1) + 'px');
      drawer.style.setProperty('--by', by.toFixed(1) + 'px');
      drawer.style.setProperty('--br', br.toFixed(1) + 'px');
    };
    const open = () => {
      if (drawerOpen) return;
      drawerOpen = true;
      nav.classList.remove('is-hid');
      setPos();
      drawer.removeAttribute('inert');
      drawer.setAttribute('aria-hidden', 'false');
      nav.classList.add('is-open');
      drawer.classList.add('is-open');
      burger.setAttribute('aria-expanded', 'true');
      burger.setAttribute('aria-label', 'Cerrar menú');
      html.classList.add('is-locked', 'menu-open');
      outside().forEach(el => el.setAttribute('inert', ''));
      const first = $('.drw__list a', drawer);
      setTimeout(() => first && first.focus({ preventScroll: true }), RM() ? 0 : 120);
      track('menu_open', { location: 'drawer' });
    };
    const close = (returnFocus = true) => {
      if (!drawerOpen) return;
      drawerOpen = false;
      nav.classList.remove('is-open');
      drawer.classList.remove('is-open');
      drawer.setAttribute('aria-hidden', 'true');
      drawer.setAttribute('inert', '');
      burger.setAttribute('aria-expanded', 'false');
      burger.setAttribute('aria-label', 'Abrir menú');
      html.classList.remove('is-locked', 'menu-open');
      outside().forEach(el => el.removeAttribute('inert'));
      if (returnFocus) burger.focus({ preventScroll: true });
    };
    drawer.setAttribute('inert', '');
    drawer.setAttribute('aria-hidden', 'true');
    burger.addEventListener('click', () => (drawerOpen ? close() : open()));
    drawer.addEventListener('click', e => {
      const a = e.target instanceof Element && e.target.closest('a[href]');
      if (a) close(false);
    });
    /* header links stay usable while the drawer is open (logo, "Hablemos"): following one closes it too */
    nav.addEventListener('click', e => {
      const a = drawerOpen && e.target instanceof Element && e.target.closest('a[href]');
      if (a) close(false);
    });
    doc.addEventListener('keydown', e => {
      if (!drawerOpen) return;
      if (e.key === 'Escape') { e.preventDefault(); close(); return; }
      if (e.key !== 'Tab') return;
      const f = focusables();
      if (!f.length) return;
      const i = f.indexOf(doc.activeElement);
      if (e.shiftKey && (i <= 0)) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && (i === f.length - 1 || i === -1)) { e.preventDefault(); f[0].focus(); }
    });
    matchMedia('(min-width:1200px)').addEventListener('change', e => { if (e.matches) close(false); });
    addEventListener('resize', () => { if (drawerOpen) setPos(); }, { passive: true });
  }

  /* ------------------------------------------------------------------ in-page anchors */
  function setupAnchors() {
    doc.addEventListener('click', e => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = e.target instanceof Element && e.target.closest('a[href*="#"]');
      if (!a || a.target === '_blank') return;
      const u = new URL(a.getAttribute('href'), location.href);
      if (u.origin !== location.origin || u.pathname.replace(/\/+$/, '') !== location.pathname.replace(/\/+$/, '') || !u.hash || u.hash === '#') return;
      const t = doc.getElementById(decodeURIComponent(u.hash.slice(1)));
      if (!t) return;
      e.preventDefault();
      const go = () => {
        if (GC.scrollTo) GC.scrollTo(t); else t.scrollIntoView({ behavior: RM() ? 'auto' : 'smooth' });
        if (history.pushState) history.pushState(null, '', u.hash); else location.hash = u.hash;
        if (!t.hasAttribute('tabindex') && !/^(A|BUTTON|INPUT|SELECT|TEXTAREA)$/.test(t.tagName)) t.setAttribute('tabindex', '-1');
        t.focus({ preventScroll: true });
      };
      if (drawerOpen) setTimeout(go, 30); else go();
    });
  }

  /* ------------------------------------------------------------------ lead forms */
  const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(new RegExp('[' + String.fromCharCode(0x300) + '-' + String.fromCharCode(0x36f) + ']', 'g'), '').replace(/[^a-z]/g, '');
  const ALIASES = { pauta: 'pauta', pautadigital: 'pauta', ads: 'pauta', filmmaker: 'filmmaker', aifilmmaker: 'filmmaker', video: 'filmmaker', automatizacion: 'automatizacion', automation: 'automatizacion', stockly: 'stockly', saasystem: 'stockly', nose: 'nose', noestoyseguro: 'nose' };
  const serviceKey = v => ALIASES[norm(v)] || '';
  function preselect(key) {
    const k = serviceKey(key);
    if (!k) return;
    $$('form[data-lead-form] select[name="servicio"]').forEach(s => { if ([...s.options].some(o => o.value === k)) s.value = k; });
  }
  function setupForms() {
    const forms = $$('form[data-lead-form]');
    if (!forms.length) return;
    const qs = new URLSearchParams(location.search);
    if (qs.get('servicio')) preselect(qs.get('servicio'));
    doc.addEventListener('click', e => {
      const t = e.target instanceof Element && e.target.closest('[data-service]');
      if (t && !t.closest('form')) preselect(t.getAttribute('data-service'));
    });
    const pageName = (doc.body && doc.body.getAttribute('data-page-name')) || doc.title.split(/[|—-]/)[0].trim() || 'Inicio';
    forms.forEach(form => {
      const status = $('.ct__status,[data-form-status]', form);
      const btn = $('button[type="submit"]', form);
      const lbls = btn ? $$('.btn__l1,.btn__l2', btn) : [];
      const btnText = lbls.length ? lbls[0].textContent : (btn ? btn.textContent : '');
      const formId = form.getAttribute('data-lead-form') || form.id || 'lead';
      form.noValidate = true; // JS validates inline; without JS the native `required` checks apply
      // one-line message cell that grows with its text (CSS field-sizing does it natively in Chromium)
      $$('textarea[data-autogrow]', form).forEach(ta => {
        const cell = ta.closest('.fld');
        const MAX = 132;
        const fit = () => {
          ta.style.height = 'auto';
          const h = Math.min(ta.scrollHeight, MAX);
          ta.style.height = h + 'px';
          ta.style.overflowY = ta.scrollHeight > MAX ? 'auto' : 'hidden';
          if (cell) cell.classList.toggle('is-tall', h > 30);
        };
        ta.addEventListener('input', fit);
        form.addEventListener('reset', () => requestAnimationFrame(fit));
        fit();
      });
      if (qs.get('enviado') === '1' && status) {
        status.className = status.className.replace(/\bis-err\b/, '').trim();
        status.textContent = '¡Gracias! Recibimos tu mensaje. Te responderemos con una propuesta.';
      }
      const fields = {
        nombre: $('[name="nombre"]', form),
        email: $('[name="email"]', form),
        servicio: $('[name="servicio"]', form),
      };
      const MSG = { nombre: 'Escribe tu nombre.', email: 'Revisa tu correo.', servicio: 'Elige uno.' };
      const errEl = input => { const f = input && input.closest('.fld'); return f && $('.fld__err', f); };
      const setErr = (input, msg) => {
        if (!input) return;
        const f = input.closest('.fld'); const e = errEl(input);
        if (f) f.classList.toggle('is-err', !!msg);
        if (e) e.textContent = msg || '';
        if (msg) input.setAttribute('aria-invalid', 'true'); else input.removeAttribute('aria-invalid');
      };
      const check = (key) => {
        const input = fields[key];
        if (!input) return true;
        const v = String(input.value || '').trim();
        let ok = !!v;
        if (key === 'email') ok = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
        setErr(input, ok ? '' : MSG[key]);
        return ok;
      };
      let tried = false;
      Object.keys(fields).forEach(k => {
        const el = fields[k];
        if (!el) return;
        const e = errEl(el);
        if (e) { if (!e.id) e.id = (form.id || 'f') + '-' + k + '-err'; el.setAttribute('aria-describedby', e.id); }
        el.addEventListener(el.tagName === 'SELECT' ? 'change' : 'blur', () => { if (tried) check(k); });
        el.addEventListener('input', () => { if (tried && el.getAttribute('aria-invalid')) check(k); });
      });
      const setBusy = (busy) => {
        if (!btn) return;
        btn.disabled = busy;
        btn.setAttribute('aria-busy', String(busy));
        lbls.forEach(l => { l.textContent = busy ? 'Enviando…' : btnText; });
        if (!lbls.length) btn.textContent = busy ? 'Enviando…' : btnText;
      };
      const show = (msg, err) => {
        if (!status) return;
        status.classList.toggle('is-err', !!err);
        status.setAttribute('role', err ? 'alert' : 'status');
        status.innerHTML = msg;
      };
      form.addEventListener('submit', async e => {
        e.preventDefault();
        tried = true;
        const okAll = ['nombre', 'email', 'servicio'].map(check);
        const firstBad = ['nombre', 'email', 'servicio'].find((k, i) => !okAll[i]);
        if (firstBad) { fields[firstBad].focus(); show('Revisa los campos marcados.', true); return; }
        const data = Object.fromEntries(new FormData(form).entries());
        const svcKey = data.servicio || '';
        const svcName = CONFIG.SERVICES[svcKey] || svcKey;
        if (data._honey) { form.reset(); show('¡Gracias! Recibimos tu mensaje.'); return; }
        delete data._next;
        data._subject = 'Nueva solicitud de propuesta — ' + (form.getAttribute('data-page-name') || pageName);
        data.servicio = svcName;
        data.pagina = location.href.split('#')[0];
        setBusy(true);
        show('Enviando tu solicitud…');
        try {
          const res = await fetch(CONFIG.FORM_ENDPOINT, {
            method: 'POST',
            // form-encoded, not JSON: FormSubmit ignored JSON bodies on the alias endpoint (empty emails, default subject)
            headers: { Accept: 'application/json' },
            body: new URLSearchParams(data),
          });
          let out = {};
          try { out = await res.json(); } catch (_) { /* non-JSON */ }
          if (!res.ok || String(out.success) !== 'true') throw new Error(out.message || 'HTTP ' + res.status);
          const name = String(data.nombre || '').trim().split(/\s+/)[0];
          form.reset();
          tried = false;
          form.classList.add('is-sent');
          show('<strong>¡Listo' + (name ? ', ' + escapeHtml(name) : '') + '!</strong> Recibimos tu mensaje. Te responderemos con una propuesta para tu marca.');
          if (status) { status.tabIndex = -1; status.focus({ preventScroll: true }); }
          trackLead(formId, svcKey || 'general');
        } catch (err) {
          show('No pudimos enviar tu mensaje. Inténtalo de nuevo o escríbenos a <a href="mailto:' + CONFIG.EMAIL + '">' + CONFIG.EMAIL + '</a>.', true);
          if (status) { status.tabIndex = -1; status.focus({ preventScroll: true }); }
          track('form_error', { form: formId, message: String(err && err.message || err).slice(0, 80) });
        } finally {
          setBusy(false);
        }
      });
      form.addEventListener('input', () => form.classList.remove('is-sent'));
    });
  }
  function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

  /* ------------------------------------------------------------------ video dialog */
  let vp = null, vpTrigger = null;
  function buildPlayer() {
    vp = doc.createElement('dialog');
    vp.className = 'vp ctx-dark';
    vp.setAttribute('aria-labelledby', 'vp-title');
    vp.innerHTML =
      '<div class="vp__in">' +
      '<video class="vp__v" controls playsinline preload="none"></video>' +
      '<div class="vp__bar"><p class="vp__t" id="vp-title">Video</p>' +
      '<button type="button" class="vp__x" aria-label="Cerrar video"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>' +
      '</div>';
    doc.body.appendChild(vp);
    const v = $('video', vp);
    $('.vp__x', vp).addEventListener('click', () => vp.close());
    vp.addEventListener('click', e => { if (e.target === vp) vp.close(); });
    vp.addEventListener('close', () => {
      try { v.pause(); } catch (_) { /* noop */ }
      v.removeAttribute('src'); v.load();
      html.classList.remove('is-locked');
      if (vpTrigger) vpTrigger.focus({ preventScroll: true });
      vpTrigger = null;
    });
  }
  function openPlayer(name, title, trigger) {
    if (!/^[\w-]+$/.test(name || '')) return;
    if (!vp) buildPlayer();
    const v = $('video', vp);
    $('.vp__t', vp).textContent = title || 'Video';
    v.setAttribute('aria-label', title || 'Video');
    /* aspect: data-aspect="16:9" on the trigger sizes the frame before the poster / metadata arrive (no 300×150
       flash, no reflow). Without it the frame follows the video's intrinsic size (the vertical 9:16 pieces). */
    const ar = /^(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)$/.exec(String((trigger && trigger.getAttribute('data-aspect')) || '').trim());
    vp.classList.toggle('vp--ar', !!ar);
    if (ar) { vp.style.setProperty('--vp-aw', ar[1]); vp.style.setProperty('--vp-ah', ar[2]); }
    else { vp.style.removeProperty('--vp-aw'); vp.style.removeProperty('--vp-ah'); }
    v.poster = '/assets/videos/web/' + name + '-poster.webp';
    /* captions (WCAG 1.2.2): data-captions="es" | "es,en" on the trigger → /assets/videos/web/<name>.<lang>.vtt */
    $$('track', v).forEach(t => t.remove());
    const caps = String((trigger && trigger.getAttribute('data-captions')) || '').split(/[\s,]+/).filter(l => /^[a-z]{2}$/.test(l));
    const LANG = { es: 'Español', en: 'English' };
    caps.forEach((l, i) => {
      const tr = doc.createElement('track');
      tr.kind = 'captions'; tr.srclang = l; tr.label = LANG[l] || l;
      tr.src = '/assets/videos/web/' + name + '.' + l + '.vtt';
      if (i === 0) tr.default = true;
      v.appendChild(tr);
    });
    v.src = '/assets/videos/web/' + name + '-720.mp4';
    vpTrigger = trigger || null;
    if (typeof vp.showModal === 'function') vp.showModal(); else vp.setAttribute('open', '');
    html.classList.add('is-locked');
    const p = v.play();
    if (p && p.catch) p.catch(() => { /* autoplay with sound may be blocked: controls remain */ });
    $('.vp__x', vp).focus({ preventScroll: true });
    track('video_play', { video: name, location: (trigger && trigger.getAttribute('data-track-loc')) || undefined });
  }
  function setupPlayer() {
    doc.addEventListener('click', e => {
      const t = e.target instanceof Element && e.target.closest('[data-play]');
      if (!t) return;
      e.preventDefault();
      openPlayer(t.getAttribute('data-play'), t.getAttribute('data-play-title') || t.getAttribute('aria-label') || '', t);
    });
  }

  /* ------------------------------------------------------------------ clocks + year */
  function setupClocks() {
    $$('[data-year]').forEach(el => { el.textContent = String(new Date().getFullYear()); });
    const clocks = $$('[data-clock]');
    if (!clocks.length) return;
    const f = {};
    const get = (k) => f[k] || (f[k] = new Intl.DateTimeFormat('es-SV', k === 'hms'
      ? { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: CONFIG.TZ }
      : { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: CONFIG.TZ }));
    /* only the clocks on screen tick (they sit in #contacto and the footer, off-screen most of the time) */
    const vis = new Set(clocks);
    const tick = () => {
      if (doc.hidden) return;
      const now = new Date();
      vis.forEach(c => { const k = c.getAttribute('data-clock') === 'hms' ? 'hms' : 'hm'; const s = get(k).format(now); if (c.textContent !== s) c.textContent = s; });
    };
    tick();
    vis.clear();
    let iv = 0;
    const sync = () => {
      if (vis.size && !iv) { tick(); iv = setInterval(tick, 1000); }
      else if (!vis.size && iv) { clearInterval(iv); iv = 0; }
    };
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver(es => { es.forEach(e => (e.isIntersecting ? vis.add(e.target) : vis.delete(e.target))); sync(); }, { rootMargin: '10% 0px' });
      clocks.forEach(c => io.observe(c));
    } else { clocks.forEach(c => vis.add(c)); sync(); }
  }

  /* ------------------------------------------------------------------ curtain footer */
  function setupCurtain() {
    const w = $('[data-curtain]');
    /* manual reveal groups outside a curtain fall back to a normal in-view reveal */
    $$('[data-reveal-manual]').forEach(g => {
      if (w && w.contains(g)) return;
      if (GC.inView && GC.reveal) GC.inView(g, () => GC.reveal(g)); else g.classList.add('is-on');
    });
    if (!w) return;
    const inner = w.firstElementChild;
    let H = 0, top = 0, vh = innerHeight, rv = -1;
    const measure = () => { H = inner.offsetHeight; w.style.setProperty('--h', H + 'px'); };
    measure();
    if ('ResizeObserver' in window) new ResizeObserver(measure).observe(inner);
    w.classList.add('is-act');
    const tOf = () => Math.min(H, vh);
    const group = $('[data-reveal-manual]', w);
    let shown = false;
    onFrame({
      read() { top = w.getBoundingClientRect().top; vh = innerHeight; },
      write() {
        const t = tOf() || 1;
        const v = Math.max(0, Math.min(1, (vh - (top + t)) / t));
        if (Math.abs(v - rv) > 1e-3) { rv = v; w.style.setProperty('--rv', v.toFixed(4)); }
        if (!shown && v >= 0.3 && group) { shown = true; if (GC.reveal) GC.reveal(group); else group.classList.add('is-on'); }
        return false;
      },
    }, { el: w, margin: '20% 0px' });
    /* keyboard: complete the reveal when focus enters a still-covered footer */
    w.addEventListener('focusin', () => {
      if (rv < 0.999) window.scrollTo({ top: Math.ceil(scrollY + (1 - Math.max(0, rv)) * tOf()) + 2, behavior: 'instant' });
    });
  }

  /* ------------------------------------------------------------------ CTA rings centre */
  function setupRings() {
    $$('[data-rings]').forEach(sec => {
      const anchor = $('[data-rings-anchor]', sec);
      if (!anchor) return;
      const m = () => {
        const a = anchor.getBoundingClientRect(), s = sec.getBoundingClientRect();
        sec.style.setProperty('--bx', (a.left + a.width / 2 - s.left).toFixed(1) + 'px');
        sec.style.setProperty('--by', (a.top + a.height / 2 - s.top).toFixed(1) + 'px');
      };
      m();
      if ('ResizeObserver' in window) new ResizeObserver(m).observe(sec);
      setTimeout(m, 700); setTimeout(m, 2200);
      if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(m);
    });
  }

  safe('whatsapp', setupWhatsApp);
  safe('header', setupHeader);
  safe('drawer', setupDrawer);
  safe('anchors', setupAnchors);
  safe('forms', setupForms);
  safe('player', setupPlayer);
  safe('clocks', setupClocks);
  safe('curtain', setupCurtain);
  safe('rings', setupRings);

  window.GCSite = { CONFIG, track, trackLead, toast, openPlayer, preselect, refreshTheme: () => refreshTheme() };
})();
