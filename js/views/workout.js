// Today's Workout, Live Gym Mode (list + logger) and the session summary.
import { state, save } from '../store.js';
import { esc, tag, uid, isoDate, fmtDate, fmtShort, fmtKg, fmtNum, numOrNull, DAY_ORDER, DAY_NAMES, dayKey, fmtDur } from '../util.js';
import { EXERCISES, exName, exSub } from '../data/exercises.js';
import { getEx, suggestNext, lastPerformance, painStatus, setsTotals, sessionTotals, sessionComparison, workingSets, compareSets, SEEK_HELP } from '../logic.js';
import { visual, thumb, exTitle, stepper, scale, openSheet, closeSheet, toast, go, confirmBox, startTimer, stopTimer, restFor, setExSetting, wireAll } from '../ui.js';

const STATUS_LABEL = { todo: 'To do', active: 'In progress', done: 'Done', skipped: 'Skipped', substituted: 'Substituted', unavailable: 'Unavailable' };
const statusTag = (s) => `<span class="tag ${s === 'done' ? 'tag-good' : s === 'active' ? 'tag-target' : s === 'todo' ? 'tag-unknown' : 'tag-warn'}">${STATUS_LABEL[s] || s}</span>`;

export function planFor(dayKeyOrRoutine) {
  if (state.plan[dayKeyOrRoutine]) return { ...state.plan[dayKeyOrRoutine], key: dayKeyOrRoutine, kind: 'day' };
  const r = state.routines.find((x) => x.id === dayKeyOrRoutine);
  return r ? { type: r.type === 'mobility' ? 'strength' : r.type, title: r.name, priority: r.focus, note: '', items: r.items, key: r.id, kind: 'routine' } : null;
}

function effectiveItems(plan) {
  let items = plan.items.map((i) => ({ ...i }));
  if (state.settings.shortMode) items = items.filter((i) => !i.optional).map((i) => ({ ...i, sets: Math.max(1, i.sets - 1) }));
  return items;
}

const presc = (i) => `${i.sets} × ${i.repsMin}${i.repsMax !== i.repsMin ? '–' + i.repsMax : ''}${getEx(state, i.exerciseId)?.type === 'hold' ? ' s' : ''}`;

function setsText(sets) {
  return sets.map((s) => `${s.weight ?? '?'}×${s.reps ?? '?'}`).join(', ');
}

function suggestionHTML(sg) {
  const cls = sg.blocked ? 'warn' : 'info';
  const statusWord = { increase: 'Load step', reps: 'Add reps', consolidate: 'Consolidate', hold: 'Hold', reduce: 'Reduce', skip: 'Consider skipping', establish: 'Establish', deload: 'Deload' }[sg.status] || sg.status;
  return `<div class="card tight ${cls}"><div class="row between"><b>${statusWord}</b>${tag('suggestion')}</div>
    <p class="small" style="margin:.3em 0 0">${esc(sg.text)}</p>
    ${sg.weight != null || sg.reps != null ? `<p class="small" style="margin:.3em 0 0">Next target: <b>${sg.sets} × ${sg.weight != null ? sg.weight + ' kg' : '—'} × ${sg.reps ?? '—'}${sg.status === 'reps' || sg.status === 'increase' ? '+' : ''}</b> ${tag('target')}</p>` : ''}
    ${sg.blocked ? `<p class="tiny muted" style="margin:.4em 0 0">Progression paused: ${esc(sg.reasons.join('; '))}.</p>` : ''}
  </div>`;
}

