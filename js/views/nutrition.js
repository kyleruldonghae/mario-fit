// Nutrition: daily kcal/protein, food & recipe logging, Malaysian/Asian + Swiss templates, optional IF timer.
import { state, save } from '../store.js';
import { esc, tag, isoDate, addDays, fmtDate, fmtShort, fmtNum, numOrNull, uid, pad2 } from '../util.js';
import { FOODS, RECIPES } from '../data/seed.js';
import { barChart } from '../charts.js';
import { openSheet, go, toast, confirmBox } from '../ui.js';

const allFoods = () => [...state.customFoods, ...FOODS];
const allRecipes = () => [...state.customRecipes, ...RECIPES];

export function dayNutrition(date) {
  const es = state.nutrition.entries.filter((e) => e.date === date);
  const sum = (k) => es.reduce((a, e) => a + (e[k] || 0), 0);
  return { entries: es, kcal: sum('kcal'), protein: sum('protein'), carbs: sum('carbs'), fat: sum('fat'), fibre: sum('fibre') };
}

function ifStatus() {
  const f = state.nutrition.fasting;
  if (!f.enabled) return null;
  const now = new Date();
  const [sh, sm] = f.start.split(':').map(Number), [eh, em] = f.end.split(':').map(Number);
  const mins = now.getHours() * 60 + now.getMinutes(), s = sh * 60 + sm, e = eh * 60 + em;
  const open = mins >= s && mins < e;
  const left = open ? e - mins : (mins < s ? s - mins : 24 * 60 - mins + s);
  return { open, left: `${Math.floor(left / 60)} h ${pad2(left % 60)} min` };
}

