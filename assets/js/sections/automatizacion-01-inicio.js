/* 01 · INICIO (#inicio) — /automatizacion. Companion of the shared filmmaker-01-inicio.js (rwsd template).
 *
 * The shared script owns the scroll maths: steps .is-on, progress line, caption, segment bars, toast, the --k replay speed
 * and the stage's data-step (1–4; reduced motion → 4 + #inicio.is-fin). This page's scenes are HTML/CSS mini-UIs shown by
 * CSS from data-step, so this script only:
 *   - replays the entrance of the scene that becomes active (.is-run removed / re-added on every data-step write);
 *   - scene 02: cycles the channel tabs WhatsApp → Instagram → Web every 1.8 s while the scene is on, the stage is
 *     visible and the tab is visible.
 * Reduced motion / no GC loop: nothing moves (the shared script has already set the final state).
 */
const sec = document.getElementById('inicio');
if (!sec || !sec.classList.contains('a-sd')) return;
const stage = sec.querySelector('.a-sd__stage');
if (!stage) return;
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const scenes = { 1: '.a-sd__sc--map', 2: '.a-sd__sc--chat', 3: '.a-sd__sc--lead', 4: '.a-sd__sc--crm' };
const sceneOf = s => stage.querySelector(scenes[Math.min(4, Math.max(1, s | 0))]);
const tabs = [...stage.querySelectorAll('.a-sd__tabs span')];

let cur = 0, visible = false, timer = 0, tabI = 0;

function cycle() {
  clearTimeout(timer);
  if (RM || cur !== 2 || !visible || document.hidden || !tabs.length) return;
  timer = setTimeout(() => {
    tabI = (tabI + 1) % tabs.length;
    tabs.forEach((t, k) => t.classList.toggle('is-sel', k === tabI));
    cycle();
  }, 1800);
}

function onStep() {
  const s = +stage.getAttribute('data-step') || 1;
  if (RM || sec.classList.contains('is-fin')) { cur = s; return; }
  const el = sceneOf(s);
  if (s !== cur || (el && !el.classList.contains('is-run'))) {
    Object.values(scenes).forEach(q => { const x = stage.querySelector(q); if (x && x !== el) x.classList.remove('is-run'); });
    if (el) { el.classList.remove('is-run'); void el.offsetWidth; el.classList.add('is-run'); }
    if (s === 2) { tabI = 0; tabs.forEach((t, k) => t.classList.toggle('is-sel', k === 0)); }
  }
  cur = s;
  cycle();
}

new MutationObserver(onStep).observe(stage, { attributes: true, attributeFilter: ['data-step'] });
if ('IntersectionObserver' in window) {
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; cycle(); }, { threshold: [0, 0.35] }).observe(stage);
} else visible = true;
document.addEventListener('visibilitychange', cycle);
onStep();
