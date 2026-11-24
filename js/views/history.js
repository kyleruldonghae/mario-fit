// History list + editable session detail
import { state, save } from '../store.js';
import { esc, tag, fmtDate, fmtNum, fmtKg, numOrNull, fmtDur } from '../util.js';
import { exName } from '../data/exercises.js';
import { getEx, sessionTotals, setsTotals, strengthSessions } from '../logic.js';
import { openSheet, stepper, wireAll, go, confirmBox, toast } from '../ui.js';
import { STATUS_LABEL, pickExercise } from './workout.js';

export const history = {
  title: 'History',
  render({ query }) {
    const f = query.f || 'all';
    const rows = [];
    if (f !== 'cardio') for (const s of strengthSessions(state)) rows.push({ date: s.date, kind: 'strength', s });
    if (f !== 'strength') for (const c of state.cardio) rows.push({ date: c.date, kind: 'cardio', c });
    rows.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.kind === 'cardio' ? 1 : -1));
    let h = `<div class="tabs">${[['all', 'All'], ['strength', 'Strength'], ['cardio', 'Cardio']].map(([k, l]) => `<a href="#/history?f=${k}" class="${k === f ? 'on' : ''}">${l}</a>`).join('')}</div>
      <p class="tiny muted">${tag('imported')} = verified log from your notes · ${tag('actual')} = logged in the app. Tap a session to view or correct it.</p><div class="list">`;
    for (const r of rows) {
      if (r.kind === 'strength') {
        const t = sessionTotals(r.s);
        h += `<a class="item" href="#/session/${r.s.id}"><div class="meta"><div class="row between"><b>${esc(r.s.title)}</b>${r.s.source === 'imported' ? tag('imported') : tag('actual')}</div>
          <div class="small muted">${fmtDate(r.date, true)}</div><div class="small">${t.exercises} exercises · ${t.sets} working sets · ${t.reps} reps${t.unknownReps ? ` (+${t.unknownReps} sets with unknown reps)` : ''} · ${fmtNum(t.volume)} kg</div></div><span class="chev">›</span></a>`;
      } else {
        const c = r.c;
        h += `<a class="item" href="#/cardio/${c.id}"><div class="meta"><div class="row between"><b>Treadmill</b>${c.source === 'imported' ? tag('imported') : tag('actual')}</div>
          <div class="small muted">${fmtDate(r.date, true)}</div><div class="small">${fmtDur(c.durationSec)} · ${c.distanceKm ?? '?'} km${c.incline != null ? ` · ${c.incline} %` : ''}${c.avgHr ? ` · ${c.avgHr} bpm` : ''}</div></div><span class="chev">›</span></a>`;
      }
    }
    if (!rows.length) h += `<div class="empty">Nothing logged yet.</div>`;
    h += `</div><div class="grid2" style="margin-top:12px"><a class="btn" href="#/workout">Log past workout</a><a class="btn" href="#/cardio/new">Log cardio</a></div>`;
    return h;
  },
};

const findS = (id) => state.sessions.find((s) => s.id === id);