// ======================= TODAY =======================
export const today = {
  title: "Today's workout",
  render({ query }) {
    const todayISO = isoDate();
    const key = query.day || dayKey(todayISO);
    const plan = planFor(key);
    if (!plan) return `<div class="empty">Plan not found. <a href="#/workout">Back</a></div>`;
    const isToday = key === dayKey(todayISO);
    const pain = painStatus(state);
    const items = plan.type === 'strength' ? effectiveItems(plan) : [];
    const act = state.active;
    let h = `<div class="tabs" role="tablist">${DAY_ORDER.map((d) => `<a href="#/workout?day=${d}" class="${d === key ? 'on' : ''}">${DAY_NAMES[d].slice(0, 3)}${d === dayKey(todayISO) ? ' •' : ''}</a>`).join('')}
      ${state.routines.map((r) => `<a href="#/workout?day=${r.id}" class="${r.id === key ? 'on' : ''}">${esc(r.name)}</a>`).join('')}</div>`;
    h += `<div class="card hero" style="margin-top:10px"><div class="muted small">${plan.kind === 'day' ? (isToday ? 'Today · ' : '') + DAY_NAMES[key] : 'Custom routine'}</div>
      <h1>${esc(plan.title)}</h1>${plan.priority ? `<div class="muted">Priority: ${esc(plan.priority)}</div>` : ''}
      ${plan.note ? `<p class="small" style="margin-top:8px">${esc(plan.note)}</p>` : ''}</div>`;
    if (act) h += `<div class="card warn"><b>Workout in progress</b> — ${esc(act.title)} (${fmtDate(act.date)}). <div class="row" style="margin-top:8px"><a class="btn btn-orange" href="#/live">Resume workout</a></div></div>`;

    if (plan.type === 'rest') {
      h += `<div class="card"><h2>Rest &amp; recovery day</h2><p class="muted">Recovery is part of the plan. Optional: an easy walk or the short morning mobility routine.</p>
        <div class="row"><a class="btn" href="#/workout?day=r_morning_mob">Morning mobility</a><a class="btn" href="#/recovery/new">Recovery check-in</a></div></div>`;
    } else if (plan.type === 'cardio') {
      const k = pain.knee;
      h += `<div class="card ${k.active ? 'warn' : ''}"><h2>Treadmill guidance ${tag('target')}</h2>
        <ul class="clean"><li>Duration ~40–50 min, speed ~4.5–5 km/h.</li>
        <li>${k.active ? '<b>Knee symptom active:</b> start at 0–3 % incline, reassess after 5–10 min. Higher incline is not mandatory.' : 'Knee pain-free: progress time or incline gradually (comfortable, not mandatory 9–12 %).'}</li>
        <li>Should feel relatively easy — you can talk.</li></ul>
        <div class="grid2"><a class="btn btn-primary" href="#/cardio/new">Log treadmill session</a><a class="btn" href="#/recovery/new?context=treadmill&timing=before">Knee check before</a></div></div>`;
    } else {
      const gates = [];
      if (pain.arm.active) gates.push(`<b>Left upper arm:</b> ${esc(pain.arm.reason)}. Upper-body load increases are paused; consider fewer pressing sets.`);
      if (pain.knee.active) gates.push(`<b>Right knee:</b> ${esc(pain.knee.reason)}. Knee-loading progressions are paused; skipping leg exercises is fine.`);
      if (gates.length) h += `<div class="card warn"><div class="row between"><b>Pain-aware adjustments</b>${tag('suggestion')}</div><ul class="clean small">${gates.map((g) => `<li>${g}</li>`).join('')}</ul><p class="tiny muted">${SEEK_HELP}</p></div>`;
      h += `<div class="card tight"><div class="row between"><span class="small">Short version (tired) — fewer sets, optional moves dropped</span><input type="checkbox" data-change="short" ${state.settings.shortMode ? 'checked' : ''} aria-label="Short version"></div>
        <div class="row between"><span class="small">Deload week — lighter targets</span><input type="checkbox" data-change="deload" ${state.settings.deload ? 'checked' : ''} aria-label="Deload week"></div></div>`;
      h += `<div class="section-title"><h2>Exercises</h2><span class="muted small">any order</span></div><div class="list">`;
      for (const it of items) {
        const ex = getEx(state, it.exerciseId);
        const last = lastPerformance(state, it.exerciseId, { beforeDate: isoDate(new Date(Date.now() + 864e5)) });
        const sg = suggestNext(state, it.exerciseId, it, { pain });
        h += `<a class="item" href="#/exercise/${it.exerciseId}?from=workout">${thumb(it.exerciseId)}
          <div class="meta"><b>${esc(exName(ex, state.settings))} ${it.optional ? '<span class="tag tag-unknown">optional</span>' : ''}</b><div class="muted small">${esc(exSub(ex, state.settings))}</div>
          <div class="small">${presc(it)} ${tag('target')}${it.setsNote ? ` <span class="dim tiny">(${esc(it.setsNote)})</span>` : ''}</div>
          <div class="small">${last ? `Last ${fmtShort(last.date)}: ${setsText(last.sets)} ${tag('actual')}` : `<span class="muted">No logged history</span> ${it.history ? `<span class="dim tiny">· ${esc(it.history)}</span>` : ''}`}</div>
          <div class="small">${sg.weight != null ? `Next: ${sg.weight} kg × ${sg.reps}` : 'Next: establish weight'} ${tag('suggestion')}${sg.blocked ? ' <span class="tag tag-warn">pain-adjusted</span>' : ''}</div></div><span class="chev">›</span></a>`;
      }
      h += `</div>`;
      h += `<div class="fab-row">${act ? `<a class="btn btn-big btn-orange" href="#/live">Resume workout</a>` : `<button class="btn-big btn-primary" data-act="start" data-key="${esc(key)}">Start workout</button>`}</div>`;
      h += `<details class="card"><summary>Log a past workout</summary><p class="small muted">Record a session that already happened (e.g. from paper notes). It is stored with the date you choose.</p>
        <label for="pastdate">Date</label><input type="date" id="pastdate" max="${isoDate()}" value="${isoDate()}"><div style="margin-top:10px"><button data-act="start" data-key="${esc(key)}" data-past="1" ${act ? 'disabled' : ''}>Log past ${esc(plan.title)}</button></div></details>`;
    }
    return h;
  },
  changes: {
    short(el) { state.settings.shortMode = el.checked; save(); go(location.hash); },
    deload(el) { state.settings.deload = el.checked; save(); go(location.hash); },
  },
  actions: {
    start(el, ev, root) {
      const key = el.dataset.key;
      const date = el.dataset.past ? root.querySelector('#pastdate').value || isoDate() : isoDate();
      preCheck(key, date, !!el.dataset.past);
    },
  },
};

