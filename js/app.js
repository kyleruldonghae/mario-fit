// App shell: router, event delegation, service worker.
import { loadState, state } from './store.js';
import { wireAll } from './ui.js';
import * as W from './views/workout.js';
import home, { onboarding } from './views/home.js';
import { library, exercise } from './views/library.js';
import { history, sessionView } from './views/history.js';
import progress from './views/progress.js';
import { cardio, cardioForm } from './views/cardio.js';
import { recovery, checkinForm, symptomForm } from './views/recovery.js';
import nutrition from './views/nutrition.js';
import supplements from './views/supplements.js';
import plan from './views/plan.js';
import { settings, more } from './views/settings.js';

const routes = [
  [/^$/, home, 'home'],
  [/^onboarding$/, onboarding, 'home'],
  [/^workout$/, W.today, 'workout'],
  [/^live$/, W.live, 'workout'],
  [/^live\/(\d+)$/, W.logger, 'workout'],
  [/^summary\/([\w-]+)$/, W.summary, 'workout'],
  [/^library$/, library, 'library'],
  [/^exercise\/([\w-]+)$/, exercise, 'library'],
  [/^progress$/, progress, 'progress'],
  [/^history$/, history, 'more'],
  [/^session\/([\w-]+)$/, sessionView, 'more'],
  [/^cardio$/, cardio, 'more'],
  [/^cardio\/(new|[\w-]+)$/, cardioForm, 'more'],
  [/^recovery$/, recovery, 'more'],
  [/^recovery\/new$/, checkinForm, 'more'],
  [/^recovery\/checkin\/([\w-]+)$/, checkinForm, 'more'],
  [/^symptom\/(new|[\w-]+)$/, symptomForm, 'more'],
  [/^nutrition$/, nutrition, 'more'],
  [/^supplements$/, supplements, 'more'],
  [/^plan$/, plan, 'more'],
  [/^settings$/, settings, 'more'],
  [/^more$/, more, 'more'],
];

let current = null; // { view, ctx }
const main = document.getElementById('view');

function parseHash() {
  const raw = location.hash.replace(/^#\/?/, '');
  const [path, qs] = raw.split('?');
  return { path: decodeURIComponent(path || ''), query: Object.fromEntries(new URLSearchParams(qs || '')) };
}

export function render() {
  const { path, query } = parseHash();
  let match = null;
  for (const [re, view, nav] of routes) {
    const m = path.match(re);
    if (m) { match = { view, nav, params: m.slice(1) }; break; }
  }
  if (!match) match = { view: home, nav: 'home', params: [] };
  if (match.view === home && !state.onboarded) match = { view: onboarding, nav: 'home', params: [] };
  const ctx = { params: match.params, query };
  const sameRoute = current && current.view === match.view && current.path === path;
  const y = window.scrollY;
  current = { view: match.view, ctx, path };
  try {
    main.innerHTML = match.view.render(ctx);
  } catch (e) {
    console.error(e);
    main.innerHTML = `<div class="card danger"><h2>Something went wrong</h2><p class="small">${String(e.message || e)}</p><a class="btn" href="#/">Home</a></div>`;
  }
  document.getElementById('screen-title').textContent = typeof match.view.title === 'function' ? match.view.title(ctx) : match.view.title || '';
  document.querySelectorAll('[data-nav]').forEach((a) => a.classList.toggle('on', a.dataset.nav === match.nav));
  document.getElementById('live-pill').classList.toggle('hidden', !state.active || path.startsWith('live'));
  document.documentElement.dataset.theme = state.settings.theme || 'dark';
  wireAll(main);
  match.view.after?.(main, ctx);
  window.scrollTo(0, sameRoute ? y : 0);
}

// ---- event delegation to the current view ----
main.addEventListener('click', (ev) => {
  const el = ev.target.closest('[data-act]');
  if (!el || !main.contains(el)) return;
  const fn = current?.view.actions?.[el.dataset.act];
  if (fn) { ev.preventDefault(); fn(el, ev, main, current.ctx); }
});
main.addEventListener('change', (ev) => {
  const el = ev.target.closest('[data-change]');
  if (!el) return;
  current?.view.changes?.[el.dataset.change]?.(el, current.ctx, main);
});
main.addEventListener('submit', (ev) => {
  const f = ev.target.closest('form[data-form]');
  if (!f) return;
  ev.preventDefault();
  current?.view.forms?.[f.dataset.form]?.(f, current.ctx, main);
});

window.addEventListener('hashchange', render);

(async function boot() {
  await loadState();
  render();
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch((e) => console.warn('SW registration failed', e));
  }
  if (navigator.storage?.persist) navigator.storage.persist().catch(() => {});
})();
