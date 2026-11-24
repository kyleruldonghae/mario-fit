// Recovery & symptoms: check-ins, symptom episodes, pattern alerts (never a diagnosis)
import { state, save } from '../store.js';
import { esc, tag, fmtDate, fmtShort, isoDate, numOrNull, uid } from '../util.js';
import { EXERCISES } from '../data/exercises.js';
import { painStatus, patternAlerts, SEEK_HELP } from '../logic.js';
import { lineChart } from '../charts.js';
import { scale, go, toast, confirmBox } from '../ui.js';

const TIMING = { before: 'Before training', after: 'After training', 'next-day': 'Next day', general: 'General / rest day', during: 'During training' };
const yn3 = (name, v) => `<select name="${name}"><option value="" ${v == null ? 'selected' : ''}>Unknown</option><option value="no" ${v === false ? 'selected' : ''}>No</option><option value="yes" ${v === true ? 'selected' : ''}>Yes</option></select>`;
const ynVal = (s) => (s === 'yes' ? true : s === 'no' ? false : null);
const score = (v, desc) => (v == null ? `<span class="tag tag-unknown">${desc ? 'not scored' : '—'}</span>` : `<span class="score ${v >= 5 ? 'bad' : v > 0 ? 'warnc' : 'ok'}">${v}/10</span>`);

export const recovery = {
  title: 'Recovery & symptoms',
  render() {
    const p = painStatus(state);
    const alerts = patternAlerts(state);
    const cis = [...state.checkins].sort((a, b) => (a.date < b.date ? -1 : 1));
    let h = `<div class="grid2"><div class="card tight ${p.knee.active ? 'warn' : ''}"><b>Right knee</b><div class="small">${p.knee.active ? esc(p.knee.reason) : 'No active symptom recorded'}</div><div class="tiny muted">Last score: ${p.knee.lastDate ? fmtShort(p.knee.lastDate) : '—'}</div></div>
      <div class="card tight ${p.arm.active ? 'warn' : ''}"><b>Left upper arm</b><div class="small">${p.arm.active ? esc(p.arm.reason) : 'No active symptom recorded'}</div><div class="tiny muted">Last score: ${p.arm.lastDate ? fmtShort(p.arm.lastDate) : '—'}</div></div></div>
      <div class="grid2" style="margin-top:10px"><a class="btn btn-primary" href="#/recovery/new">+ Check-in</a><a class="btn" href="#/symptom/new">+ Symptom episode</a></div>`;
    for (const a of alerts) h += `<div class="card ${a.level === 'warn' ? 'warn' : 'info'}"><b>${esc(a.title)}</b><p class="small" style="margin:.3em 0 0">${esc(a.text)}</p>${a.action ? `<a class="btn btn-sm" style="margin-top:6px" href="${a.action}">Add check-in</a>` : ''}</div>`;
    h += `<p class="tiny muted">Patterns are highlighted from your own records only. ${SEEK_HELP}</p>`;
    const kp = cis.filter((c) => c.knee != null), ap = cis.filter((c) => c.arm != null);
    if (kp.length || ap.length) {
      h += `<div class="card"><b>Pain scores over time</b> ${tag('actual')}${kp.length ? `<div class="small muted">Right knee</div>${lineChart([{ name: 'Knee', color: '#ffb547', points: kp.map((c) => ({ x: fmtShort(c.date), y: c.knee })) }], { height: 120, yMin: 0, yMax: 10 })}` : ''}
        ${ap.length ? `<div class="small muted">Left upper arm</div>${lineChart([{ name: 'Arm', color: '#ff5d5d', points: ap.map((c) => ({ x: fmtShort(c.date), y: c.arm })) }], { height: 120, yMin: 0, yMax: 10 })}` : ''}
        <p class="tiny muted">Check-ins described only in words (e.g. "slight discomfort") have no score and are not plotted.</p></div>`;
    }
    h += `<div class="section-title"><h2>Symptom episodes</h2></div><div class="list">`;
    for (const s of [...state.symptoms].sort((a, b) => ((a.date || '') < (b.date || '') ? 1 : -1))) {
      h += `<a class="item" href="#/symptom/${s.id}"><div class="meta"><div class="row between"><b>${s.side === 'left' ? 'Left' : s.side === 'right' ? 'Right' : ''} ${s.area === 'knee' ? 'knee' : s.area === 'upper_arm' ? 'upper arm' : esc(s.area)}</b><span class="tag ${s.status === 'resolved' ? 'tag-good' : s.status === 'ongoing' ? 'tag-bad' : 'tag-unknown'}">${s.status === 'unknown' ? 'status unknown' : s.status}</span></div>
        <div class="small muted">${fmtDate(s.date, true)} · ${esc(TIMING[s.timing] || s.timing || '')}</div><div class="small">${esc(s.location)}</div><div class="small">Severity: ${score(s.severity, s.severityNote)} ${s.severityNote ? `<span class="tiny muted">${esc(s.severityNote)}</span>` : ''}</div>
        ${s.recurrence ? `<div class="tiny muted">Recurrence: ${esc(s.recurrence)}</div>` : ''}</div><span class="chev">›</span></a>`;
    }
    h += `</div><div class="section-title"><h2>Check-ins</h2></div><div class="list">`;
    for (const c of [...cis].reverse()) {
      h += `<a class="item" href="#/recovery/checkin/${c.id}"><div class="meta"><div class="row between"><b>${fmtDate(c.date)}</b><span class="tiny muted">${esc(TIMING[c.timing] || c.timing)}${c.context ? ' · ' + esc(c.context) : ''}</span></div>
        <div class="small">Knee ${score(c.knee)} · Arm ${score(c.arm)}${c.effort ? ` · Effort ${c.effort}` : ''}${c.fatigue ? ` · Fatigue ${c.fatigue}` : ''}</div>${c.notes ? `<div class="tiny muted">${esc(c.notes)}</div>` : ''}</div><span class="chev">›</span></a>`;
    }
    return h + '</div>';
  },
};

