/* 07 · REPORTES (#reportes) — reference RwNumbers (.rwnm, "The numbers"), re-implemented.
 *
 * Green overlapping sheet (CSS) + navy results card with 4 KPI tiles + capability ticker.
 * Motion (ref-motion §3.16):
 *   - entrance: motion.js reveals the section group (eyebrow, word-mask H2 with navy underline, intro @360 ms,
 *     card @200 ms / 40 px);
 *   - odometers: every digit spins one full extra turn to its value, 1.6 s cubic-bezier(.2,.8,.1,1), 90 ms per digit
 *     from the left, all four tiles at once when the card is 30 % in view (own trigger, like the reference);
 *   - the rule under each caption draws in with the section progress --p (data-progress, CSS calc per tile --i);
 *   - ticker: shared [data-ticker], speed normalised to ~69 px/s like the reference (48 s for its list).
 * Growco addition: the tabs ADQUISICIÓN · INGRESOS · EFICIENCIA · PAUTA are real ARIA tabs (rev2, client 2026-10-12:
 *   a DEMO monthly growth report — business metrics first: CAC, RGU, ARPU, LTV, ROAS; no client names) — switching
 *   re-labels the tiles, re-rolls the odometers, swaps the period and the focus line. No trend lines.
 * Reduced motion: final values, rules drawn, no ticker loop, instant tab swaps. No JS: ADQUISICIÓN values in the markup,
 *   rules pre-drawn, tabs hidden until this script adds .nm--ready.
 */
const sec = document.getElementById('reportes');
if (!sec || !sec.classList.contains('nm')) return;
const GC = window.GC || {};
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------------------------------------------------------------- data: demo growth report (see the fragment) */
/* v = value (a trailing unit word such as "meses" joined by U+00A0 renders smaller, .nm__u); d = direction of the pill
   arrow (1 up, -1 down, 0 neutral dot); p = pill text; c = one-line caption. */
const NB = ' ';
const SETS = [
  { // Adquisición
    range: 'Mes vs. mes anterior',
    src: 'Cuánto cuesta crecer: CAC y clientes nuevos que generan ingreso',
    t: [
      { l: 'CAC', v: '−28%', d: -1, p: 'vs. mes anterior', c: 'Lo que cuesta cada cliente nuevo' },
      { l: 'RGU nuevos', v: '+34%', d: 1, p: 'vs. mes anterior', c: 'Clientes nuevos que ya generan ingreso' },
      { l: 'Costo por lead', v: '−22%', d: -1, p: 'vs. mes anterior', c: 'Lo que cuesta cada contacto calificado' },
      { l: 'Tasa de conversión', v: '6.8%', d: 1, p: '+1.4 pts', c: 'Leads que se vuelven clientes' },
    ],
  },
  { // Ingresos
    range: 'Mes vs. mes anterior',
    src: 'Cuánto deja cada cliente: ARPU, LTV y recompra',
    t: [
      { l: 'ARPU', v: '+12%', d: 1, p: 'vs. mes anterior', c: 'Ingreso promedio por cliente' },
      { l: 'Ingresos atribuidos', v: '+41%', d: 1, p: 'vs. mes anterior', c: 'Ventas que vienen de las campañas' },
      { l: 'Valor de vida (LTV)', v: '+18%', d: 1, p: 'vs. mes anterior', c: 'Lo que deja un cliente en el tiempo' },
      { l: 'Recompra', v: '32%', d: 1, p: '+5 pts', c: 'Clientes que vuelven a comprar' },
    ],
  },
  { // Eficiencia
    range: 'Mes vs. mes anterior',
    src: 'Cuánto rinde cada dólar, revisado con tu área financiera',
    t: [
      { l: 'ROAS', v: '4.6×', d: 1, p: 'Por dólar invertido', c: 'Ventas por cada dólar en pauta' },
      { l: 'LTV / CAC', v: '3.8×', d: 1, p: 'Meta: 3×', c: 'Lo que deja un cliente frente a lo que costó' },
      { l: 'Recuperación del CAC', v: '2.5' + NB + 'meses', d: -1, p: '−1.1 meses', c: 'Tiempo para recuperar lo invertido' },
      { l: 'Presupuesto que convierte', v: '87%', d: 1, p: '+19 pts', c: 'Inversión donde sí hay retorno' },
    ],
  },
  { // Pauta
    range: 'Mes vs. mes anterior',
    src: 'Las métricas de pauta, al servicio de las de negocio',
    t: [
      { l: 'Tasa de clic (CTR)', v: '3.1%', d: 1, p: '+0.6 pts', c: 'Anuncios que la gente sí toca' },
      { l: 'Costo por clic', v: '−24%', d: -1, p: 'vs. mes anterior', c: 'Cada visita cuesta menos' },
      { l: 'Audiencia objetivo', v: '78%', d: 1, p: 'Del alcance', c: 'Impresiones frente a quien sí compra' },
      { l: 'Frecuencia', v: '2.4', d: 0, p: 'Por semana', c: 'Veces que cada persona ve tu anuncio' },
    ],
  },
];
const ARROW = { 1: '▲', '-1': '▼', 0: '•' };

