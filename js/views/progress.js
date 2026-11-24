// Progress: per-exercise charts, body measurements, weekly volume/frequency, sets per muscle group, bests.
import { state, save } from '../store.js';
import { esc, tag, fmtShort, fmtDate, fmtNum, isoDate, addDays, numOrNull, uid } from '../util.js';
import { EXERCISES, exName } from '../data/exercises.js';
import { getEx, exerciseHistory, recordsFrom, compareSets, e1rm, filterRange, weeklySeries, setsPerMuscleGroup } from '../logic.js';
import { lineChart, barChart, hBars } from '../charts.js';
import { go, confirmBox, toast } from '../ui.js';
import { setsText } from './workout.js';

const RANGES = [['prev', 'Previous'], ['last4', 'Last 4'], ['month', 'Month'], ['3months', '3 months'], ['all', 'All']];
const TABS = [['ex', 'Exercises'], ['body', 'Body'], ['volume', 'Volume & frequency'], ['bests', 'Bests']];

export default {
  title: 'Progress',
  render({ query }) {
    const tab = query.tab || 'ex';
    let h = `<div class="tabs">${TABS.map(([k, l]) => `<a href="#/progress?tab=${k}" class="${k === tab ? 'on' : ''}">${l}</a>`).join('')}</div><div style="margin-top:12px">`;
    if (tab === 'ex') h += exTab(query);
    else if (tab === 'body') h += bodyTab(query);
    else if (tab === 'volume') h += volumeTab(query);
    else h += bestsTab();
    return h + '</div>';
  },
  changes: {
    ex(el) { const q = new URLSearchParams(location.hash.split('?')[1]); q.set('id', el.value); location.hash = '#/progress?' + q; },
  },
  forms: {
    meas(form) {
      const fd = new FormData(form);
      const w = numOrNull(fd.get('weight')), wa = numOrNull(fd.get('waist')), bf = numOrNull(fd.get('bf'));
      if (w == null && wa == null && bf == null) return toast('Enter at least one value');
      state.measurements.push({ id: uid('m'), date: fd.get('date') || isoDate(), weightKg: w, waistCm: wa, bodyFatPct: bf, status: 'actual', note: fd.get('note') || '', source: 'logged' });
      if (w != null) state.profile.unknowns.currentWeight = w;
      if (wa != null) state.profile.unknowns.waistCm = wa;
      save(); toast('Measurement saved'); go('#/progress?tab=body');
    },
  },
  actions: {
    async delm(el) {
      if (!(await confirmBox('Delete this measurement?', 'Delete', true))) return;
      state.measurements = state.measurements.filter((m) => m.id !== el.dataset.id); save(); go(location.hash);
    },
  },
};

