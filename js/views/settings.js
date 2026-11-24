// Settings, profile/unknowns, export/import/backup, and the "More" menu.
import { state, save, saveNow, replaceState, resetAll, storageKind, allPhotos, setPhoto } from '../store.js';
import { esc, tag, download, toCSV, parseCSV, isoDate, numOrNull, uid } from '../util.js';
import { getEx } from '../logic.js';
import { go, toast, confirmBox } from '../ui.js';

export const more = {
  title: 'More',
  render() {
    const links = [
      ['#/workout', "Today's workout", 'Plan for today, start the gym session'],
      ['#/history', 'History', 'All strength and treadmill sessions'],
      ['#/cardio', 'Cardio', 'Treadmill tracker and trends'],
      ['#/recovery', 'Recovery & symptoms', 'Check-ins, knee & left-arm tracking'],
      ['#/nutrition', 'Nutrition', 'Calories, protein, Malaysian/Asian meal templates'],
      ['#/supplements', 'Supplements', 'Daily checklist and notes'],
      ['#/plan', 'Plan editor', 'Change days, exercises, sets and reps'],
      ['#/settings', 'Settings & export', 'Profile, backup, CSV / JSON'],
      ['gallery.html', 'Schematic gallery', 'All exercise illustrations side by side'],
    ];
    return `<div class="list">${links.map(([h, t, d]) => `<a class="item" href="${h}"><div class="meta"><b>${t}</b><div class="small muted">${d}</div></div><span class="chev">›</span></a>`).join('')}</div>`;
  },
};

const yn = (name, v) => `<select name="${name}"><option value="" ${v == null ? 'selected' : ''}>Unknown</option><option value="yes" ${v === 'yes' ? 'selected' : ''}>Yes</option><option value="no" ${v === 'no' ? 'selected' : ''}>No</option></select>`;
const UNK_LABELS = {
  kneeDiagnosis: 'Knee diagnosis (if any)', armDiagnosis: 'Arm diagnosis (if any)', maxStrength: 'Max strength notes', legMachineWeights: 'Leg machine weights', supplementAdherence: 'Supplement adherence', dietaryAdherence: 'Dietary adherence', machineModels: 'Exact machine models',
};