export function preCheck(key, date, past) {
  const plan = planFor(key);
  const knee = !!plan.knee;
  openSheet(`<h2>Quick check before you start</h2><p class="muted small">Optional — helps adjust suggestions. 0 = no pain.</p>
    <label>Right knee (0–10)${knee ? ' — leg day' : ''}</label>${scale('knee', null)}
    <label>Left upper arm / armpit (0–10)</label>${scale('arm', null)}
    <div class="grid2" style="margin-top:16px"><button id="pc-skip">Skip</button><button class="btn-primary" id="pc-go">Start</button></div>`, (root, close) => {
    wireAll(root);
    const startIt = (withCheck) => {
      if (withCheck) {
        const k = numOrNull(root.querySelector('[name=knee]').value), a = numOrNull(root.querySelector('[name=arm]').value);
        if (k != null || a != null) state.checkins.push({ id: uid('ci'), date, timing: 'before', context: plan.type === 'cardio' ? 'treadmill' : 'strength', knee: k, arm: a, kneeLocation: k ? 'Right knee' : '', armLocation: a ? 'Left upper arm' : '', effort: null, fatigue: null, soreness: '', sleepH: null, unusual: '', notes: 'Pre-workout check', source: 'logged' });
      }
      startSession(key, date, past);
      close();
    };
    root.querySelector('#pc-skip').onclick = () => startIt(false);
    root.querySelector('#pc-go').onclick = () => startIt(true);
  });
}

function startSession(key, date, past) {
  const plan = planFor(key);
  const items = effectiveItems(plan);
  state.active = {
    id: uid('s'), date, type: 'strength', title: plan.title, planDay: plan.kind === 'day' ? key : null, routineId: plan.kind === 'routine' ? key : null,
    source: past ? 'logged-past' : 'logged', status: 'active', startedAt: new Date().toISOString(), finishedAt: null,
    short: state.settings.shortMode, deload: state.settings.deload, note: '',
    entries: items.map((i) => ({ exerciseId: i.exerciseId, variant: state.exerciseSettings[i.exerciseId]?.defaultVariant || 'default', status: 'todo', sets: [], note: '', plan: { sets: i.sets, repsMin: i.repsMin, repsMax: i.repsMax, optional: !!i.optional } })),
  };
  save();
  go('#/live');
}

// ======================= LIVE LIST =======================
export const live = {
  title: 'Live gym mode',
  render() {
    const a = state.active;
    if (!a) return `<div class="empty"><h2>No workout running</h2><p>Start today's workout to log sets.</p><a class="btn btn-primary" href="#/workout">Today's workout</a></div>`;
    const t = sessionTotals(a);
    const mins = a.source === 'logged' ? Math.round((Date.now() - new Date(a.startedAt)) / 60000) : null;
    let h = `<div class="card hero"><div class="muted small">${fmtDate(a.date)}${a.source === 'logged-past' ? ' · past workout' : ''}${mins != null ? ` · ${mins} min` : ''}</div><h1>${esc(a.title)}</h1>
      <div class="kpis"><div class="kpi"><b>${t.sets}</b><span>working sets</span></div><div class="kpi"><b>${t.reps}</b><span>reps</span></div><div class="kpi"><b>${fmtNum(t.volume)}</b><span>kg volume</span></div></div>
      <p class="tiny muted" style="margin:.6em 0 0">Tap any exercise — order is free. ${tag('actual')} values only come from sets you log.</p></div><div class="list" style="margin-top:12px">`;
    a.entries.forEach((e, idx) => {
      const ex = getEx(state, e.exerciseId);
      const w = workingSets(e).length;
      const st = e.status === 'todo' && e.sets.length ? 'active' : e.status;
      h += `<a class="item ${e.status}" href="#/live/${idx}">${thumb(e.exerciseId)}<div class="meta"><b>${esc(exName(ex, state.settings))}</b><div class="muted small">${esc(exSub(ex, state.settings))}</div>
        <div class="small">${statusTag(st)} ${w}/${e.plan?.sets ?? '–'} sets${e.plan?.optional ? ' · optional' : ''}${e.substituteFor ? ` · replaces ${esc(getEx(state, e.substituteFor)?.en || '')}` : ''}</div></div><span class="chev">›</span></a>`;
    });
    h += `</div><div class="grid2" style="margin-top:12px"><button data-act="add">+ Add exercise</button><button data-act="note">Session note</button></div>
      <div class="fab-row"><button class="btn-big btn-primary" data-act="finish">Finish workout</button></div>
      <details class="card"><summary>Discard workout</summary><p class="small muted">Deletes this unfinished workout and its sets. History is not affected.</p><button class="btn-danger" data-act="discard">Discard workout</button></details>`;
    return h;
  },
  actions: {
    add() { pickExercise('Add an exercise', null, (id) => { state.active.entries.push(newEntry(id)); save(); go('#/live/' + (state.active.entries.length - 1)); }); },
    note() {
      openSheet(`<h2>Session note</h2><textarea id="sn">${esc(state.active.note || '')}</textarea><div style="margin-top:10px"><button class="btn-primary btn-block" id="sn-save">Save</button></div>`, (root, close) => {
        root.querySelector('#sn-save').onclick = () => { state.active.note = root.querySelector('#sn').value; save(); close(); toast('Note saved'); };
      });
    },
    async finish() {
      const a = state.active;
      const t = sessionTotals(a);
      if (!t.sets && !(await confirmBox('No working sets logged. Finish anyway?', 'Finish'))) return;
      if (t.sets && !(await confirmBox('Finish workout and see the summary?', 'Finish'))) return;
      for (const e of a.entries) if (e.status === 'todo') e.status = e.sets.length ? 'done' : 'skipped';
      a.status = 'finished'; a.finishedAt = new Date().toISOString();
      state.sessions.push(a); state.active = null; stopTimer();
      save();
      go('#/summary/' + a.id);
    },
    async discard() {
      if (!(await confirmBox('Discard this workout?', 'Discard', true))) return;
      state.active = null; stopTimer(); save(); go('#/workout');
    },
  },
};

