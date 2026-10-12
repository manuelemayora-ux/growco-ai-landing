/* 02 · MERCADOS (#mercados) — reference RwClients radar (ref-motion §3.11), re-implemented on the shared loop.
 *
 * Sweep angle (deg, clockwise from 12 o'clock) = sp·540 + 9°/s·t − 120, lerped .2 per frame, where sp is the section
 * progress from GC.progress (0 = top enters at the viewport bottom → 1 = bottom leaves at the top, lerped .18).
 * So it scrubs 540° while the section passes and turns slowly on its own (40 s per turn) while it is near the viewport.
 * When the edge crosses a market's angle (data-a) the blip gets .is-hit for 1.5 s (name 40%→100% navy, dot pops,
 * green ping ring, blue tag) and "Último ping" shows "<mercado> · <tag>".
 * The markup ships the parked state (sweep at 40°, three nearest lit, .is-park): that is what no-JS and reduced-motion
 * users see. Live mode swaps .is-park → .is-mv. Runs only while the section is within 10% of the viewport.
 */
const sec = document.getElementById('mercados');
if (!sec) return;
const GC = window.GC || {};
const sweep = sec.querySelector('.mk-sweep');
const read = sec.querySelector('[data-mk-read]');
const blips = [...sec.querySelectorAll('.mk-blip[data-a]')];
if (!sweep || !blips.length || typeof GC.onFrame !== 'function' || typeof GC.progress !== 'function') return;

const RMq = matchMedia('(prefers-reduced-motion: reduce)');
const LIT_MS = 1500, SPIN = 9, PARK = 40;
const txt = el => (el ? el.textContent.trim() : '');
const items = blips.map(el => ({
  el,
  a: ((parseFloat(el.dataset.a) || 0) % 360 + 360) % 360,
  label: txt(el.querySelector('.mk-nm')) + ' · ' + txt(el.querySelector('.mk-bdg')),
  hit: -1e9,
  on: el.classList.contains('is-hit'),
}));
const setRead = s => { if (read && read.textContent !== s) read.textContent = s; };
const setOn = (it, on) => { if (it.on !== on) { it.on = on; it.el.classList.toggle('is-hit', on); } };

/* parked state (reduced motion switched on at runtime): 40°, the three markets nearest BEHIND the edge lit, i.e. the
   ones inside the trailing wedge (reference: distance = (40 − a) mod 360, not the absolute angular distance) */
function park() {
  const dist = a => ((PARK - a) % 360 + 360) % 360;
  const near = items.map((it, i) => ({ i, d: dist(it.a) })).sort((x, y) => x.d - y.d).slice(0, 3).map(x => x.i);
  sweep.style.transform = 'rotate(' + PARK + 'deg)';
  items.forEach((it, i) => setOn(it, near.includes(i)));
  if (near.length) setRead(items[near[0]].label);
  sec.classList.remove('is-mv');
  sec.classList.add('is-park');
}

let stopLoop = null, stopProg = null;
function live() {
  if (stopLoop) return;
  sec.classList.remove('is-park');
  sec.classList.add('is-mv');
  items.forEach(it => setOn(it, false));
  let sp = 0, ready = false, spin = 0, ang = 0, prev = 0, started = false;
  stopProg = GC.progress(sec, p => { sp = p; ready = true; });
  stopLoop = GC.onFrame((t, dt) => {
    if (!ready) return true;
    spin += Math.min(0.05, (dt || 16.7) / 1000) * SPIN;
    const target = sp * 540 + spin - 120;
    ang = started ? ang + (target - ang) * 0.2 : target;
    sweep.style.transform = 'rotate(' + ang.toFixed(2) + 'deg)';
    if (started) {
      const lo = Math.min(prev, ang), hi = Math.max(prev, ang);
      let last = -1;
      items.forEach((it, i) => {
        let crossed = hi - lo >= 360;
        if (!crossed) { const x = it.a + 360 * Math.ceil((lo - it.a) / 360); crossed = x > lo && x <= hi; }
        if (crossed) { it.hit = t; last = i; }
      });
      if (last >= 0) setRead(items[last].label);
    }
    prev = ang;
    started = true;
    items.forEach(it => setOn(it, t - it.hit < LIT_MS));
    return true;
  }, { el: sec, margin: '10% 0px' });
}
function stop() {
  if (stopLoop) { stopLoop(); stopLoop = null; }
  if (stopProg) { stopProg(); stopProg = null; }
}

if (RMq.matches) park(); else live();
const onRM = () => { if (RMq.matches) { stop(); park(); } else live(); };
if (RMq.addEventListener) RMq.addEventListener('change', onRM); else if (RMq.addListener) RMq.addListener(onRM);