function exTab(query) {
  const withHist = EXERCISES.filter((e) => e.type === 'strength' || e.type === 'hold').concat(state.customExercises).filter((e) => exerciseHistory(state, e.id).length);
  const id = query.id || withHist[0]?.id || 'chest_press';
  const range = query.range || 'all';
  const ex = getEx(state, id);
  const all = exerciseHistory(state, id);
  const rows = filterRange(all, range);
  let h = `<label>Exercise</label><select data-change="ex">${withHist.map((e) => `<option value="${e.id}" ${e.id === id ? 'selected' : ''}>${esc(exName(e, state.settings))}</option>`).join('')}</select>
    <div class="tabs" style="margin-top:10px">${RANGES.map(([k, l]) => `<a href="#/progress?tab=ex&id=${id}&range=${k}" class="${k === range ? 'on' : ''}">${l}</a>`).join('')}</div>`;
  if (!rows.length) return h + `<div class="empty">No logged sets for ${esc(ex?.en || id)} in this range.</div>`;
  const pts = rows.map((r) => ({ x: fmtShort(r.date), y: Math.max(...r.sets.map((s) => s.weight ?? 0)) }));
  const est = rows.map((r) => { const b = Math.max(0, ...r.sets.filter((s) => s.reps != null).map((s) => e1rm(s.weight, s.reps))); return { x: fmtShort(r.date), y: b ? Math.round(b) : null, est: true }; });
  h += `<div class="card"><div class="row between"><b>Top working weight</b>${tag('actual')}</div>${lineChart([{ name: 'Top weight (kg)', color: '#3ddc97', points: pts }, { name: 'Est. 1-rep max (estimate)', color: '#ffb547', points: est }], { unit: 'kg' })}</div>`;
  const vol = rows.map((r) => ({ x: fmtShort(r.date), y: r.totals.unknownReps ? null : r.totals.volume }));
  const reps = rows.map((r) => ({ x: fmtShort(r.date), y: r.totals.unknownReps ? null : r.totals.reps }));
  h += `<div class="card"><div class="row between"><b>Working volume &amp; reps</b>${tag('actual')}</div>${lineChart([{ name: 'Volume (kg)', color: '#6cb4ff', points: vol }], { unit: 'kg' })}${lineChart([{ name: 'Total reps', color: '#c6a8ff', points: reps }], { height: 130 })}
    ${rows.some((r) => r.totals.unknownReps) ? '<p class="tiny muted">Sessions with unknown reps are left out of volume/reps (gaps).</p>' : ''}</div>`;
  h += `<div class="card"><b>Session by session</b><table class="simple">${[...rows].reverse().map((r, i, arr) => {
    const prev = arr[i + 1];
    const c = prev ? compareSets(prev.sets, r.sets) : null;
    const v = c?.verdict;
    return `<tr><td class="nowrap">${fmtShort(r.date)}</td><td>${setsText(r.sets)}${c?.details.length ? `<div class="tiny ok">${c.details.map(esc).join(' · ')}</div>` : ''}</td><td>${v === 'progress' ? '<span class="tag tag-good">progress</span>' : v === 'regress' ? '<span class="tag tag-bad">lower</span>' : v === 'unknown' ? '<span class="tag tag-unknown">n/a</span>' : v ? `<span class="tag tag-unknown">${esc(v)}</span>` : ''}</td></tr>`;
  }).join('')}</table></div>`;
  return h;
}

function bodyTab(query) {
  const ms = [...state.measurements].sort((a, b) => (a.date < b.date ? -1 : 1));
  const w = ms.filter((m) => m.weightKg != null).map((m) => ({ x: fmtShort(m.date), y: m.weightKg, est: m.status === 'estimate' }));
  const wa = ms.filter((m) => m.waistCm != null).map((m) => ({ x: fmtShort(m.date), y: m.waistCm }));
  const bf = ms.filter((m) => m.bodyFatPct != null).map((m) => ({ x: fmtShort(m.date), y: m.bodyFatPct }));
  let h = `<form class="card" data-form="meas"><details ${query.add ? 'open' : ''}><summary style="font-weight:700;min-height:40px;display:flex;align-items:center">+ Log weight / waist</summary>
    <div class="grid2"><div><label>Date</label><input type="date" name="date" value="${isoDate()}" max="${isoDate()}"></div><div><label>Weight (kg)</label><input name="weight" inputmode="decimal" ${query.add ? 'autofocus' : ''}></div>
    <div><label>Waist (cm)</label><input name="waist" inputmode="decimal"></div><div><label>Body fat % (optional)</label><input name="bf" inputmode="decimal"></div></div>
    <label>Note</label><input name="note" placeholder="e.g. morning, after toilet, before breakfast"><button class="btn-primary btn-block" style="margin-top:10px">Save measurement</button></details></form>`;
  h += `<div class="card"><div class="row between"><b>Body weight</b><span class="tiny muted">hollow dot = estimate</span></div>${lineChart([{ name: 'Weight', color: '#3ddc97', points: w }], { unit: 'kg' })}
    <p class="tiny muted">Planning guidance: ~0.25–0.5 kg per week ${tag('target')}. Faster is not assumed better.</p></div>`;
  h += `<div class="card"><b>Waist</b>${wa.length ? lineChart([{ name: 'Waist', color: '#ffb547', points: wa }], { unit: 'cm', height: 140 }) : '<p class="small muted">Waist not documented yet ' + tag('unknown') + '</p>'}</div>`;
  if (bf.length) h += `<div class="card"><b>Body fat %</b>${lineChart([{ name: 'Body fat', color: '#c6a8ff', points: bf }], { unit: '%', height: 140 })}</div>`;
  h += `<div class="card"><b>All measurements</b><table class="simple">${[...ms].reverse().map((m) => `<tr><td class="nowrap">${fmtDate(m.date)}${m.dateNote ? `<div class="tiny muted">${esc(m.dateNote)}</div>` : ''}</td><td>${m.weightKg != null ? m.weightKg + ' kg' : ''}${m.waistCm != null ? ` · ${m.waistCm} cm waist` : ''}${m.bodyFatPct != null ? ` · ${m.bodyFatPct} %` : ''} ${tag(m.status === 'estimate' ? 'estimate' : 'actual')}${m.note ? `<div class="tiny muted">${esc(m.note)}</div>` : ''}</td><td class="act"><button class="btn-sm" data-act="delm" data-id="${m.id}">✕</button></td></tr>`).join('')}</table></div>`;
  return h;
}

