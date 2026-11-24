// Treadmill tracker
import { state, save } from '../store.js';
import { esc, tag, fmtDate, fmtShort, fmtDur, parseDur, numOrNull, uid, isoDate, weekStart, addDays } from '../util.js';
import { painStatus } from '../logic.js';
import { lineChart, barChart } from '../charts.js';
import { scale, go, toast, confirmBox } from '../ui.js';

const sorted = () => [...state.cardio].sort((a, b) => (a.date < b.date ? -1 : 1));

export const cardio = {
  title: 'Cardio',
  render() {
    const list = sorted();
    const knee = painStatus(state).knee;
    let h = `<div class="card ${knee.active ? 'warn' : 'info'}"><b>Sunday treadmill guidance</b> ${tag('target')}<p class="small" style="margin:.3em 0 0">${esc(state.plan.sun.note)}</p>
      ${knee.active ? `<p class="small"><b>Knee:</b> ${esc(knee.reason)} → start 0–3 % incline.</p>` : ''}</div>
      <a class="btn btn-big btn-primary" style="margin-top:12px" href="#/cardio/new">+ Log treadmill session</a>`;
    // weekly totals (last 8 weeks)
    const weeks = [];
    let ws = weekStart(isoDate());
    for (let i = 0; i < 8; i++) { weeks.unshift(ws); ws = addDays(ws, -7); }
    const wmin = weeks.map((w) => ({ x: fmtShort(w), y: Math.round(list.filter((c) => c.date >= w && c.date <= addDays(w, 6)).reduce((a, c) => a + (c.durationSec || 0), 0) / 60) }));
    h += `<div class="card"><b>Minutes per week</b>${barChart(wmin, { unit: 'min' })}</div>`;
    // monthly
    const months = {};
    for (const c of list) { const m = c.date.slice(0, 7); months[m] = months[m] || { min: 0, km: 0, n: 0 }; months[m].min += (c.durationSec || 0) / 60; months[m].km += c.distanceKm || 0; months[m].n++; }
    h += `<div class="card"><b>Monthly totals</b><table class="simple"><tr><th>Month</th><th>Sessions</th><th>Time</th><th>Distance</th></tr>${Object.entries(months).reverse().map(([m, v]) => `<tr><td>${m}</td><td>${v.n}</td><td>${Math.round(v.min)} min</td><td>${v.km.toFixed(2)} km</td></tr>`).join('')}</table></div>`;
    if (list.length > 1) {
      h += `<div class="card"><b>Distance &amp; incline per session</b>${lineChart([{ name: 'Distance (km)', color: '#3ddc97', points: list.map((c) => ({ x: fmtShort(c.date), y: c.distanceKm, est: c.approx?.distanceKm })) }])}
        <div class="small muted">Incline (%)</div>${lineChart([{ name: 'Incline (%)', color: '#ffb547', points: list.map((c) => ({ x: fmtShort(c.date), y: c.incline })) }], { height: 130 })}
        <div class="small muted">Average heart rate (bpm)</div>
        ${lineChart([{ name: 'Avg heart rate (bpm)', color: '#ff5d5d', points: list.map((c) => ({ x: fmtShort(c.date), y: c.avgHr, est: c.approx?.avgHr })) }], { height: 130 })}
        <p class="tiny muted">Gaps = not documented. Device calories are always estimates.</p></div>`;
    }
    h += `<div class="section-title"><h2>Sessions</h2></div><div class="list">${[...list].reverse().map((c) => `<a class="item" href="#/cardio/${c.id}"><div class="meta"><div class="row between"><b>${fmtDate(c.date, true)}</b>${c.source === 'imported' ? tag('imported') : tag('actual')}</div>
      <div class="small">${fmtDur(c.durationSec)} · ${c.distanceKm ?? '?'} km${c.approx?.distanceKm ? ' (approx.)' : ''} · ${c.displayedSpeed ?? c.avgSpeed ?? '?'} km/h${c.incline != null ? ` · ${c.incline} %` : ' · incline <span class="tag tag-unknown">unknown</span>'}</div>
      <div class="small muted">${c.avgHr ? `HR ${c.avgHr}${c.approx?.avgHr ? ' (approx.)' : ''} · ` : ''}${c.kcal ? `${c.kcal} kcal <span class="tag tag-estimate">device est.</span> · ` : ''}knee after: ${c.kneeAfter ?? '—'}</div></div><span class="chev">›</span></a>`).join('')}</div>`;
    return h;
  },
};

