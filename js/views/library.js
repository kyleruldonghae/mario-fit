// Exercise library + exercise detail (visual, muscles, instructions, history, photo, variants)
import { state, save, setPhoto, getPhoto, fileToDataUrl } from '../store.js';
import { esc, tag, fmtDate, fmtShort, fmtKg, uid } from '../util.js';
import { EXERCISES, MUSCLE_NAMES, exName, exSub } from '../data/exercises.js';
import { getEx, exerciseHistory, recordsFrom, suggestNext, setsTotals } from '../logic.js';
import { visual, thumb, toast, go, setExSetting, restFor, confirmBox, openSheet } from '../ui.js';
import { muscleMap } from '../musclemap.js';
import { setsText } from './workout.js';

const CATS = ['All', 'Favourites', 'Chest', 'Shoulders', 'Back', 'Arms', 'Legs', 'Core', 'Cardio'];

export const library = {
  title: 'Exercise library',
  render({ query }) {
    const cat = query.cat || 'All';
    const q = (query.q || '').toLowerCase();
    const all = [...EXERCISES, ...state.customExercises];
    const fav = (id) => !!state.exerciseSettings[id]?.favourite;
    const list = all.filter((e) => (cat === 'All' || (cat === 'Favourites' ? fav(e.id) : e.category === cat)) && (!q || (e.de + ' ' + e.en).toLowerCase().includes(q)))
      .sort((a, b) => fav(b.id) - fav(a.id));
    let h = `<input type="search" placeholder="Search (Deutsch / English)" value="${esc(query.q || '')}" data-change="search" aria-label="Search exercises">
      <div class="tabs" style="margin-top:10px">${CATS.map((c) => `<a href="#/library?cat=${c}" class="${c === cat ? 'on' : ''}">${c}</a>`).join('')}</div>
      <p class="tiny muted">All drawings are original ${tag('schematic')} illustrations. Add a photo of the real machine on each exercise page — it will show first.</p><div class="list">`;
    for (const e of list) {
      h += `<a class="item" href="#/exercise/${e.id}">${thumb(e.id)}<div class="meta"><b>${fav(e.id) ? '★ ' : ''}${esc(exName(e, state.settings))}</b><div class="muted small">${esc(exSub(e, state.settings))}</div>
        <div class="tiny dim">${e.primary.map((m) => esc(MUSCLE_NAMES[m]?.split(' / ')[0] || m)).join(', ')}</div></div><span class="chev">›</span></a>`;
    }
    if (!list.length) h += `<div class="empty">No exercises match.</div>`;
    h += `</div><button class="btn-block" style="margin-top:12px" data-act="custom">+ Add custom exercise</button>`;
    return h;
  },
  changes: { search(el) { const c = new URLSearchParams(location.hash.split('?')[1] || '').get('cat') || 'All'; location.hash = `#/library?cat=${c}&q=${encodeURIComponent(el.value)}`; } },
  actions: {
    custom() {
      openSheet(`<h2>Custom exercise</h2><p class="small muted">Shown with a generic schematic — add your own photo after saving.</p>
        <label>German name</label><input id="cx-de"><label>English name</label><input id="cx-en">
        <label>Category</label><select id="cx-cat">${CATS.slice(2).map((c) => `<option>${c}</option>`).join('')}</select>
        <label>Primary muscle</label><select id="cx-m">${Object.entries(MUSCLE_NAMES).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join('')}</select>
        <button class="btn-primary btn-block" style="margin-top:12px" id="cx-save">Save</button>`, (root, close) => {
        root.querySelector('#cx-save').onclick = () => {
          const de = root.querySelector('#cx-de').value.trim(), en = root.querySelector('#cx-en').value.trim() || de;
          if (!de && !en) return toast('Enter a name');
          const id = uid('cx');
          state.customExercises.push({ id, de: de || en, en, category: root.querySelector('#cx-cat').value, type: 'strength', primary: [root.querySelector('#cx-m').value], secondary: [], armLoad: 1, kneeLoad: 0, increment: 5, restSec: 90, setup: [], cues: [], mistakes: [], alternatives: [], kneeNote: '', armNote: '', pose: 'generic', custom: true });
          save(); close(); go('#/exercise/' + id);
        };
      });
    },
  },
};