function newEntry(id, extra = {}) {
  const ex = getEx(state, id);
  return { exerciseId: id, variant: state.exerciseSettings[id]?.defaultVariant || 'default', status: 'todo', sets: [], note: '', plan: { sets: 2, repsMin: ex?.type === 'hold' ? 30 : 10, repsMax: ex?.type === 'hold' ? 45 : 12, optional: true }, ...extra };
}

export function pickExercise(title, preferIds, onPick) {
  const pref = (preferIds || []).map((id) => getEx(state, id)).filter(Boolean);
  const all = [...EXERCISES, ...state.customExercises].filter((e) => e.type !== 'cardio');
  const row = (e) => `<button class="item" style="width:100%;text-align:left" data-pick="${e.id}">${thumb(e.id)}<div class="meta"><b>${esc(exName(e, state.settings))}</b><span class="muted small">${esc(exSub(e, state.settings))} · ${esc(e.category)}</span></div></button>`;
  openSheet(`<h2>${esc(title)}</h2>${pref.length ? `<h3 class="muted">Suggested alternatives</h3><div class="list">${pref.map(row).join('')}</div><h3 class="muted" style="margin-top:14px">All exercises</h3>` : ''}
    <div class="list">${all.map(row).join('')}</div><button style="margin-top:12px" class="btn-block" data-close>Cancel</button>`, (root, close) => {
    root.addEventListener('click', (e) => { const b = e.target.closest('[data-pick]'); if (b) { close(); onPick(b.dataset.pick); } });
  });
}

// ======================= LOGGER =======================
function entryOf(params) {
  const a = state.active; if (!a) return null;
  const idx = Number(params[0]);
  return a.entries[idx] ? { a, e: a.entries[idx], idx } : null;
}

function prefill(a, e, kind) {
  const last = lastPerformance(state, e.exerciseId, { variant: e.variant, beforeDate: a.date });
  const sg = suggestNext(state, e.exerciseId, e.plan || {}, { today: a.date, variant: e.variant });
  const ex = getEx(state, e.exerciseId);
  if (kind === 'warmup') {
    const lastWu = last?.entry.sets.find((s) => s.kind === 'warmup');
    const prevWu = [...e.sets].reverse().find((s) => s.kind === 'warmup');
    const base = last ? Math.max(...last.sets.map((s) => s.weight ?? 0)) : 0;
    const inc = ex?.increment || 5;
    return { weight: prevWu?.weight ?? lastWu?.weight ?? (base ? Math.round((base * 0.6) / inc) * inc : ''), reps: prevWu?.reps ?? lastWu?.reps ?? 8 };
  }
  const n = workingSets(e).length; // index of next working set
  const prev = workingSets(e)[n - 1];
  const lastSet = last?.sets[n] || last?.sets[last.sets.length - 1];
  let weight = prev?.weight ?? lastSet?.weight ?? sg.weight ?? '';
  let reps = lastSet?.reps ?? prev?.reps ?? sg.reps ?? e.plan?.repsMin ?? 10;
  if (sg.blocked && sg.weight != null && !prev) weight = sg.weight; // pain: start from the reduced suggestion
  return { weight, reps, last, sg, lastSet };
}