export const cardioForm = {
  title: 'Treadmill session',
  render({ params }) {
    const isNew = params[0] === 'new';
    const c = isNew ? { date: isoDate(), durationSec: null, distanceKm: null, avgSpeed: null, displayedSpeed: 5, incline: null, avgHr: null, kcal: null, steps: null, kneeBefore: null, kneeAfter: null, effort: null, notes: '', approx: {} } : state.cardio.find((x) => x.id === params[0]);
    if (!c) return `<div class="empty">Not found. <a href="#/cardio">Cardio</a></div>`;
    const v = (x) => (x == null ? '' : x);
    return `<a href="#/cardio" class="btn btn-sm btn-ghost">‹ Cardio</a>
      ${c.source === 'imported' ? `<p class="tiny muted">Imported from your verified notes. ${esc(c.notes)}</p>` : ''}
      <form class="card" data-form="save" style="margin-top:8px"><h2>${isNew ? 'Log treadmill' : 'Edit treadmill session'}</h2>
      <div class="grid2"><div><label>Date</label><input type="date" name="date" value="${c.date}"></div><div><label>Duration (mm:ss or h:mm:ss)</label><input name="dur" value="${c.durationSec != null ? fmtDur(c.durationSec) : ''}" placeholder="45:00" required></div>
      <div><label>Distance (km)</label><input name="dist" inputmode="decimal" value="${v(c.distanceKm)}"></div><div><label>Incline (%)</label><input name="incline" inputmode="decimal" value="${v(c.incline)}"></div>
      <div><label>Displayed speed (km/h)</label><input name="dspeed" inputmode="decimal" value="${v(c.displayedSpeed)}"></div><div><label>Average speed if known</label><input name="aspeed" inputmode="decimal" value="${v(c.avgSpeed)}"></div>
      <div><label>Avg heart rate (bpm)</label><input name="hr" inputmode="numeric" value="${v(c.avgHr)}"></div><div><label>Device kcal <span class="tag tag-estimate">estimate</span></label><input name="kcal" inputmode="numeric" value="${v(c.kcal)}"></div>
      <div><label>Steps</label><input name="steps" inputmode="numeric" value="${v(c.steps)}"></div></div>
      <label>Knee before (0–10)</label>${scale('kneeBefore', c.kneeBefore)}
      <label>Knee after (0–10)</label>${scale('kneeAfter', c.kneeAfter)}
      <label>Perceived effort (1–10)</label>${scale('effort', c.effort, { from: 1, cls: 'effort' })}
      <label>Notes</label><textarea name="notes">${esc(c.notes || '')}</textarea>
      <button class="btn-big btn-primary" style="margin-top:12px">Save session</button></form>
      ${!isNew ? `<details class="card"><summary>Delete session</summary><button class="btn-danger" data-act="del">Delete</button></details>` : ''}`;
  },
  forms: {
    save(form, { params }) {
      const fd = new FormData(form);
      const dur = parseDur(fd.get('dur'));
      if (!dur) return toast('Enter a duration like 45:00');
      const isNew = params[0] === 'new';
      const c = isNew ? { id: uid('cardio'), source: 'logged', approx: {} } : state.cardio.find((x) => x.id === params[0]);
      Object.assign(c, {
        date: fd.get('date') || isoDate(), durationSec: dur, distanceKm: numOrNull(fd.get('dist')), incline: numOrNull(fd.get('incline')), displayedSpeed: numOrNull(fd.get('dspeed')), avgSpeed: numOrNull(fd.get('aspeed')),
        avgHr: numOrNull(fd.get('hr')), kcal: numOrNull(fd.get('kcal')), steps: numOrNull(fd.get('steps')), kneeBefore: numOrNull(fd.get('kneeBefore')), kneeAfter: numOrNull(fd.get('kneeAfter')), effort: numOrNull(fd.get('effort')), notes: fd.get('notes') || '',
      });
      if (isNew) {
        state.cardio.push(c);
        for (const [timing, k] of [['before', c.kneeBefore], ['after', c.kneeAfter]]) if (k != null) state.checkins.push({ id: uid('ci'), date: c.date, timing, context: 'treadmill', cardioId: c.id, knee: k, kneeLocation: 'Right knee', arm: null, armLocation: '', effort: timing === 'after' ? c.effort : null, fatigue: null, soreness: '', sleepH: null, unusual: '', notes: 'From treadmill log', source: 'logged' });
      }
      save(); toast('Treadmill session saved'); go('#/cardio');
    },
  },
  actions: {
    async del(el, ev, root, { params }) {
      if (!(await confirmBox('Delete this treadmill session?', 'Delete', true))) return;
      state.cardio = state.cardio.filter((x) => x.id !== params[0]); save(); go('#/cardio');
    },
  },
};