export const checkinForm = {
  title: 'Check-in',
  render({ params, query }) {
    const c = params[0] ? state.checkins.find((x) => x.id === params[0]) : { date: isoDate(), timing: query.timing || 'general', context: query.context || '', effort: null, fatigue: null, soreness: '', sleepH: null, knee: null, kneeLocation: '', arm: null, armLocation: '', unusual: '', notes: '' };
    if (!c) return `<div class="empty">Not found. <a href="#/recovery">Recovery</a></div>`;
    return `<a href="#/recovery" class="btn btn-sm btn-ghost">‹ Recovery</a><form class="card" data-form="save" style="margin-top:8px"><h2>${params[0] ? 'Edit check-in' : 'Recovery check-in'}</h2>
      <div class="grid2"><div><label>Date</label><input type="date" name="date" value="${c.date}"></div><div><label>When</label><select name="timing">${Object.entries(TIMING).map(([k, l]) => `<option value="${k}" ${c.timing === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div></div>
      <label>Context</label><select name="context">${['', 'strength', 'treadmill', 'rest', 'other'].map((k) => `<option value="${k}" ${c.context === k ? 'selected' : ''}>${k || '—'}</option>`).join('')}</select>
      <label>${query.focus === 'arm' ? '<b>Left upper arm / armpit pain (0–10)</b>' : 'Left upper arm / armpit pain (0–10)'}</label>${scale('arm', c.arm)}
      <input name="armLocation" placeholder="Where exactly? e.g. back of arm near armpit" value="${esc(c.armLocation || '')}" style="margin-top:6px">
      <label>Right knee pain (0–10)</label>${scale('knee', c.knee)}
      <input name="kneeLocation" placeholder="Where? e.g. front / inside / behind the knee" value="${esc(c.kneeLocation || '')}" style="margin-top:6px">
      <label>Effort (1–10)</label>${scale('effort', c.effort, { from: 1, cls: 'effort' })}
      <label>Fatigue (1–10)</label>${scale('fatigue', c.fatigue, { from: 1, cls: 'effort' })}
      <div class="grid2"><div><label>Muscle soreness</label><input name="soreness" value="${esc(c.soreness || '')}" placeholder="e.g. chest, mild"></div><div><label>Sleep last night (h)</label><input name="sleepH" inputmode="decimal" value="${c.sleepH ?? ''}"></div></div>
      <label>Unusual symptoms (weakness, swelling, bruising, loss of movement…)</label><input name="unusual" value="${esc(c.unusual || '')}">
      <label>Notes</label><textarea name="notes">${esc(c.notes || '')}</textarea>
      <button class="btn-big btn-primary" style="margin-top:12px">Save check-in</button>
      <p class="tiny muted">${SEEK_HELP}</p></form>
      ${params[0] ? `<details class="card"><summary>Delete check-in</summary><button class="btn-danger" data-act="del">Delete</button></details>` : ''}`;
  },
  forms: {
    save(form, { params }) {
      const fd = new FormData(form);
      const c = params[0] ? state.checkins.find((x) => x.id === params[0]) : { id: uid('ci'), source: 'logged' };
      Object.assign(c, {
        date: fd.get('date') || isoDate(), timing: fd.get('timing'), context: fd.get('context'), arm: numOrNull(fd.get('arm')), armLocation: fd.get('armLocation'), knee: numOrNull(fd.get('knee')), kneeLocation: fd.get('kneeLocation'),
        effort: numOrNull(fd.get('effort')), fatigue: numOrNull(fd.get('fatigue')), soreness: fd.get('soreness'), sleepH: numOrNull(fd.get('sleepH')), unusual: fd.get('unusual'), notes: fd.get('notes'),
      });
      if (!params[0]) state.checkins.push(c);
      // A 0 score after an open episode: offer to close it
      let msg = 'Check-in saved';
      const openArm = state.symptoms.find((s) => s.area !== 'knee' && s.status !== 'resolved');
      if (c.arm === 0 && openArm && !params[0]) { openArm.status = 'resolved'; openArm.recovery = (openArm.recovery ? openArm.recovery + ' · ' : '') + `Pain-free check-in on ${c.date}`; msg = 'Saved — arm episode marked resolved (you can change it)'; }
      const openKnee = state.symptoms.find((s) => s.area === 'knee' && s.status === 'ongoing');
      if (c.knee === 0 && openKnee && !params[0]) { openKnee.status = 'resolved'; openKnee.recovery = (openKnee.recovery ? openKnee.recovery + ' · ' : '') + `Pain-free check-in on ${c.date}`; }
      if ((c.arm ?? 0) >= 1 && !openArm && !params[0]) state.symptoms.push({ id: uid('sym'), date: c.date, side: 'left', area: 'upper_arm', location: c.armLocation || 'Left upper arm', severity: c.arm, timing: c.timing, trigger: '', context: c.context, afterNote: '', recovery: '', weakness: null, bruising: null, swelling: null, lossOfMotion: null, recurrence: '', status: 'ongoing', source: 'logged' });
      if ((c.knee ?? 0) >= 1 && !openKnee && !params[0]) state.symptoms.push({ id: uid('sym'), date: c.date, side: 'right', area: 'knee', location: c.kneeLocation || 'Right knee', severity: c.knee, timing: c.timing, trigger: '', context: c.context, afterNote: '', recovery: '', weakness: null, bruising: null, swelling: null, lossOfMotion: null, recurrence: '', status: 'ongoing', source: 'logged' });
      save(); toast(msg, 3000); go('#/recovery');
    },
  },
  actions: {
    async del(el, ev, root, { params }) {
      if (!(await confirmBox('Delete this check-in?', 'Delete', true))) return;
      state.checkins = state.checkins.filter((x) => x.id !== params[0]); save(); go('#/recovery');
    },
  },
};

export const symptomForm = {
  title: 'Symptom episode',
  render({ params }) {
    const isNew = params[0] === 'new';
    const s = isNew ? { date: isoDate(), side: 'left', area: 'upper_arm', location: '', severity: null, timing: 'after', trigger: '', context: '', afterNote: '', recovery: '', weakness: null, bruising: null, swelling: null, lossOfMotion: null, recurrence: '', status: 'ongoing', notes: '' } : state.symptoms.find((x) => x.id === params[0]);
    if (!s) return `<div class="empty">Not found. <a href="#/recovery">Recovery</a></div>`;
    return `<a href="#/recovery" class="btn btn-sm btn-ghost">‹ Recovery</a>${s.source === 'imported' ? `<p class="tiny muted">Imported from your notes. ${esc(s.interpretation || '')}</p>` : ''}
      <form class="card" data-form="save" style="margin-top:8px"><h2>${isNew ? 'New symptom episode' : 'Symptom episode'}</h2>
      <div class="grid2"><div><label>Date</label><input type="date" name="date" value="${s.date || ''}"></div><div><label>Status</label><select name="status">${['ongoing', 'resolved', 'unknown'].map((k) => `<option ${s.status === k ? 'selected' : ''}>${k}</option>`).join('')}</select></div>
      <div><label>Side</label><select name="side">${['left', 'right', 'both', 'n/a'].map((k) => `<option ${s.side === k ? 'selected' : ''}>${k}</option>`).join('')}</select></div>
      <div><label>Area</label><select name="area">${[['upper_arm', 'Upper arm / armpit'], ['knee', 'Knee'], ['shoulder', 'Shoulder'], ['back', 'Back'], ['other', 'Other']].map(([k, l]) => `<option value="${k}" ${s.area === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div></div>
      <label>Location / description</label><input name="location" value="${esc(s.location)}" placeholder="e.g. near the armpit, back of the upper arm">
      <label>Severity (0–10) ${s.severityNote ? `<span class="tiny muted">— ${esc(s.severityNote)}</span>` : ''}</label>${scale('severity', s.severity)}
      <div class="grid2"><div><label>When noticed</label><select name="timing">${Object.entries(TIMING).map(([k, l]) => `<option value="${k}" ${s.timing === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
      <div><label>Triggering exercise</label><select name="triggerEx"><option value="">Not identified</option>${EXERCISES.map((e) => `<option value="${e.id}" ${s.triggerEx === e.id ? 'selected' : ''}>${esc(e.en)}</option>`).join('')}</select></div></div>
      <label>Trigger / context</label><input name="trigger" value="${esc(s.trigger || '')}">
      <label>Recovery time / how it developed</label><input name="recovery" value="${esc(s.recovery || '')}" placeholder="e.g. gone after 2 days">
      <div class="grid2"><div><label>Weakness</label>${yn3('weakness', s.weakness)}</div><div><label>Bruising</label>${yn3('bruising', s.bruising)}</div><div><label>Swelling</label>${yn3('swelling', s.swelling)}</div><div><label>Loss of motion</label>${yn3('lossOfMotion', s.lossOfMotion)}</div></div>
      <label>Recurrence</label><input name="recurrence" value="${esc(s.recurrence || '')}">
      <label class="check"><input type="checkbox" name="recurrent" ${s.recurrent ? 'checked' : ''}> This has happened before</label>
      <label>Notes</label><textarea name="notes">${esc(s.notes || s.context || '')}</textarea>
      <button class="btn-big btn-primary" style="margin-top:12px">Save</button>
      <p class="tiny muted">The app never diagnoses. Do not assume an exercise is safe because you completed it before. ${SEEK_HELP}</p></form>
      ${!isNew ? `<details class="card"><summary>Delete episode</summary><button class="btn-danger" data-act="del">Delete</button></details>` : ''}`;
  },
  forms: {
    save(form, { params }) {
      const fd = new FormData(form);
      const isNew = params[0] === 'new';
      const s = isNew ? { id: uid('sym'), source: 'logged' } : state.symptoms.find((x) => x.id === params[0]);
      Object.assign(s, {
        date: fd.get('date'), status: fd.get('status'), side: fd.get('side'), area: fd.get('area'), location: fd.get('location'), severity: numOrNull(fd.get('severity')), timing: fd.get('timing'),
        triggerEx: fd.get('triggerEx') || null, trigger: fd.get('trigger'), recovery: fd.get('recovery'), weakness: ynVal(fd.get('weakness')), bruising: ynVal(fd.get('bruising')), swelling: ynVal(fd.get('swelling')), lossOfMotion: ynVal(fd.get('lossOfMotion')),
        recurrence: fd.get('recurrence'), recurrent: !!fd.get('recurrent'), notes: fd.get('notes'),
      });
      if (isNew) state.symptoms.push(s);
      if (s.weakness || s.swelling || s.bruising || s.lossOfMotion) toast('Weakness, swelling, bruising or loss of motion: consider a professional assessment.', 4500); else toast('Saved');
      save(); go('#/recovery');
    },
  },
  actions: {
    async del(el, ev, root, { params }) {
      if (!(await confirmBox('Delete this symptom episode?', 'Delete', true))) return;
      state.symptoms = state.symptoms.filter((x) => x.id !== params[0]); save(); go('#/recovery');
    },
  },
};