export const logger = {
  title: 'Log sets',
  render({ params, query }) {
    const r = entryOf(params);
    if (!r) return `<div class="empty">This exercise is not in the current workout. <a href="#/live">Back to workout</a></div>`;
    const { a, e, idx } = r;
    const ex = getEx(state, e.exerciseId);
    const kind = query.kind === 'warmup' ? 'warmup' : 'working';
    const pf = prefill(a, e, kind);
    const { last, sg } = prefill(a, e, 'working');
    const rest = restFor(e.exerciseId);
    const variants = state.exerciseSettings[e.exerciseId]?.variants || [];
    const step = ex?.perHand ? 1 : (state.exerciseSettings[e.exerciseId]?.increment ? Math.min(state.settings.weightStep, state.exerciseSettings[e.exerciseId].increment) : state.settings.weightStep);
    const isHold = ex?.type === 'hold';
    const wn = workingSets(e).length;
    let h = `<div class="row between nw"><a href="#/live" class="btn btn-sm btn-ghost">‹ All exercises</a>${statusTag(e.status === 'todo' && e.sets.length ? 'active' : e.status)}</div>
      <div style="margin:8px 0 10px">${exTitle(e.exerciseId).replace('<span', '<br><span')}</div>
      ${visual(e.exerciseId)}
      ${ex?.machineNote ? `<p class="tiny muted">${esc(ex.machineNote)}</p>` : ''}
      <details class="card tight" style="margin-top:10px"><summary>Setup &amp; cues</summary><ul class="clean small">${(ex?.setup || []).concat(ex?.cues || []).map((c) => `<li>${esc(c)}</li>`).join('')}</ul>
        ${ex?.armNote ? `<p class="small"><b>Left arm:</b> ${esc(ex.armNote)}</p>` : ''}${ex?.kneeNote ? `<p class="small"><b>Knee:</b> ${esc(ex.kneeNote)}</p>` : ''}<a href="#/exercise/${e.exerciseId}" class="small">Full exercise details ›</a></details>
      <div class="wide2" style="margin-top:10px">
      <div class="card tight"><div class="row between"><b>Last time</b>${last ? tag('actual') : ''}</div>
        ${last ? `<div class="small muted">${fmtDate(last.date)}${last.source === 'imported' ? ' · imported log' : ''}</div><div style="font-size:1.05rem;margin-top:4px">${last.sets.map((s, i) => `<span class="nowrap">${i + 1}: <b>${s.weight ?? '?'}</b> kg × <b>${s.reps ?? '<span class="tag tag-unknown">unknown</span>'}</b></span>`).join(' · ')}</div>
          <div class="tiny muted">${setsTotals(last.entry.sets).sets} working sets · ${fmtKg(setsTotals(last.entry.sets).volume)}${last.totals.unknownReps ? ' (reps unknown — volume incomplete)' : ''}</div>` : '<div class="small muted">No previous record for this exercise' + (e.variant !== 'default' ? ' on this machine variant' : '') + '.</div>'}</div>
      ${suggestionHTML(sg)}</div>`;
    if (variants.length) {
      h += `<label>Machine variant (weights not comparable across equipment)</label><select data-change="variant"><option value="default" ${e.variant === 'default' ? 'selected' : ''}>Default machine</option>${variants.map((v) => `<option ${e.variant === v ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select>`;
    }
    // ---- set entry ----
    h += `<form class="card" data-form="logset" style="margin-top:12px">
      <div class="row between"><h2 style="margin:0">${kind === 'warmup' ? 'Warm-up set' : `Working set ${wn + 1}`}<span class="muted small"> ${kind === 'working' && e.plan ? `of ${e.plan.sets} planned` : ''}</span></h2></div>
      <div class="seg" style="margin:10px 0"><button type="button" data-act="kind" data-kind="warmup" class="${kind === 'warmup' ? 'on wu' : ''}">Warm-up</button><button type="button" data-act="kind" data-kind="working" class="${kind === 'working' ? 'on w' : ''}">Working</button></div>
      <div class="stepgrid">
        <div><div class="steplabel"><label>Weight${ex?.perHand ? ' (per hand)' : ''}</label></div>${stepper('weight', pf.weight, step, 'kg', { dec: 2 })}</div>
        <div><div class="steplabel"><label>${isHold ? 'Seconds' : 'Reps'}</label></div>${stepper('reps', pf.reps, isHold ? 5 : 1, isHold ? 'sec' : 'reps', { dec: 0 })}</div>
      </div>
      <div class="mini-steps"><button type="button" data-act="wstep" data-d="-5">−5</button><button type="button" data-act="wstep" data-d="-1">−1</button><button type="button" data-act="wstep" data-d="1">+1</button><button type="button" data-act="wstep" data-d="5">+5</button></div>
      <details style="margin-top:8px"><summary class="small muted" style="min-height:40px;display:flex;align-items:center">RPE / RIR, form &amp; pain flags (optional)</summary>
        <label>RPE (effort 6–10)</label><div class="chips" data-chips="rpe">${[6, 7, 7.5, 8, 8.5, 9, 9.5, 10].map((v) => `<button type="button" class="chip" data-v="${v}">${v}</button>`).join('')}</div>
        <label>RIR (reps left in reserve)</label><div class="chips" data-chips="rir">${[0, 1, 2, 3, 4].map((v) => `<button type="button" class="chip" data-v="${v}">${v}</button>`).join('')}</div>
        <input type="hidden" name="rpe"><input type="hidden" name="rir">
        <label class="check"><input type="checkbox" name="formIssue"> Technique was not clean</label>
        <label class="check"><input type="checkbox" name="pain"> Pain / discomfort during this set</label>
        <input name="note" placeholder="Note (optional)" style="margin-top:6px">
      </details>
      <button class="btn-big btn-primary" style="margin-top:12px" type="submit">Log ${kind === 'warmup' ? 'warm-up' : 'set'}</button>
    </form>`;
    // ---- logged sets ----
    if (e.sets.length) {
      let wi = 0;
      h += `<div class="card"><div class="row between"><h2 style="margin:0">Logged sets</h2>${tag('actual')}</div><table class="sets"><thead><tr><th>#</th><th>Set</th><th>vs last</th><th></th></tr></thead><tbody>`;
      e.sets.forEach((s, si) => {
        const isW = s.kind !== 'warmup';
        const ref = isW ? last?.sets[wi] : null;
        if (isW) wi++;
        let d = '';
        if (ref && ref.reps != null && s.reps != null) {
          const dv = s.weight * s.reps - ref.weight * ref.reps;
          d = `<span class="delta ${dv > 0 ? 'up' : dv < 0 ? 'down' : 'same'}">${dv > 0 ? '▲' : dv < 0 ? '▼' : '='} ${ref.weight}×${ref.reps}</span>`;
        }
        h += `<tr class="${isW ? '' : 'wu'}"><td>${isW ? wi : 'W'}</td><td><b>${s.weight ?? '?'}</b> kg × <b>${s.reps ?? '?'}</b>${s.rpe ? ` <span class="tiny muted">RPE ${s.rpe}</span>` : ''}${s.rir != null ? ` <span class="tiny muted">RIR ${s.rir}</span>` : ''}${s.formIssue ? ' <span class="tag tag-warn">form</span>' : ''}${s.pain ? ' <span class="tag tag-bad">pain</span>' : ''}</td><td class="small">${d}</td>
          <td class="act"><button type="button" data-act="editset" data-i="${si}">Edit</button></td></tr>`;
      });
      const t = setsTotals(e.sets);
      h += `</tbody></table><div class="small muted" style="margin-top:6px">${t.sets} working sets · ${t.reps} reps · ${fmtKg(t.volume)} working volume (warm-ups excluded)</div></div>`;
    }
    // ---- rest + status ----
    h += `<div class="card tight"><div class="row between"><b>Rest timer</b><span class="muted small">${rest} s for this exercise</span></div>
      <div class="chips" style="margin-top:6px">${[60, 75, 90, 105, 120].map((v) => `<button type="button" class="chip ${v === rest ? 'on' : ''}" data-act="rest" data-v="${v}">${v}s</button>`).join('')}<button type="button" class="chip" data-act="restnow">Start now</button></div></div>
      <div class="section-title"><h2>Exercise status</h2></div>
      <div class="grid2"><button class="btn-primary" data-act="status" data-s="done">✓ Done</button><button data-act="status" data-s="unavailable">Machine busy</button>
      <button data-act="status" data-s="skipped">Skip</button><button data-act="substitute">Substitute…</button></div>
      <p class="tiny muted">"Machine busy" keeps it in the list so you can come back later. Skipping is never treated as a failure.</p>`;
    const nextIdx = a.entries.findIndex((x, i) => i !== idx && (x.status === 'todo' || x.status === 'unavailable'));
    h += `<div class="grid2" style="margin-top:10px"><a class="btn" href="#/live">‹ Exercise list</a>${nextIdx >= 0 ? `<a class="btn" href="#/live/${nextIdx}">Next: ${esc(getEx(state, a.entries[nextIdx].exerciseId)?.en || '')} ›</a>` : `<button data-act="gofinish">Finish workout</button>`}</div>`;
    return h;
  },
  after(root) {
    root.querySelectorAll('[data-chips]').forEach((c) => c.addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-v]'); if (!b) return;
      const input = root.querySelector(`input[name=${c.dataset.chips}]`);
      const was = b.classList.contains('on');
      c.querySelectorAll('.chip').forEach((x) => x.classList.remove('on'));
      if (!was) { b.classList.add('on'); input.value = b.dataset.v; } else input.value = '';
    }));
  },
  forms: {
    logset(form, { params, query }) {
      const r = entryOf(params); if (!r) return;
      const { e } = r;
      const fd = new FormData(form);
      const weight = numOrNull(fd.get('weight')), reps = numOrNull(fd.get('reps'));
      if (weight == null || reps == null) return toast('Enter weight and reps');
      const kind = query.kind === 'warmup' ? 'warmup' : 'working';
      e.sets.push({ n: e.sets.length + 1, kind, weight, reps, rpe: numOrNull(fd.get('rpe')), rir: numOrNull(fd.get('rir')), note: fd.get('note') || '', formIssue: !!fd.get('formIssue'), pain: !!fd.get('pain'), ts: new Date().toISOString() });
      if (e.status !== 'done') e.status = 'todo';
      save();
      navigator.vibrate?.(30);
      const ex = getEx(state, e.exerciseId);
      if (fd.get('pain')) toast('Pain flagged — consider stopping this exercise. Suggestions will not increase load.', 3500);
      if (state.active.source === 'logged') startTimer(restFor(e.exerciseId), `${ex?.en || 'Rest'}`);
      const planned = e.plan?.sets || 0;
      if (kind === 'working' && planned && workingSets(e).length === planned) toast(`All ${planned} planned sets logged — mark Done or add an extra set`, 3000);
      go(`#/live/${params[0]}`);
    },
  },
  changes: {
    variant(el, { params }) { const r = entryOf(params); r.e.variant = el.value; save(); go(location.hash); },
  },
  actions: {
    kind(el, ev, root, { params }) { go(`#/live/${params[0]}${el.dataset.kind === 'warmup' ? '?kind=warmup' : ''}`); },
    wstep(el, ev, root) { const i = root.querySelector('input[name=weight]'); i.value = Math.max(0, (numOrNull(i.value) || 0) + Number(el.dataset.d)); },
    rest(el, ev, root, { params }) { const r = entryOf(params); setExSetting(r.e.exerciseId, 'restSec', Number(el.dataset.v)); go(location.hash); },
    restnow(el, ev, root, { params }) { const r = entryOf(params); startTimer(restFor(r.e.exerciseId), getEx(state, r.e.exerciseId)?.en || 'Rest'); },
    status(el, ev, root, { params }) {
      const r = entryOf(params);
      r.e.status = el.dataset.s; save();
      toast(`${getEx(state, r.e.exerciseId)?.en}: ${STATUS_LABEL[el.dataset.s]}`);
      go('#/live');
    },
    substitute(el, ev, root, { params }) {
      const r = entryOf(params);
      const ex = getEx(state, r.e.exerciseId);
      pickExercise('Substitute with…', ex?.alternatives, (id) => {
        r.e.status = 'substituted'; r.e.substitutedBy = id;
        r.a.entries.push(newEntry(id, { substituteFor: r.e.exerciseId, plan: { ...(r.e.plan || {}), optional: false } }));
        save(); go('#/live/' + (r.a.entries.length - 1));
      });
    },
    gofinish() { go('#/live'); setTimeout(() => document.querySelector('[data-act=finish]')?.click(), 50); },
    editset(el, ev, root, { params }) {
      const r = entryOf(params); const si = Number(el.dataset.i); const s = r.e.sets[si];
      openSheet(`<h2>Edit set</h2><input type="hidden" name="kind" value="${s.kind}"><div class="seg" data-seg="kind"><button type="button" data-v="warmup" class="${s.kind === 'warmup' ? 'on wu' : ''}">Warm-up</button><button type="button" data-v="working" class="${s.kind !== 'warmup' ? 'on w' : ''}">Working</button></div>
        <div class="stepgrid" style="margin-top:10px"><div><label>Weight</label>${stepper('weight', s.weight, state.settings.weightStep, 'kg', { dec: 2 })}</div><div><label>Reps</label>${stepper('reps', s.reps, 1, 'reps', { dec: 0 })}</div></div>
        <label>Note</label><input name="note" value="${esc(s.note || '')}">
        <label class="check"><input type="checkbox" name="formIssue" ${s.formIssue ? 'checked' : ''}> Technique was not clean</label>
        <label class="check"><input type="checkbox" name="pain" ${s.pain ? 'checked' : ''}> Pain / discomfort</label>
        <div class="grid2" style="margin-top:12px"><button class="btn-danger" id="es-del">Delete set</button><button class="btn-primary" id="es-save">Save</button></div>`, (sr, close) => {
        wireAll(sr);
        sr.querySelector('#es-save').onclick = () => {
          s.kind = sr.querySelector('[name=kind]').value; s.weight = numOrNull(sr.querySelector('[name=weight]').value); s.reps = numOrNull(sr.querySelector('[name=reps]').value);
          s.note = sr.querySelector('[name=note]').value; s.formIssue = sr.querySelector('[name=formIssue]').checked; s.pain = sr.querySelector('[name=pain]').checked;
          save(); close(); go(location.hash);
        };
        sr.querySelector('#es-del').onclick = () => { r.e.sets.splice(si, 1); save(); close(); go(location.hash); };
      });
    },
  },
};

