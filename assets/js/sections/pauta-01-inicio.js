/* 01 · INICIO (#inicio, /pauta-digital) — scene switcher for the HTML/CSS stage mockups.
 *
 * The shared filmmaker-01-inicio.js (bundled first through PAGES.pauta.share) owns the scroll logic: progress line,
 * step dots/ticks, toast, "Paso 0N / 04", segment bars, and it writes the active scene to the stage as data-step="1…4"
 * (reduced motion / no GC loop → data-step="4" + #inicio.is-fin). It finds none of its own video scenes here.
 * This script mirrors data-step onto the four .p-sd__ui scenes: .is-on on the active one (CSS fade from the shared
 * .f-sd__ui rules) and .is-run replayed so its entrance plays again (CSS animations, sped up by the shared --k).
 * No JS: scene 01 is on in the markup. Reduced motion: scene 04, no replay (CSS also kills every animation).
 */
const sec = document.getElementById('inicio');
if (!sec || !sec.classList.contains('p-sd')) return;
const stage = sec.querySelector('.p-sd__stage');
if (!stage) return;
const scenes = [...stage.querySelectorAll('.p-sd__ui[data-scene]')];
if (!scenes.length) return;
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;

let cur = '';
function sync() {
  const s = stage.getAttribute('data-step') || '1';
  if (s === cur) return;
  cur = s;
  scenes.forEach(el => {
    const on = el.getAttribute('data-scene') === s;
    el.classList.toggle('is-on', on);
    if (!on) { el.classList.remove('is-run'); return; }
    if (RM || sec.classList.contains('is-fin')) return;
    el.classList.remove('is-run');
    void el.offsetWidth;
    el.classList.add('is-run');
  });
}

sync();
new MutationObserver(sync).observe(stage, { attributes: true, attributeFilter: ['data-step'] });