export const settings = {
  title: 'Settings & export',
  render() {
    const s = state.settings, p = state.profile, u = p.unknowns;
    return `<form class="card" data-form="prefs"><h2>Preferences</h2>
      <div class="grid2"><div><label>Exercise names first</label><select name="namesFirst"><option value="de" ${s.namesFirst === 'de' ? 'selected' : ''}>Deutsch</option><option value="en" ${s.namesFirst === 'en' ? 'selected' : ''}>English</option></select></div>
      <div><label>Theme</label><select name="theme"><option value="dark" ${s.theme === 'dark' ? 'selected' : ''}>Dark</option><option value="light" ${s.theme === 'light' ? 'selected' : ''}>Light</option></select></div>
      <div><label>Weight stepper step (kg)</label><select name="weightStep">${[1, 2.5, 5].map((v) => `<option ${s.weightStep === v ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
      <div><label>Default rest (s)</label><select name="defaultRest">${[60, 75, 90, 105, 120].map((v) => `<option ${s.defaultRest === v ? 'selected' : ''}>${v}</option>`).join('')}</select></div></div>
      <label class="check"><input type="checkbox" name="sound" ${s.sound ? 'checked' : ''}> Beep when rest is over</label>
      <label class="check"><input type="checkbox" name="vibrate" ${s.vibrate ? 'checked' : ''}> Vibrate when rest is over (Android)</label>
      <button class="btn-primary btn-block" style="margin-top:8px">Save preferences</button></form>

      <form class="card" data-form="profile"><h2>Profile</h2>
      <div class="grid2"><div><label>Name</label><input name="name" value="${esc(p.name)}"></div><div><label>Age</label><input name="age" inputmode="numeric" value="${p.age ?? ''}"></div>
      <div><label>Height (cm)</label><input name="heightCm" inputmode="numeric" value="${p.heightCm ?? ''}"></div><div><label>Country</label><input name="country" value="${esc(p.country)}"></div></div>
      <h3 style="margin-top:14px">Unknown / to update ${tag('unknown')}</h3><p class="tiny muted">Optional. Leave empty if unknown — the app never fills these in for you.</p>
      <div class="grid2"><div><label>Current weight (kg)</label><input name="currentWeight" inputmode="decimal" value="${u.currentWeight ?? ''}"></div><div><label>Waist (cm)</label><input name="waistCm" inputmode="decimal" value="${u.waistCm ?? ''}"></div>
      <div><label>Body fat %</label><input name="bodyFatPct" inputmode="decimal" value="${u.bodyFatPct ?? ''}"></div><div><label>Daily calories (typical)</label><input name="dailyKcal" inputmode="numeric" value="${u.dailyKcal ?? ''}"></div>
      <div><label>Sleep (h)</label><input name="sleepHours" inputmode="decimal" value="${u.sleepHours ?? ''}"></div><div><label>Resting HR</label><input name="restingHr" inputmode="numeric" value="${u.restingHr ?? ''}"></div></div>
      <label>Recorded upper-arm discomfort resolved?</label>${yn('armResolvedSince20Nov', u.armResolvedSince20Nov)}
      <label>Creatine daily?</label>${yn('creatineDaily', u.creatineDaily)}
      <label>Intermittent fasting followed?</label>${yn('intermittentFasting', u.intermittentFasting)}
      <label>Cardio after your last strength workout?</label>${yn('cardioAfter20Nov', u.cardioAfter20Nov)}
      ${Object.entries(UNK_LABELS).map(([k, l]) => `<label>${l}</label><input name="${k}" value="${esc(u[k] ?? '')}">`).join('')}
      <button class="btn-primary btn-block" style="margin-top:12px">Save profile</button></form>

      <div class="card"><h2>Backup &amp; export</h2><p class="small muted">All data lives only on this device (${storageKind()}). Make a backup regularly — e.g. weekly — and keep it in your files/iCloud.</p>
      <div class="grid2"><button class="btn-primary" data-act="backup">Full backup (JSON)</button><label class="btn" style="margin:0;color:var(--text)">Restore backup<input type="file" accept=".json,application/json" data-change="restore" class="hidden"></label></div>
      <div class="grid2" style="margin-top:8px"><button data-act="backupnophoto">Backup without photos</button><button data-act="csv">Export CSV files</button></div>
      <label style="margin-top:12px">Import sets from CSV (same columns as the export)</label><input type="file" accept=".csv,text/csv" data-change="csvimport">
      <p class="tiny muted">CSV columns: date, session_id, session_title, exercise_id, set_no, kind (warmup/working), weight_kg, reps, rpe, rir, note. Existing session ids are skipped.</p></div>

      <div class="card"><h2>Install on your phone</h2><ul class="clean small"><li><b>iPhone (Safari):</b> open the app address → Share → <i>Add to Home Screen</i>.</li><li><b>Android (Chrome):</b> menu ⋮ → <i>Install app</i>.</li><li>After the first visit it works offline in the gym.</li></ul>
      <p class="small"><a href="tests.html">Run self-test</a> · <a href="gallery.html">Schematic gallery</a></p></div>

      <div class="card danger"><h2>Reset</h2><p class="small">Erase everything on this device and start empty. Make a backup first — you can restore it afterwards.</p><button class="btn-danger" data-act="reset">Erase all data</button></div>
      <p class="tiny muted center">Mario Fit · private, offline, no account. Health data never leaves this device unless you export it.</p>`;
  },
  forms: {
    prefs(form) {
      const fd = new FormData(form);
      Object.assign(state.settings, { namesFirst: fd.get('namesFirst'), theme: fd.get('theme'), weightStep: Number(fd.get('weightStep')), defaultRest: Number(fd.get('defaultRest')), sound: !!fd.get('sound'), vibrate: !!fd.get('vibrate') });
      save(); toast('Preferences saved'); go(location.hash);
    },
    profile(form) {
      const fd = new FormData(form);
      const p = state.profile, u = p.unknowns;
      p.name = fd.get('name') || p.name; p.age = numOrNull(fd.get('age')); p.heightCm = numOrNull(fd.get('heightCm')); p.country = fd.get('country');
      const prevW = u.currentWeight;
      for (const k of ['currentWeight', 'waistCm', 'bodyFatPct', 'dailyKcal', 'sleepHours', 'restingHr']) u[k] = numOrNull(fd.get(k));
      for (const k of ['armResolvedSince20Nov', 'creatineDaily', 'intermittentFasting', 'cardioAfter20Nov']) u[k] = fd.get(k) || null;
      for (const k of Object.keys(UNK_LABELS)) u[k] = fd.get(k) || null;
      if (u.currentWeight != null && u.currentWeight !== prevW) state.measurements.push({ id: uid('m'), date: isoDate(), weightKg: u.currentWeight, waistCm: u.waistCm, bodyFatPct: u.bodyFatPct, status: 'actual', note: 'From profile', source: 'logged' });
      if (u.armResolvedSince20Nov === 'yes') { const s = state.symptoms.find((x) => x.id === 'sym_arm_1120'); if (s && s.status !== 'resolved') { s.status = 'resolved'; s.recovery = `Reported resolved (${isoDate()})`; } }
      save(); toast('Profile saved');
    },
  },
  actions: {
    async backup() { await exportJSON(true); },
    async backupnophoto() { await exportJSON(false); },
    csv() { exportCSV(); },
    async reset() {
      if (!(await confirmBox('Erase ALL data on this device and reload the original data?', 'Erase', true))) return;
      await resetAll(); toast('Reset done'); location.hash = '#/'; location.reload();
    },
  },
  changes: {
    async restore(el) {
      const f = el.files?.[0]; if (!f) return;
      try {
        const data = JSON.parse(await f.text());
        if (!data.app || data.app !== 'mario-fit' || !data.state?.sessions) throw new Error('Not a Mario Fit backup');
        if (!(await confirmBox(`Restore backup from ${data.exportedAt?.slice(0, 10) || 'unknown date'}? Current data will be replaced.`, 'Restore', true))) return;
        await replaceState(data.state);
        for (const [id, url] of Object.entries(data.photos || {})) await setPhoto(id, url);
        toast('Backup restored'); location.hash = '#/'; location.reload();
      } catch (e) { toast('Restore failed: ' + e.message, 4000); }
    },
    async csvimport(el) {
      const f = el.files?.[0]; if (!f) return;
      try { const n = importSetsCSV(await f.text()); toast(`Imported ${n} session(s)`); go('#/history'); } catch (e) { toast('CSV import failed: ' + e.message, 4000); }
    },
  },
};

async function exportJSON(withPhotos) {
  await saveNow();
  const out = { app: 'mario-fit', version: 1, exportedAt: new Date().toISOString(), state, photos: withPhotos ? await allPhotos() : {} };
  download(`mario-fit-backup-${isoDate()}${withPhotos ? '' : '-nophotos'}.json`, JSON.stringify(out, null, 1));
  toast('Backup downloaded');
}

export function setsRows(st = state) {
  const rows = [];
  for (const s of st.sessions) for (const e of s.entries) for (const x of e.sets) {
    const ex = getEx(st, e.exerciseId);
    rows.push({ date: s.date, session_id: s.id, session_title: s.title, source: s.source, exercise_id: e.exerciseId, exercise_de: ex?.de, exercise_en: ex?.en, variant: e.variant || 'default', set_no: x.n, kind: x.kind, weight_kg: x.weight, reps: x.reps ?? 'unknown', rpe: x.rpe, rir: x.rir, note: x.note });
  }
  return rows;
}

function exportCSV() {
  const d = isoDate();
  download(`mario-fit-sets-${d}.csv`, toCSV(setsRows(), ['date', 'session_id', 'session_title', 'source', 'exercise_id', 'exercise_de', 'exercise_en', 'variant', 'set_no', 'kind', 'weight_kg', 'reps', 'rpe', 'rir', 'note']), 'text/csv');
  setTimeout(() => download(`mario-fit-cardio-${d}.csv`, toCSV(state.cardio.map((c) => ({ ...c, duration_min: Math.round((c.durationSec / 60) * 100) / 100 })), ['date', 'duration_min', 'distanceKm', 'avgSpeed', 'displayedSpeed', 'incline', 'avgHr', 'kcal', 'steps', 'kneeBefore', 'kneeAfter', 'effort', 'source', 'notes']), 'text/csv'), 400);
  setTimeout(() => download(`mario-fit-checkins-${d}.csv`, toCSV(state.checkins, ['date', 'timing', 'context', 'knee', 'kneeLocation', 'arm', 'armLocation', 'effort', 'fatigue', 'soreness', 'sleepH', 'unusual', 'notes', 'source']), 'text/csv'), 800);
  setTimeout(() => download(`mario-fit-body-${d}.csv`, toCSV(state.measurements, ['date', 'weightKg', 'waistCm', 'bodyFatPct', 'status', 'dateNote', 'note']), 'text/csv'), 1200);
  setTimeout(() => download(`mario-fit-food-${d}.csv`, toCSV(state.nutrition.entries, ['date', 'meal', 'name', 'portion', 'kcal', 'protein', 'carbs', 'fat', 'fibre']), 'text/csv'), 1600);
  toast('CSV files downloading');
}

export function importSetsCSV(text, st = state) {
  const rows = parseCSV(text);
  if (!rows.length || !('exercise_id' in rows[0]) || !('date' in rows[0])) throw new Error('missing columns');
  const bySession = new Map();
  for (const r of rows) {
    const sid = r.session_id || `csv_${r.date}_${r.session_title || 'workout'}`;
    if (!bySession.has(sid)) bySession.set(sid, { id: sid, date: r.date, title: r.session_title || 'Imported workout', type: 'strength', source: 'csv-import', status: 'finished', planDay: null, entries: [], note: 'Imported from CSV' });
    const s = bySession.get(sid);
    let e = s.entries.find((x) => x.exerciseId === r.exercise_id && (x.variant || 'default') === (r.variant || 'default'));
    if (!e) { e = { exerciseId: r.exercise_id, variant: r.variant || 'default', status: 'done', sets: [], note: '' }; s.entries.push(e); }
    e.sets.push({ n: Number(r.set_no) || e.sets.length + 1, kind: r.kind === 'warmup' ? 'warmup' : 'working', weight: numOrNull(r.weight_kg), reps: r.reps === 'unknown' ? null : numOrNull(r.reps), rpe: numOrNull(r.rpe), rir: numOrNull(r.rir), note: r.note || '', ts: null, formIssue: false, pain: false });
  }
  let n = 0;
  for (const s of bySession.values()) if (!st.sessions.some((x) => x.id === s.id)) { st.sessions.push(s); n++; }
  if (st === state) save();
  return n;
}