export default {
  title: 'Nutrition',
  render({ query }) {
    const date = query.date || isoDate();
    const d = dayNutrition(date);
    const t = state.nutrition.target;
    const pct = (a, b) => Math.min(100, b ? (a / b) * 100 : 0);
    let h = `<div class="row between nw"><a class="btn btn-sm" href="#/nutrition?date=${addDays(date, -1)}">‹</a><b>${date === isoDate() ? 'Today' : fmtDate(date, true)}</b><a class="btn btn-sm ${date >= isoDate() ? 'hidden' : ''}" href="#/nutrition?date=${addDays(date, 1)}">›</a></div>
      <div class="card hero" style="margin-top:10px"><div class="row between"><b>Daily progress</b><button class="btn-sm" data-act="targets">Targets</button></div>
      <div class="small" style="margin-top:6px">Calories: <b>${fmtNum(d.kcal)}</b> / ${fmtNum(t.kcal)} kcal</div><div class="progress orange"><div style="width:${pct(d.kcal, t.kcal)}%"></div></div>
      <div class="small" style="margin-top:8px">Protein: <b>${fmtNum(d.protein)}</b> / ${t.protein} g</div><div class="progress"><div style="width:${pct(d.protein, t.protein)}%"></div></div>
      ${d.carbs || d.fat || d.fibre ? `<div class="small muted" style="margin-top:6px">Carbs ${fmtNum(d.carbs)} g · Fat ${fmtNum(d.fat)} g${d.fibre ? ` · Fibre ${fmtNum(d.fibre)} g` : ''}</div>` : ''}
      <p class="tiny muted" style="margin:.5em 0 0">Targets ${tag('estimate')} ${esc(t.note)} Food values are estimates.</p></div>`;
    const ifs = ifStatus();
    if (ifs) h += `<div class="card tight"><b>Eating window ${state.nutrition.fasting.start}–${state.nutrition.fasting.end}</b> <span class="tag ${ifs.open ? 'tag-good' : 'tag-unknown'}">${ifs.open ? 'open' : 'closed'}</span><div class="small muted">${ifs.open ? 'Closes in' : 'Opens in'} ${ifs.left}. Optional — never mandatory.</div></div>`;
    h += `<div class="grid3" style="margin-top:12px"><button class="btn-primary" data-act="food">+ Food</button><button data-act="recipe">+ Recipe</button><button data-act="manual">+ Manual</button></div>`;
    h += `<div class="section-title"><h2>Logged</h2>${tag('actual')}</div>`;
    h += d.entries.length ? `<div class="card tight"><table class="simple">${d.entries.map((e) => `<tr><td>${esc(e.name)}${e.portion && e.portion !== 1 ? ` <span class="muted small">×${e.portion}</span>` : ''}<div class="tiny muted">${e.meal || ''}</div></td><td class="nowrap small">${fmtNum(e.kcal)} kcal<br>${fmtNum(e.protein)} g P</td><td class="act"><button class="btn-sm" data-act="del" data-id="${e.id}">✕</button></td></tr>`).join('')}</table></div>` : `<div class="card tight small muted">Nothing logged for this day. Simple logging is fine — even just the main meals.</div>`;
    // weekly averages
    const days = Array.from({ length: 7 }, (_, i) => addDays(date, -6 + i));
    const per = days.map((x) => ({ x, ...dayNutrition(x) }));
    const logged = per.filter((p) => p.entries.length);
    h += `<div class="card"><div class="row between"><b>Last 7 days</b><span class="small muted">${logged.length ? `avg ${fmtNum(logged.reduce((a, p) => a + p.kcal, 0) / logged.length)} kcal · ${fmtNum(logged.reduce((a, p) => a + p.protein, 0) / logged.length)} g protein (${logged.length} logged days)` : 'no days logged'}</span></div>
      ${barChart(per.map((p) => ({ x: fmtShort(p.x).split(' ')[0], y: p.protein })), { unit: 'g', target: t.protein })}<div class="tiny muted center">Protein per day (dashed = target)</div></div>`;
    // recipes
    h += `<div class="section-title"><h2>Meal templates</h2><button class="btn-sm" data-act="newrecipe">+ My recipe</button></div><p class="tiny muted">Cooked for two adults. Chicken, fish &amp; seafood — no pork. Values per serving ${tag('estimate')}.</p><div class="list">`;
    for (const r of allRecipes()) h += `<button class="item" style="width:100%;text-align:left" data-act="showrecipe" data-id="${r.id}"><div class="meta"><b>${esc(r.name)}</b><div class="small muted">${esc(r.cuisine)} · serves ${r.servings} · ${r.perServing.kcal} kcal · ${r.perServing.protein} g protein / serving</div></div><span class="chev">›</span></button>`;
    h += `</div><div class="section-title"><h2>High-protein ideas</h2></div><div class="card tight"><table class="simple">${allFoods().map((f) => ({ ...f, dens: f.protein / Math.max(1, f.kcal) })).sort((a, b) => b.dens - a.dens).slice(0, 8).map((f) => `<tr><td>${esc(f.name)}</td><td class="nowrap small">${f.protein} g P · ${f.kcal} kcal</td></tr>`).join('')}</table></div>`;
    h += `<div class="card tight"><div class="row between"><span>Intermittent-fasting timer (optional)</span><input type="checkbox" data-change="ifon" ${state.nutrition.fasting.enabled ? 'checked' : ''} aria-label="Intermittent fasting timer"></div>
      <div class="grid2 ${state.nutrition.fasting.enabled ? '' : 'hidden'}"><div><label>Window opens</label><input type="time" data-change="ifstart" value="${state.nutrition.fasting.start}"></div><div><label>Window closes</label><input type="time" data-change="ifend" value="${state.nutrition.fasting.end}"></div></div>
      <p class="tiny muted">${esc(state.nutrition.fasting.note)}</p></div>`;
    return h;
  },
  changes: {
    ifon(el) { state.nutrition.fasting.enabled = el.checked; save(); go(location.hash); },
    ifstart(el) { state.nutrition.fasting.start = el.value; save(); },
    ifend(el) { state.nutrition.fasting.end = el.value; save(); },
  },
  actions: {
    targets() {
      const t = state.nutrition.target;
      openSheet(`<h2>Daily targets ${tag('estimate')}</h2><p class="small muted">Previous coaching estimates: 2,200–2,400 kcal, 150–170 g protein. Adjust as your weight trend, recovery and performance show.</p>
        <div class="grid2"><div><label>Calories (kcal)</label><input id="t-k" inputmode="numeric" value="${t.kcal}"></div><div><label>Protein (g)</label><input id="t-p" inputmode="numeric" value="${t.protein}"></div>
        <div><label>Carbs (g, optional)</label><input id="t-c" inputmode="numeric" value="${t.carbs ?? ''}"></div><div><label>Fat (g, optional)</label><input id="t-f" inputmode="numeric" value="${t.fat ?? ''}"></div></div>
        <button class="btn-primary btn-block" style="margin-top:12px" id="t-s">Save</button>`, (r, close) => {
        r.querySelector('#t-s').onclick = () => { t.kcal = numOrNull(r.querySelector('#t-k').value) || t.kcal; t.protein = numOrNull(r.querySelector('#t-p').value) || t.protein; t.carbs = numOrNull(r.querySelector('#t-c').value); t.fat = numOrNull(r.querySelector('#t-f').value); save(); close(); go(location.hash); };
      });
    },
    food() {
      openSheet(`<h2>Add food</h2><input id="fs" type="search" placeholder="Search"><label>Portion</label><div class="chips" id="fp">${[0.5, 1, 1.5, 2].map((v) => `<button class="chip ${v === 1 ? 'on' : ''}" data-v="${v}">×${v}</button>`).join('')}</div>
        <div class="list" id="fl" style="margin-top:10px">${allFoods().map((f) => `<button class="item" style="width:100%;text-align:left" data-f="${f.id}" data-n="${esc(f.name.toLowerCase())}"><div class="meta"><b>${esc(f.name)}</b><div class="small muted">${f.kcal} kcal · ${f.protein} g protein · ${esc(f.tag || '')}</div></div><span>+</span></button>`).join('')}</div>
        <button class="btn-block" style="margin-top:10px" data-close>Close</button>`, (r, close) => {
        let portion = 1;
        r.querySelector('#fp').onclick = (e) => { const b = e.target.closest('[data-v]'); if (!b) return; portion = Number(b.dataset.v); r.querySelectorAll('#fp .chip').forEach((x) => x.classList.toggle('on', x === b)); };
        r.querySelector('#fs').oninput = (e) => { const q = e.target.value.toLowerCase(); r.querySelectorAll('[data-f]').forEach((b) => b.classList.toggle('hidden', !b.dataset.n.includes(q))); };
        r.querySelector('#fl').onclick = (e) => {
          const b = e.target.closest('[data-f]'); if (!b) return;
          const f = allFoods().find((x) => x.id === b.dataset.f);
          addEntry({ name: f.name, portion, kcal: f.kcal * portion, protein: f.protein * portion, carbs: (f.carbs || 0) * portion, fat: (f.fat || 0) * portion, fibre: (f.fibre || 0) * portion });
          close();
        };
      });
    },
    recipe() {
      openSheet(`<h2>Log a recipe portion</h2><div class="list">${allRecipes().map((r) => `<button class="item" style="width:100%;text-align:left" data-r="${r.id}"><div class="meta"><b>${esc(r.name)}</b><div class="small muted">1 serving: ${r.perServing.kcal} kcal · ${r.perServing.protein} g protein</div></div><span>+</span></button>`).join('')}</div><button class="btn-block" style="margin-top:10px" data-close>Close</button>`, (root, close) => {
        root.addEventListener('click', (e) => { const b = e.target.closest('[data-r]'); if (!b) return; logRecipe(b.dataset.r, 1); close(); });
      });
    },
    manual() {
      openSheet(`<h2>Manual entry</h2><label>Name</label><input id="m-n" placeholder="e.g. Nasi goreng ayam, restaurant"><div class="grid2"><div><label>kcal</label><input id="m-k" inputmode="numeric"></div><div><label>Protein (g)</label><input id="m-p" inputmode="decimal"></div><div><label>Carbs (g)</label><input id="m-c" inputmode="decimal"></div><div><label>Fat (g)</label><input id="m-f" inputmode="decimal"></div><div><label>Fibre (g)</label><input id="m-fi" inputmode="decimal"></div></div>
        <label class="check"><input type="checkbox" id="m-save"> Save to my foods</label><button class="btn-primary btn-block" style="margin-top:10px" id="m-ok">Add</button>`, (r, close) => {
        r.querySelector('#m-ok').onclick = () => {
          const v = { name: r.querySelector('#m-n').value.trim() || 'Food', kcal: numOrNull(r.querySelector('#m-k').value) || 0, protein: numOrNull(r.querySelector('#m-p').value) || 0, carbs: numOrNull(r.querySelector('#m-c').value) || 0, fat: numOrNull(r.querySelector('#m-f').value) || 0, fibre: numOrNull(r.querySelector('#m-fi').value) || 0 };
          if (r.querySelector('#m-save').checked) state.customFoods.push({ id: uid('food'), ...v, tag: 'Mine' });
          addEntry({ ...v, portion: 1 }); close();
        };
      });
    },
    del(el) { state.nutrition.entries = state.nutrition.entries.filter((e) => e.id !== el.dataset.id); save(); go(location.hash); },
    showrecipe(el) {
      const r = allRecipes().find((x) => x.id === el.dataset.id);
      const render = (people) => `<h2>${esc(r.name)}</h2><div class="small muted">${esc(r.cuisine)} · ${tag('estimate')} ${r.perServing.kcal} kcal · ${r.perServing.protein} g protein · ${r.perServing.carbs ?? '?'} g carbs · ${r.perServing.fat ?? '?'} g fat per serving</div>
        <label>Cooking for</label><div class="chips" id="rp">${[1, 2, 3, 4].map((n) => `<button class="chip ${n === people ? 'on' : ''}" data-p="${n}">${n} ${n === 1 ? 'person' : 'people'}</button>`).join('')}</div>
        <h3 style="margin-top:12px">Ingredients ${people !== r.servings ? `<span class="muted small">(scaled ×${fmtNum(people / r.servings, 2)} from ${r.servings})</span>` : ''}</h3><ul class="clean small">${r.ingredients.map((i) => `<li>${esc(scaleLine(i, people / r.servings))}</li>`).join('')}</ul>
        <h3>Steps</h3><ol class="small">${(r.steps || []).map((s) => `<li>${esc(s)}</li>`).join('')}</ol>
        <div class="grid2"><button data-close>Close</button><button class="btn-primary" id="rl">Log 1 serving</button></div>${r.custom ? '<button class="btn-danger btn-block" style="margin-top:8px" id="rd">Delete my recipe</button>' : ''}`;
      const bind = (root, close) => {
        root.querySelector('#rp').onclick = (e) => { const b = e.target.closest('[data-p]'); if (!b) return; root.innerHTML = '<div class="grab"></div>' + render(Number(b.dataset.p)); bind(root, close); };
        root.querySelector('#rl').onclick = () => { logRecipe(r.id, 1); close(); };
        root.querySelector('#rd')?.addEventListener('click', async () => { close(); if (await confirmBox('Delete this recipe?', 'Delete', true)) { state.customRecipes = state.customRecipes.filter((x) => x.id !== r.id); save(); go(location.hash); } });
        root.querySelectorAll('[data-close]').forEach((b) => (b.onclick = close));
      };
      openSheet(render(2), bind);
    },
    newrecipe() {
      openSheet(`<h2>My recipe</h2><label>Name</label><input id="r-n"><label>Cuisine</label><input id="r-c" value="Malaysian (homemade)">
        <div class="grid2"><div><label>Serves</label><input id="r-s" inputmode="numeric" value="2"></div><div><label>kcal per serving</label><input id="r-k" inputmode="numeric"></div><div><label>Protein per serving (g)</label><input id="r-p" inputmode="decimal"></div><div><label>Carbs / fat per serving (g)</label><input id="r-cf" placeholder="e.g. 40/15"></div></div>
        <label>Ingredients (one per line, for the full recipe)</label><textarea id="r-i" placeholder="500 g chicken thigh&#10;2 tbsp sambal"></textarea><label>Steps (one per line)</label><textarea id="r-st"></textarea>
        <button class="btn-primary btn-block" style="margin-top:10px" id="r-ok">Save recipe</button>`, (r, close) => {
        r.querySelector('#r-ok').onclick = () => {
          const name = r.querySelector('#r-n').value.trim(); if (!name) return toast('Enter a name');
          const [c, f] = r.querySelector('#r-cf').value.split('/').map(numOrNull);
          state.customRecipes.push({ id: uid('rc'), custom: true, name, cuisine: r.querySelector('#r-c').value, servings: numOrNull(r.querySelector('#r-s').value) || 2, perServing: { kcal: numOrNull(r.querySelector('#r-k').value) || 0, protein: numOrNull(r.querySelector('#r-p').value) || 0, carbs: c, fat: f }, ingredients: r.querySelector('#r-i').value.split('\n').filter(Boolean), steps: r.querySelector('#r-st').value.split('\n').filter(Boolean) });
          save(); close(); go(location.hash);
        };
      });
    },
  },
};

function scaleLine(line, k) {
  if (k === 1) return line;
  return line.replace(/^(\d+(?:[.,]\d+)?)/, (m) => fmtNum(Number(m.replace(',', '.')) * k, 1));
}

function addEntry(v) {
  const date = new URLSearchParams(location.hash.split('?')[1] || '').get('date') || isoDate();
  const h = new Date().getHours();
  state.nutrition.entries.push({ id: uid('fe'), date, meal: h < 11 ? 'Morning' : h < 15 ? 'Lunch' : h < 18 ? 'Afternoon' : 'Evening', ...v });
  save(); toast(`Added: ${v.name}`); go(location.hash);
}
function logRecipe(id, servings) {
  const r = allRecipes().find((x) => x.id === id);
  const p = r.perServing;
  addEntry({ name: r.name, portion: servings, kcal: p.kcal * servings, protein: p.protein * servings, carbs: (p.carbs || 0) * servings, fat: (p.fat || 0) * servings, recipeId: r.id });
}
