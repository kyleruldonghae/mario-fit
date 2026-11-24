// Plan editor: weekly days + custom routines. History is never changed by plan edits.
import { state, save } from '../store.js';
import { esc, uid, DAY_ORDER, DAY_NAMES } from '../util.js';
import { exName } from '../data/exercises.js';
import { getEx } from '../logic.js';
import { defaultPlan } from '../data/seed.js';
import { go, toast, confirmBox, thumb } from '../ui.js';
import { pickExercise } from './workout.js';

function target(key) {
  if (state.plan[key]) return state.plan[key];
  const r = state.routines.find((x) => x.id === key);
  return r ? Object.assign(r, { title: r.name }) : null;
}
const keyOf = () => new URLSearchParams(location.hash.split('?')[1] || '').get('day') || 'mon';

export default {
  title: 'Plan editor',
  render({ query }) {
    const key = query.day || 'mon';
    const p = target(key);
    const isRoutine = !state.plan[key];
    let h = `<div class="tabs">${DAY_ORDER.map((d) => `<a href="#/plan?day=${d}" class="${d === key ? 'on' : ''}">${DAY_NAMES[d].slice(0, 3)}</a>`).join('')}${state.routines.map((r) => `<a href="#/plan?day=${r.id}" class="${r.id === key ? 'on' : ''}">${esc(r.name)}</a>`).join('')}<button data-act="newroutine">+ Routine</button></div>`;
    if (!p) return h + `<div class="empty">Not found.</div>`;
    h += `<p class="tiny muted">Changes apply to future workouts only — logged history stays exactly as recorded.</p><div class="card">
      <label>${isRoutine ? 'Routine name' : 'Workout title'}</label><input data-change="title" value="${esc(isRoutine ? p.name : p.title)}">
      ${!isRoutine ? `<div class="grid2"><div><label>Day type</label><select data-change="type">${['strength', 'cardio', 'rest'].map((t) => `<option ${p.type === t ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
      <div><label>Swap with day</label><select data-change="swap"><option value="">—</option>${DAY_ORDER.filter((d) => d !== key).map((d) => `<option value="${d}">${DAY_NAMES[d]}</option>`).join('')}</select></div></div>
      <label>Priority</label><input data-change="priority" value="${esc(p.priority || '')}">` : `<label>Focus</label><input data-change="focus" value="${esc(p.focus || '')}">`}
      <label>Note</label><textarea data-change="note">${esc(p.note || '')}</textarea></div>`;
    if (p.type !== 'rest' && p.type !== 'cardio') {
      h += `<div class="section-title"><h2>Exercises</h2></div><div class="list">`;
      p.items.forEach((it, i) => {
        const ex = getEx(state, it.exerciseId);
        h += `<div class="card tight"><div class="row nw">${thumb(it.exerciseId).replace('class="thumb"', 'class="thumb" style="width:56px;flex:0 0 56px;border-radius:8px;overflow:hidden"')}<div class="grow"><b>${esc(exName(ex, state.settings))}</b><div class="tiny muted">${esc(ex?.en || '')}</div></div>
          <button class="btn-sm" data-act="up" data-i="${i}" ${i === 0 ? 'disabled' : ''} aria-label="Move up">↑</button><button class="btn-sm" data-act="down" data-i="${i}" ${i === p.items.length - 1 ? 'disabled' : ''} aria-label="Move down">↓</button></div>
          <div class="grid3" style="margin-top:6px"><div><label>Sets</label><input inputmode="numeric" data-change="item" data-i="${i}" data-f="sets" value="${it.sets}"></div><div><label>Reps min</label><input inputmode="numeric" data-change="item" data-i="${i}" data-f="repsMin" value="${it.repsMin}"></div><div><label>Reps max</label><input inputmode="numeric" data-change="item" data-i="${i}" data-f="repsMax" value="${it.repsMax}"></div></div>
          <div class="row between" style="margin-top:6px"><label class="check" style="min-height:40px"><input type="checkbox" data-change="opt" data-i="${i}" ${it.optional ? 'checked' : ''}> optional</label><span class="row"><button class="btn-sm" data-act="replace" data-i="${i}">Replace</button><button class="btn-sm btn-danger" data-act="remove" data-i="${i}">Remove</button></span></div>
          ${it.history ? `<div class="tiny muted">Plan note: ${esc(it.history)}</div>` : ''}</div>`;
      });
      h += `</div><button class="btn-block" style="margin-top:10px" data-act="add">+ Add exercise</button>`;
    }
    h += `<div class="grid2" style="margin-top:16px"><a class="btn" href="#/workout?day=${key}">Open in workout</a>${isRoutine ? '<button class="btn-danger" data-act="delroutine">Delete routine</button>' : '<button data-act="resetday">Reset this day</button>'}</div>`;
    return h;
  },
  changes: {
    title(el) { const p = target(keyOf()); if (state.plan[keyOf()]) p.title = el.value; else p.name = el.value; save(); },
    type(el) { state.plan[keyOf()].type = el.value; save(); go(location.hash); },
    priority(el) { state.plan[keyOf()].priority = el.value; save(); },
    focus(el) { target(keyOf()).focus = el.value; save(); },
    note(el) { target(keyOf()).note = el.value; save(); },
    item(el) { const it = target(keyOf()).items[Number(el.dataset.i)]; const v = Math.max(1, Math.round(Number(el.value) || 1)); it[el.dataset.f] = v; if (it.repsMax < it.repsMin) it.repsMax = it.repsMin; save(); },
    opt(el) { target(keyOf()).items[Number(el.dataset.i)].optional = el.checked; save(); },
    swap(el) {
      if (!el.value) return;
      const a = keyOf(), b = el.value;
      [state.plan[a], state.plan[b]] = [state.plan[b], state.plan[a]];
      save(); toast(`Swapped ${DAY_NAMES[a]} and ${DAY_NAMES[b]}`); go(location.hash);
    },
  },
  actions: {
    up(el) { const it = target(keyOf()).items; const i = Number(el.dataset.i); [it[i - 1], it[i]] = [it[i], it[i - 1]]; save(); go(location.hash); },
    down(el) { const it = target(keyOf()).items; const i = Number(el.dataset.i); [it[i + 1], it[i]] = [it[i], it[i + 1]]; save(); go(location.hash); },
    remove(el) { target(keyOf()).items.splice(Number(el.dataset.i), 1); save(); go(location.hash); },
    replace(el) {
      const it = target(keyOf()).items[Number(el.dataset.i)];
      pickExercise('Replace with…', getEx(state, it.exerciseId)?.alternatives, (id) => { it.exerciseId = id; it.history = ''; save(); go(location.hash); });
    },
    add() { pickExercise('Add to plan', null, (id) => { const ex = getEx(state, id); target(keyOf()).items.push({ exerciseId: id, sets: 2, repsMin: ex?.type === 'hold' ? 30 : 10, repsMax: ex?.type === 'hold' ? 45 : 12 }); save(); go(location.hash); }); },
    newroutine() { const r = { id: uid('r'), name: 'My routine', type: 'strength', focus: '', items: [] }; state.routines.push(r); save(); go('#/plan?day=' + r.id); },
    async delroutine() { if (!(await confirmBox('Delete this routine?', 'Delete', true))) return; state.routines = state.routines.filter((r) => r.id !== keyOf()); save(); go('#/plan'); },
    async resetday() { if (!(await confirmBox(`Reset ${DAY_NAMES[keyOf()]} to the original plan?`, 'Reset'))) return; state.plan[keyOf()] = defaultPlan()[keyOf()]; save(); go(location.hash); },
  },
};