// ======================= SUMMARY =======================
const dlt = (v, unit = '', dec = 0) => (v == null ? '' : `<span class="delta ${v > 0 ? 'up' : v < 0 ? 'down' : 'same'}">${v > 0 ? '+' : ''}${fmtNum(v, dec)}${unit}</span>`);

export const summary = {
  title: 'Workout summary',
  render({ params }) {
    const s = state.sessions.find((x) => x.id === params[0]);
    if (!s) return `<div class="empty">Session not found. <a href="#/history">History</a></div>`;
    const c = sessionComparison(state, s);
    const t = c.totals;
    const planned = s.entries.reduce((acc, e) => acc + (e.plan && !e.plan.optional ? e.plan.sets : 0), 0);
    const hasAfter = state.checkins.some((k) => k.date === s.date && k.timing === 'after' && k.sessionId === s.id);
    let h = `<div class="card hero"><div class="muted small">${fmtDate(s.date, true)} · ${tag('actual')}</div><h1>${esc(s.title)} — done</h1>
      <div class="kpis"><div class="kpi"><b>${t.sets}</b><span>working sets ${c.prevTotals ? dlt(t.sets - c.prevTotals.sets) : ''}</span></div>
      <div class="kpi"><b>${t.reps}</b><span>reps ${c.prevTotals ? dlt(t.reps - c.prevTotals.reps) : ''}</span></div>
      <div class="kpi"><b>${fmtNum(t.volume)}</b><span>kg volume ${c.prevTotals ? dlt(t.volume - c.prevTotals.volume, ' kg') : ''}</span></div></div>
      ${c.prev ? `<p class="small muted" style="margin:.6em 0 0">${c.samePlan ? 'Compared with' : 'First session of this plan — totals compared with your most recent (different) workout:'} ${esc(c.prev.title)} on ${fmtDate(c.prev.date)}${c.prevTotals.unknownReps ? ' (that session has unknown reps)' : ''}.</p>` : ''}
      ${planned ? `<p class="small" style="margin:.3em 0 0">Prescribed ${planned} working sets ${tag('target')} · completed ${t.sets} ${tag('actual')}</p>` : ''}</div>`;
    if (c.prs.length) h += `<div class="card"><h2>🏅 New records</h2><ul class="clean">${c.prs.map((p) => `<li><b>${esc(p.kind)}:</b> ${esc(p.text)}</li>`).join('')}</ul></div>`;
    if (c.avg4) h += `<div class="card tight small">Average of your last ${Math.min(4, state.sessions.filter((x) => x.type === 'strength' && x.id !== s.id).length)} sessions: ${fmtNum(c.avg4.sets, 1)} sets · ${fmtNum(c.avg4.reps)} reps · ${fmtNum(c.avg4.volume)} kg. This session: ${dlt(t.volume - c.avg4.volume, ' kg')} volume vs average.</div>`;
    h += `<div class="section-title"><h2>Exercise by exercise</h2></div><div class="list">`;
    for (const p of c.perExercise) {
      const ex = getEx(state, p.exerciseId);
      const w = workingSets(p.entry);
      const v = p.cmp?.verdict;
      const vt = !p.cmp ? '<span class="tag tag-unknown">first record — baseline</span>' : v === 'progress' ? '<span class="tag tag-good">progress</span>' : v === 'regress' ? '<span class="tag tag-bad">below last time</span>' : v === 'unknown' ? '<span class="tag tag-unknown">not comparable (unknown reps)</span>' : `<span class="tag tag-unknown">${v === 'fewer-sets' ? 'fewer sets' : v === 'same' ? 'same as last time' : esc(v)}</span>`;
      h += `<div class="card tight"><div class="row between"><b>${esc(exName(ex, state.settings))}</b>${vt}</div>
        <div class="small">${setsText(w)} · ${fmtKg(setsTotals(p.entry.sets).volume)}</div>
        ${p.prev ? `<div class="small muted">Last (${fmtShort(p.prev.date)}): ${setsText(p.prev.sets)} · reps ${dlt(p.cmp.repsDelta)} · volume ${dlt(p.cmp.volumeDelta, ' kg')}</div>` : ''}
        ${p.cmp?.details.length ? `<ul class="clean small">${p.cmp.details.map((d) => `<li>${esc(d)}</li>`).join('')}</ul>` : ''}</div>`;
    }
    h += `</div>`;
    const notDone = s.entries.filter((e) => e.status !== 'done');
    if (notDone.length) h += `<div class="card tight small"><b>Not done:</b> ${notDone.map((e) => `${esc(getEx(state, e.exerciseId)?.en)} (${STATUS_LABEL[e.status]})`).join(', ')}. That's fine — machine availability and recovery vary.</div>`;
    h += `<p class="tiny muted">More volume is not a guarantee of more muscle growth; recovery and consistency matter as much.</p>`;
    if (!hasAfter) {
      h += `<form class="card" data-form="after"><h2>How do you feel? <span class="muted small">(optional)</span></h2>
        <label>Effort of the session (1–10)</label>${scale('effort', null, { from: 1, cls: 'effort' })}
        <label>Fatigue (1–10)</label>${scale('fatigue', null, { from: 1, cls: 'effort' })}
        <label>Right knee pain (0–10)</label>${scale('knee', null)}
        <label>Left upper-arm pain (0–10)</label>${scale('arm', null)}
        <label>Where / what did you notice?</label><input name="notes" placeholder="e.g. pulling near left armpit after chest crossover">
        <button class="btn-primary btn-block" style="margin-top:12px">Save check-in</button></form>`;
    } else h += `<div class="card tight small">✓ Post-workout check-in saved. <a href="#/recovery">Recovery</a></div>`;
    h += `<div class="grid2" style="margin-top:12px"><a class="btn" href="#/session/${s.id}">Edit session</a><a class="btn btn-primary" href="#/">Home</a></div>`;
    return h;
  },
  forms: {
    after(form, { params }) {
      const s = state.sessions.find((x) => x.id === params[0]);
      const fd = new FormData(form);
      const ci = { id: uid('ci'), date: s.date, timing: 'after', context: 'strength', sessionId: s.id, effort: numOrNull(fd.get('effort')), fatigue: numOrNull(fd.get('fatigue')), knee: numOrNull(fd.get('knee')), arm: numOrNull(fd.get('arm')), kneeLocation: '', armLocation: '', soreness: '', sleepH: null, unusual: '', notes: fd.get('notes') || '', source: 'logged' };
      state.checkins.push(ci);
      if ((ci.arm ?? 0) > 0) state.symptoms.push({ id: uid('sym'), date: s.date, side: 'left', area: 'upper_arm', location: ci.notes || 'Left upper arm', severity: ci.arm, timing: 'after', trigger: `After ${s.title}`, context: '', afterNote: '', recovery: '', weakness: null, bruising: null, swelling: null, lossOfMotion: null, recurrence: '', status: 'ongoing', source: 'logged' });
      if ((ci.knee ?? 0) > 0) state.symptoms.push({ id: uid('sym'), date: s.date, side: 'right', area: 'knee', location: ci.notes || 'Right knee', severity: ci.knee, timing: 'after', trigger: `After ${s.title}`, context: '', afterNote: '', recovery: '', weakness: null, bruising: null, swelling: null, lossOfMotion: null, recurrence: '', status: 'ongoing', source: 'logged' });
      save(); toast('Check-in saved'); go(location.hash);
    },
  },
};

export { setsText, presc, suggestionHTML, statusTag, STATUS_LABEL, fmtDur };