export const sessionView = {
  title: 'Session',
  render({ params }) {
    const s = findS(params[0]);
    if (!s) return `<div class="empty">Session not found. <a href="#/history">History</a></div>`;
    const t = sessionTotals(s);
    let h = `<a href="#/history" class="btn btn-sm btn-ghost">‹ History</a><div class="card hero" style="margin-top:8px"><div class="row between"><span class="muted small">${fmtDate(s.date, true)}</span>${s.source === 'imported' ? tag('imported') : tag('actual')}</div>
      <h1>${esc(s.title)}</h1><div class="kpis"><div class="kpi"><b>${t.sets}</b><span>working sets</span></div><div class="kpi"><b>${t.reps}</b><span>working reps</span></div><div class="kpi"><b>${fmtNum(t.volume)}</b><span>kg volume</span></div></div>
      ${t.unknownReps ? `<p class="small warnc" style="margin:.5em 0 0">${t.unknownReps} working set(s) with unknown reps — not counted in reps or volume.</p>` : ''}
      <p class="tiny muted" style="margin:.5em 0 0">Warm-ups excluded from totals (${t.warmups} warm-up set${t.warmups === 1 ? '' : 's'}).</p>
      ${s.note ? `<p class="small">${esc(s.note)}</p>` : ''}</div>`;
    if (s.source === 'imported') h += `<p class="tiny muted">Imported from your verified notes. Only edit to correct a mistake.</p>`;
    s.entries.forEach((e, ei) => {
      const ex = getEx(state, e.exerciseId);
      const et = setsTotals(e.sets);
      h += `<div class="card"><div class="row between"><b>${esc(exName(ex, state.settings))}</b><span class="tag ${e.status === 'done' ? 'tag-good' : 'tag-warn'}">${STATUS_LABEL[e.status] || e.status}</span></div>
        ${e.variant && e.variant !== 'default' ? `<div class="tiny muted">Variant: ${esc(e.variant)}</div>` : ''}
        ${e.sets.length ? `<table class="sets"><tbody>${e.sets.map((x, si) => `<tr class="${x.kind === 'warmup' ? 'wu' : ''}"><td>${x.kind === 'warmup' ? 'W' : 'S'}</td><td><b>${x.weight ?? '?'}</b> kg × <b>${x.reps ?? '<span class="tag tag-unknown">unknown</span>'}</b>${x.rpe ? ` <span class="tiny muted">RPE ${x.rpe}</span>` : ''}${x.pain ? ' <span class="tag tag-bad">pain</span>' : ''}${x.note ? `<div class="tiny muted">${esc(x.note)}</div>` : ''}</td><td class="act"><button data-act="edit" data-e="${ei}" data-i="${si}">Edit</button></td></tr>`).join('')}</tbody></table>
          <div class="tiny muted">${et.sets} working · ${et.reps} reps · ${fmtKg(et.volume)}</div>` : ''}
        ${e.note ? `<p class="small muted" style="margin:.4em 0 0">${esc(e.note)}</p>` : ''}
        <div class="row" style="margin-top:8px"><button class="btn-sm" data-act="add" data-e="${ei}">+ Set</button><button class="btn-sm" data-act="rmex" data-e="${ei}">Remove exercise</button></div></div>`;
    });
    h += `<div class="grid2" style="margin-top:12px"><button data-act="addex">+ Exercise</button><button data-act="meta">Edit date / title / note</button></div>
      <div style="margin-top:10px"><a class="btn btn-block" href="#/summary/${s.id}">Comparison summary</a></div>
      <details class="card" style="margin-top:12px"><summary>Delete session</summary><p class="small muted">Permanently removes this session from history.</p><button class="btn-danger" data-act="del">Delete session</button></details>`;
    return h;
  },
  actions: {
    edit(el, ev, root, { params }) { editSet(findS(params[0]), Number(el.dataset.e), Number(el.dataset.i)); },
    add(el, ev, root, { params }) { editSet(findS(params[0]), Number(el.dataset.e), -1); },
    async rmex(el, ev, root, { params }) {
      if (!(await confirmBox('Remove this exercise and its sets from the session?', 'Remove', true))) return;
      findS(params[0]).entries.splice(Number(el.dataset.e), 1); save(); go(location.hash);
    },
    addex(el, ev, root, { params }) {
      pickExercise('Add exercise to session', null, (id) => { findS(params[0]).entries.push({ exerciseId: id, variant: 'default', status: 'done', sets: [], note: '' }); save(); go(location.hash); });
    },
    meta(el, ev, root, { params }) {
      const s = findS(params[0]);
      openSheet(`<h2>Session details</h2><label>Date</label><input type="date" id="m-date" value="${s.date}"><label>Title</label><input id="m-title" value="${esc(s.title)}"><label>Note</label><textarea id="m-note">${esc(s.note || '')}</textarea>
        <button class="btn-primary btn-block" style="margin-top:12px" id="m-save">Save</button>`, (r, close) => {
        r.querySelector('#m-save').onclick = () => { s.date = r.querySelector('#m-date').value || s.date; s.title = r.querySelector('#m-title').value; s.note = r.querySelector('#m-note').value; save(); close(); go(location.hash); };
      });
    },
    async del(el, ev, root, { params }) {
      if (!(await confirmBox('Delete this session permanently?', 'Delete', true))) return;
      state.sessions = state.sessions.filter((x) => x.id !== params[0]); save(); toast('Session deleted'); go('#/history');
    },
  },
};

function editSet(s, ei, si) {
  const e = s.entries[ei];
  const x = si >= 0 ? e.sets[si] : { kind: 'working', weight: e.sets[e.sets.length - 1]?.weight ?? null, reps: e.sets[e.sets.length - 1]?.reps ?? null, note: '' };
  openSheet(`<h2>${si >= 0 ? 'Edit set' : 'Add set'}</h2><input type="hidden" name="kind" value="${x.kind}">
    <div class="seg" data-seg="kind"><button type="button" data-v="warmup" class="${x.kind === 'warmup' ? 'on wu' : ''}">Warm-up</button><button type="button" data-v="working" class="${x.kind !== 'warmup' ? 'on w' : ''}">Working</button></div>
    <div class="stepgrid" style="margin-top:10px"><div><label>Weight (kg)</label>${stepper('weight', x.weight ?? '', state.settings.weightStep, 'kg', { dec: 2 })}</div><div><label>Reps (empty = unknown)</label>${stepper('reps', x.reps ?? '', 1, 'reps', { dec: 0 })}</div></div>
    <label>Note</label><input name="note" value="${esc(x.note || '')}">
    <div class="grid2" style="margin-top:12px">${si >= 0 ? '<button class="btn-danger" id="d">Delete set</button>' : '<button data-close>Cancel</button>'}<button class="btn-primary" id="ok">Save</button></div>`, (r, close) => {
    wireAll(r);
    r.querySelector('#ok').onclick = () => {
      const v = { ...x, kind: r.querySelector('[name=kind]').value, weight: numOrNull(r.querySelector('[name=weight]').value), reps: numOrNull(r.querySelector('[name=reps]').value), note: r.querySelector('[name=note]').value };
      if (v.weight == null) return toast('Enter a weight');
      if (si >= 0) e.sets[si] = v; else e.sets.push({ n: e.sets.length + 1, rpe: null, rir: null, formIssue: false, pain: false, ts: new Date().toISOString(), ...v });
      if (e.status === 'unavailable' || e.status === 'skipped') e.status = 'done';
      save(); close(); go(location.hash);
    };
    r.querySelector('#d')?.addEventListener('click', () => { e.sets.splice(si, 1); save(); close(); go(location.hash); });
  });
}