export const exercise = {
  title: 'Exercise',
  render({ params }) {
    const ex = getEx(state, params[0]);
    if (!ex) return `<div class="empty">Exercise not found. <a href="#/library">Library</a></div>`;
    const es = state.exerciseSettings[ex.id] || {};
    const hist = exerciseHistory(state, ex.id);
    const rec = recordsFrom(hist);
    const planned = Object.entries(state.plan).flatMap(([d, p]) => p.items.filter((i) => i.exerciseId === ex.id).map((i) => ({ d, i })));
    const sg = ex.type !== 'cardio' ? suggestNext(state, ex.id, planned[0]?.i || {}) : null;
    const ul = (arr) => `<ul class="clean small">${arr.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`;
    let h = `<div class="row between nw"><div><h1 style="margin:0">${esc(ex.de)}</h1><div class="muted">${esc(ex.en)}</div></div>
      <button class="btn-sm" data-act="fav" aria-label="Favourite">${es.favourite ? '★ Favourite' : '☆ Favourite'}</button></div>
      <div style="margin-top:10px">${visual(ex.id)}</div>
      <div class="row" style="margin-top:8px"><label class="btn btn-sm" style="margin:0;color:var(--text)">📷 ${'Add / replace machine photo'}<input type="file" accept="image/*" capture="environment" data-change="photo" class="hidden"></label>
      <button class="btn-sm" data-act="rmphoto">Remove photo</button></div>
      ${ex.machineNote ? `<div class="card info" style="margin-top:10px"><b>Machine note</b><p class="small" style="margin:.3em 0 0">${esc(ex.machineNote)}</p></div>` : ''}
      <div class="wide2" style="margin-top:12px"><div class="card"><h2>Muscles</h2>${muscleMap(ex.primary, ex.secondary)}
        <p class="small"><b>Primary:</b> ${ex.primary.map((m) => esc(MUSCLE_NAMES[m])).join(', ')}</p>${ex.secondary.length ? `<p class="small"><b>Secondary:</b> ${ex.secondary.map((m) => esc(MUSCLE_NAMES[m])).join(', ')}</p>` : ''}</div>
      <div class="card"><h2>Setup</h2>${ul(ex.setup)}<h2>Execution</h2>${ul(ex.cues)}<h2>Common mistakes</h2>${ul(ex.mistakes)}</div></div>
      <div class="card ${ex.kneeLoad >= 2 ? 'warn' : ''}"><b>Right knee:</b> <span class="small">${esc(ex.kneeNote || '—')}</span></div>
      <div class="card ${ex.armLoad >= 2 ? 'warn' : ''}"><b>Left upper arm:</b> <span class="small">${esc(ex.armNote || '—')}</span></div>`;
    if (ex.alternatives?.length) h += `<div class="card"><h2>Alternatives</h2><div class="chips">${ex.alternatives.map((a) => `<a class="btn btn-sm" href="#/exercise/${a}">${esc(exName(getEx(state, a), state.settings))}</a>`).join('')}</div></div>`;
    if (planned.length) h += `<div class="card tight small"><b>In your plan:</b> ${planned.map(({ d, i }) => `${d.toUpperCase()} ${i.sets} × ${i.repsMin}–${i.repsMax}${i.history ? ` (${esc(i.history)})` : ''}`).join(' · ')} ${tag('target')}</div>`;
    if (sg) h += `<div class="card tight info small"><b>Next suggestion:</b> ${esc(sg.text)} ${tag('suggestion')}</div>`;
    // history
    h += `<div class="section-title"><h2>Your history</h2>${tag('actual')}</div>`;
    if (hist.length) {
      h += `<div class="card tight"><table class="simple"><tr><th>Date</th><th>Working sets</th><th>Volume</th></tr>${[...hist].reverse().map((r) => `<tr><td class="nowrap">${fmtShort(r.date)}${r.entry.variant !== 'default' ? `<div class="tiny muted">${esc(r.entry.variant)}</div>` : ''}</td><td>${setsText(r.sets)}${r.entry.sets.some((s) => s.kind === 'warmup') ? `<div class="tiny muted">+ warm-up ${r.entry.sets.filter((s) => s.kind === 'warmup').map((s) => `${s.weight}×${s.reps}`).join(', ')}</div>` : ''}</td><td class="nowrap">${r.totals.unknownReps ? '<span class="tag tag-unknown">reps unknown</span>' : fmtKg(r.totals.volume)}</td></tr>`).join('')}</table>
        ${rec.heaviest ? `<p class="small" style="margin:.5em 0 0">Best documented: <b>${rec.heaviest.weight} kg × ${rec.heaviest.reps ?? '?'}</b> (${fmtShort(rec.heaviest.date)})${rec.bestE1rm ? ` · est. 1-rep max ~${Math.round(rec.bestE1rm.value)} kg ${tag('estimate')}` : ''}</p>` : ''}</div>`;
    } else h += `<div class="card tight small muted">No logged sets yet${planned[0]?.i.history ? ` — plan note: ${esc(planned[0].i.history)}` : ''}.</div>`;
    // settings
    const variants = es.variants || [];
    if (ex.type !== 'cardio') {
      h += `<div class="section-title"><h2>Machine &amp; settings</h2></div><div class="card">
        <label>Rest timer for this exercise</label><div class="chips">${[60, 75, 90, 105, 120].map((v) => `<button class="chip ${restFor(ex.id) === v ? 'on' : ''}" data-act="rest" data-v="${v}">${v}s</button>`).join('')}</div>
        <label>Weight increment of this machine</label><div class="chips">${[1, 2.5, 5, 10].map((v) => `<button class="chip ${(es.increment ?? ex.increment) === v ? 'on' : ''}" data-act="inc" data-v="${v}">${v} kg</button>`).join('')}</div>
        <label>Machine variants (weights are only compared within the same variant)</label>
        <div class="list">${['default', ...variants].map((v) => `<div class="row between"><span>${v === 'default' ? 'Default machine' : esc(v)} ${(es.defaultVariant || 'default') === v ? '<span class="tag tag-good">used by default</span>' : ''}</span><span class="row">${(es.defaultVariant || 'default') !== v ? `<button class="btn-sm" data-act="defvar" data-v="${esc(v)}">Use</button>` : ''}${v !== 'default' ? `<button class="btn-sm" data-act="delvar" data-v="${esc(v)}">✕</button>` : ''}</span></div>`).join('')}</div>
        <div class="row nw" style="margin-top:8px"><input id="newvar" placeholder="e.g. Gym 2 – plate loaded"><button class="btn-sm" data-act="addvar">Add</button></div></div>`;
    }
    if (state.active && ex.type !== 'cardio') h += `<button class="btn-big btn-orange" style="margin-top:12px" data-act="addlive">Add to current workout</button>`;
    if (ex.custom) h += `<button class="btn-danger btn-block" style="margin-top:12px" data-act="delcustom">Delete custom exercise</button>`;
    return h;
  },
  actions: {
    fav(el, ev, root, { params }) { const id = params[0]; setExSetting(id, 'favourite', !state.exerciseSettings[id]?.favourite); go(location.hash); },
    rest(el, ev, root, { params }) { setExSetting(params[0], 'restSec', Number(el.dataset.v)); go(location.hash); },
    inc(el, ev, root, { params }) { setExSetting(params[0], 'increment', Number(el.dataset.v)); go(location.hash); },
    addvar(el, ev, root, { params }) {
      const v = root.querySelector('#newvar').value.trim(); if (!v) return;
      const cur = state.exerciseSettings[params[0]]?.variants || [];
      if (!cur.includes(v)) setExSetting(params[0], 'variants', [...cur, v]);
      go(location.hash);
    },
    defvar(el, ev, root, { params }) { setExSetting(params[0], 'defaultVariant', el.dataset.v); go(location.hash); },
    delvar(el, ev, root, { params }) {
      const cur = state.exerciseSettings[params[0]]?.variants || [];
      setExSetting(params[0], 'variants', cur.filter((x) => x !== el.dataset.v));
      if (state.exerciseSettings[params[0]].defaultVariant === el.dataset.v) setExSetting(params[0], 'defaultVariant', 'default');
      go(location.hash);
    },
    async rmphoto(el, ev, root, { params }) {
      if (!(await getPhoto(params[0]))) return toast('No photo stored');
      if (!(await confirmBox('Remove the machine photo?', 'Remove', true))) return;
      await setPhoto(params[0], null); toast('Photo removed'); go(location.hash);
    },
    addlive(el, ev, root, { params }) {
      const ex = getEx(state, params[0]);
      const i = state.active.entries.findIndex((e) => e.exerciseId === ex.id && e.status !== 'substituted');
      if (i >= 0) return go('#/live/' + i);
      state.active.entries.push({ exerciseId: ex.id, variant: state.exerciseSettings[ex.id]?.defaultVariant || 'default', status: 'todo', sets: [], note: '', plan: { sets: 2, repsMin: 10, repsMax: 12, optional: true } });
      save(); go('#/live/' + (state.active.entries.length - 1));
    },
    async delcustom(el, ev, root, { params }) {
      if (!(await confirmBox('Delete this custom exercise? Logged sets stay in history.', 'Delete', true))) return;
      state.customExercises = state.customExercises.filter((e) => e.id !== params[0]); save(); go('#/library');
    },
  },
  changes: {
    async photo(el, { params }) {
      const f = el.files?.[0]; if (!f) return;
      try { await setPhoto(params[0], await fileToDataUrl(f)); toast('Photo saved on this device'); go(location.hash); }
      catch { toast('Could not read that image'); }
    },
  },
};

export { setsTotals };