function volumeTab(query) {
  const weeks = weeklySeries(state, 8);
  const per = query.per || '28';
  const to = isoDate(), from = per === 'all' ? '0000-01-01' : addDays(to, -Number(per) + 1);
  const groups = setsPerMuscleGroup(state, from, to);
  let h = `<div class="card"><b>Weekly working volume (kg)</b>${barChart(weeks.map((w) => ({ x: fmtShort(w.weekStart), y: w.volume })), { unit: 'kg' })}</div>
    <div class="card"><b>Weekly gym visits</b> <span class="tiny muted">(dashed = target 5)</span>${barChart(weeks.map((w) => ({ x: fmtShort(w.weekStart), y: w.strengthDays + w.cardioDays })), { target: 5 })}
    <p class="tiny muted">Strength + cardio days per week (week starting Monday).</p></div>
    <div class="card"><div class="row between"><b>Working sets per muscle group</b></div><div class="tabs" style="margin:8px 0">${[['7', '7 days'], ['28', '28 days'], ['all', 'All']].map(([k, l]) => `<a href="#/progress?tab=volume&per=${k}" class="${k === per ? 'on' : ''}">${l}</a>`).join('')}</div>
    ${hBars(Object.entries(groups).sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value })))}
    <p class="tiny muted">Primary muscles count 1 per set, secondary 0.5 ${tag('estimate')}. Higher volume is not a guarantee of more growth.</p></div>`;
  return h;
}

function bestsTab() {
  let h = `<div class="card"><b>Best documented per exercise</b> ${tag('actual')}<table class="simple"><tr><th>Exercise</th><th>Heaviest</th><th>Best session</th></tr>`;
  for (const e of [...EXERCISES, ...state.customExercises]) {
    const hist = exerciseHistory(state, e.id);
    if (!hist.length) continue;
    const r = recordsFrom(hist);
    h += `<tr><td><a href="#/exercise/${e.id}">${esc(exName(e, state.settings))}</a></td><td class="nowrap">${r.heaviest.weight} kg × ${r.heaviest.reps ?? '?'}<div class="tiny muted">${fmtShort(r.heaviest.date)}</div></td>
      <td>${r.bestSessionVolume ? `${fmtNum(r.bestSessionVolume.value)} kg<div class="tiny muted">${r.bestSessionVolume.sets} sets · ${fmtShort(r.bestSessionVolume.date)}</div>` : '<span class="tag tag-unknown">unknown</span>'}</td></tr>`;
  }
  return h + `</table><p class="tiny muted">Historical bests are not necessarily appropriate next loads. Weights are only comparable on the same machine.</p></div>`;
}