/* ---------------------------------------------------------------- odometer (shared .odo classes, own roll) */
const CELLS = '01234567890123456789';
function buildOdo(el, text) {
  el.textContent = '';
  const sr = document.createElement('span');
  sr.className = 'sr';
  sr.textContent = text;
  const vis = document.createElement('span');
  vis.className = 'odo nm__odo';
  vis.setAttribute('aria-hidden', 'true');
  /* a trailing unit word (" M") stays one smaller static span */
  const um = text.match(/^(.*\d)([  ]?\p{L}+)$/u);
  const body = um ? um[1] : text;
  for (const ch of body) {
    const s = document.createElement('span');
    if (/\d/.test(ch)) {
      s.className = 'odo__d';
      const c = document.createElement('span');
      c.className = 'odo__c';
      c.innerHTML = [...CELLS].map(x => '<i>' + x + '</i>').join('');
      s.appendChild(c);
    } else {
      s.className = 'odo__s';
      s.textContent = ch;
    }
    vis.appendChild(s);
  }
  if (um) {
    const u = document.createElement('span');
    u.className = 'odo__s nm__u';
    u.textContent = um[2].replace(' ', NB);
    vis.appendChild(u);
  }
  el.append(sr, vis);
  el.dataset.shape = text.replace(/\d/g, '0');
}
/* roll a list of [el, text] together: reset every column to the first "0" (no transition), one reflow, then spin */
function rollAll(jobs, baseDelay = 0) {
  const cols = [];
  jobs.forEach(([el, text], j) => {
    if (el.dataset.shape !== text.replace(/\d/g, '0')) buildOdo(el, text);
    else { const sr = el.querySelector('.sr'); if (sr) sr.textContent = text; }
    const digits = text.replace(/\D/g, '');
    el.querySelectorAll('.odo__c').forEach((c, i) => {
      c.style.transition = 'none';
      c.style.transform = 'translateY(0%)';
      cols.push([c, +digits[i] || 0, baseDelay + (j * (jobs.length > 1 ? (jobs.delayStep || 0) : 0)) + i * 90]);
    });
  });
  if (!cols.length) return;
  void cols[0][0].offsetHeight; // single reflow so the reset sticks
  cols.forEach(([c, d, delay]) => {
    c.style.transition = '';
    c.style.setProperty('--od-dur', '1600ms');
    c.style.setProperty('--od-delay', delay + 'ms');
    c.style.transform = 'translateY(' + (-(10 + d) * 5) + '%)';
  });
}

/* ---------------------------------------------------------------- tiles */
const tiles = [...sec.querySelectorAll('.nm__tile')];
const panel = sec.querySelector('.nm__panel');
const tabs = [...sec.querySelectorAll('.nm__tab')];
const rangeEl = sec.querySelector('[data-nm-range]');
const srcEl = sec.querySelector('[data-nm-src]');
if (!tiles.length) return;

function paint(tile, d) {
  const lab = tile.querySelector('.nm__lab-t');
  if (lab) lab.textContent = d.l;
  const arrow = tile.querySelector('.nm__delta b');
  if (arrow) arrow.textContent = ARROW[d.d];
  const pill = tile.querySelector('.nm__dt');
  if (pill) pill.textContent = d.p;
  const cap = tile.querySelector('.nm__cap');
  if (cap) cap.textContent = d.c;
}
function paintSet(k) {
  const set = SETS[k];
  set.t.forEach((d, i) => tiles[i] && paint(tiles[i], d));
  if (rangeEl) rangeEl.textContent = set.range;
  if (srcEl) srcEl.textContent = set.src;
}

let cur = 0;
paintSet(0);
const nums = tiles.map(t => t.querySelector('.nm__num'));

/* final state without motion (reduced motion): same digit windows, columns parked on their value, no transition */
const setFinal = (el, text) => {
  if (el.dataset.shape !== text.replace(/\d/g, '0')) buildOdo(el, text);
  else { const sr = el.querySelector('.sr'); if (sr) sr.textContent = text; }
  const digits = text.replace(/\D/g, '');
  el.querySelectorAll('.odo__c').forEach((c, i) => { c.style.transition = 'none'; c.style.transform = 'translateY(' + (-(10 + (+digits[i] || 0)) * 5) + '%)'; });
};
/* initial odometer state: zeros waiting for the card (motion allowed) */
if (!RM) {
  nums.forEach((el, i) => { if (el) { buildOdo(el, SETS[0].t[i].v); el.querySelectorAll('.odo__c').forEach(c => { c.style.transform = 'translateY(0%)'; }); } });
  sec.classList.add('nm--live');
} else nums.forEach((el, i) => el && setFinal(el, SETS[0].t[i].v));
let rolled = RM;
const dash = sec.querySelector('.nm__dash');
const startRoll = () => {
  if (rolled) return;
  rolled = true;
  rollAll(nums.map((el, i) => [el, SETS[cur].t[i].v]).filter(j => j[0]));
};
if (!RM && dash) {
  if (GC.inView) GC.inView(dash, startRoll, { threshold: 0.3 });
  else startRoll();
  /* keyboard users tabbing into the card see final numbers at once */
  dash.addEventListener('focusin', startRoll);
}

/* ---------------------------------------------------------------- tabs (PAUTA · WHATSAPP · VIDEO IA · APP) */
let swapT = 0;
function select(k, focus) {
  k = (k + tabs.length) % tabs.length;
  if (k === cur) { if (focus) tabs[k].focus(); return; }
  cur = k;
  tabs.forEach((t, j) => {
    const on = j === k;
    t.setAttribute('aria-selected', String(on));
    t.tabIndex = on ? 0 : -1;
    t.classList.toggle('is-active', on);
  });
  if (focus) tabs[k].focus();
  if (panel) panel.setAttribute('aria-labelledby', tabs[k].id);
  const set = SETS[k];
  if (RM) {
    paintSet(k);
    set.t.forEach((d, i) => { if (nums[i]) setFinal(nums[i], d.v); });
    return;
  }
  /* fade labels, pills, captions and the source out, swap, fade back in; numbers re-roll; rules redraw */
  sec.classList.add('nm--swap');
  clearTimeout(swapT);
  swapT = setTimeout(() => {
    paintSet(k);
    tiles.forEach(t => t.classList.remove('is-draw'));
    void sec.offsetWidth;
    tiles.forEach(t => t.classList.add('is-draw'));
    sec.classList.remove('nm--swap');
    rolled = true;
    const jobs = nums.map((el, i) => [el, set.t[i].v]).filter(j => j[0]);
    jobs.delayStep = 60;
    rollAll(jobs);
  }, 180);
}
if (tabs.length) sec.classList.add('nm--ready');
tabs.forEach((t, i) => {
  t.addEventListener('click', () => select(i, false));
  t.addEventListener('keydown', e => {
    const m = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (m) { e.preventDefault(); select(cur + m, true); }
    else if (e.key === 'Home') { e.preventDefault(); select(0, true); }
    else if (e.key === 'End') { e.preventDefault(); select(tabs.length - 1, true); }
  });
});

/* ---------------------------------------------------------------- ticker speed ≈ 69 px/s (reference) */
const track = sec.querySelector('.nm__tick .ticker__track');
if (track && !RM) {
  const setDur = () => {
    const w = track.scrollWidth / 2;
    if (w > 0) track.style.setProperty('--ticker-dur', (w / 69).toFixed(2) + 's');
  };
  setDur();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(setDur).catch(() => {});
  let rz = 0;
  addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(setDur, 200); }, { passive: true });
}
