// Pure training logic: totals, comparisons, PRs, progression suggestions, pain gating, alerts.
// No DOM access here, so tests.html can verify it directly.
import { EX_BY_ID, MUSCLE_GROUP } from './data/exercises.js';
import { addDays, daysBetween, weekStart, isoDate, dayKey, fmtShort } from './util.js';

export function getEx(state, id) {
  return EX_BY_ID[id] || (state?.customExercises || []).find((e) => e.id === id) || null;
}

export const isWorking = (s) => s.kind !== 'warmup';
export const workingSets = (entry) => (entry?.sets || []).filter(isWorking);
export const setVolume = (s) => (s.weight != null && s.reps != null ? s.weight * s.reps : 0);

export function setsTotals(sets) {
  const w = sets.filter(isWorking);
  return {
    sets: w.length,
    reps: w.reduce((a, s) => a + (s.reps ?? 0), 0),
    volume: w.reduce((a, s) => a + setVolume(s), 0),
    unknownReps: w.filter((s) => s.reps == null).length,
    topWeight: w.reduce((a, s) => Math.max(a, s.weight ?? 0), 0),
    warmups: sets.length - w.length,
  };
}

/** Working sets / reps / volume for a whole session (warm-ups excluded). */
export function sessionTotals(session) {
  const t = { sets: 0, reps: 0, volume: 0, unknownReps: 0, exercises: 0, warmups: 0 };
  for (const e of session.entries || []) {
    const x = setsTotals(e.sets || []);
    if (x.sets) t.exercises++;
    t.sets += x.sets; t.reps += x.reps; t.volume += x.volume; t.unknownReps += x.unknownReps; t.warmups += x.warmups;
  }
  return t;
}

export function strengthSessions(state, { finishedOnly = true } = {}) {
  return (state.sessions || [])
    .filter((s) => s.type === 'strength' && (!finishedOnly || s.status === 'finished'))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : (a.finishedAt || '') < (b.finishedAt || '') ? -1 : 1));
}

/** History of one exercise: one row per session that has working sets for it. */
export function exerciseHistory(state, exId, { variant = null, beforeDate = null, excludeSessionId = null, includeActive = false } = {}) {
  const out = [];
  const list = strengthSessions(state);
  if (includeActive && state.active) list.push(state.active);
  for (const s of list) {
    if (excludeSessionId && s.id === excludeSessionId) continue;
    if (beforeDate && s.date >= beforeDate) continue;
    for (const e of s.entries || []) {
      if (e.exerciseId !== exId) continue;
      if (variant && (e.variant || 'default') !== variant) continue;
      const w = workingSets(e);
      if (!w.length) continue;
      out.push({ date: s.date, sessionId: s.id, source: s.source, entry: e, sets: w, totals: setsTotals(e.sets) });
    }
  }
  return out;
}

export function lastPerformance(state, exId, opts = {}) {
  const h = exerciseHistory(state, exId, opts);
  return h.length ? h[h.length - 1] : null;
}

export const e1rm = (w, r) => (w && r ? w * (1 + r / 30) : 0); // Epley — an ESTIMATE

/** Compare two sets of working sets of the same exercise. */
export function compareSets(prev, curr) {
  const a = setsTotals(prev), b = setsTotals(curr);
  const details = [];
  let up = 0, down = 0;
  const known = a.unknownReps === 0 && b.unknownReps === 0;
  const n = Math.max(prev.length, curr.length);
  for (let i = 0; i < n; i++) {
    const p = prev[i], c = curr[i];
    if (!p || !c || p.reps == null || c.reps == null) continue;
    if (c.weight > p.weight && c.reps >= p.reps) { up++; details.push(`Set ${i + 1}: +${round1(c.weight - p.weight)} kg (${p.weight}→${c.weight} kg × ${c.reps})`); }
    else if (c.weight === p.weight && c.reps > p.reps) { up++; details.push(`Set ${i + 1}: +${c.reps - p.reps} rep${c.reps - p.reps > 1 ? 's' : ''} at ${c.weight} kg`); }
    else if (c.weight < p.weight || (c.weight === p.weight && c.reps < p.reps)) down++;
  }
  const repsDelta = b.reps - a.reps;
  const volumeDelta = b.volume - a.volume;
  const topDelta = b.topWeight - a.topWeight;
  const setsDelta = b.sets - a.sets;
  let verdict = 'same';
  if (!known) verdict = 'unknown';
  else if (up > 0 && down === 0) verdict = 'progress';
  else if (up === 0 && down > 0) verdict = 'regress';
  else if (up > 0 && down > 0) verdict = volumeDelta >= 0 ? 'progress' : 'mixed';
  else if (setsDelta > 0 && volumeDelta > 0) verdict = 'progress';
  else if (setsDelta < 0) verdict = 'fewer-sets';
  // when weights are identical everywhere, summarise rep gains
  const sameWeights = prev.length === curr.length && prev.every((p, i) => p.weight === curr[i].weight);
  if (sameWeights && known && repsDelta > 0) details.unshift(`+${repsDelta} reps total at the same weights`);
  return { prev: a, curr: b, repsDelta, volumeDelta, topDelta, setsDelta, verdict, details };
}

const round1 = (x) => Math.round(x * 10) / 10;
export const roundTo = (x, inc) => (inc ? Math.round(x / inc) * inc : Math.round(x));

/** Personal records of an exercise from a list of history rows. */
export function recordsFrom(rows) {
  const r = { heaviest: null, bestE1rm: null, bestSetVolume: null, bestSessionVolume: null, mostReps: null };
  for (const h of rows) {
    for (const s of h.sets) {
      if (s.weight == null) continue;
      if (!r.heaviest || s.weight > r.heaviest.weight || (s.weight === r.heaviest.weight && (s.reps ?? 0) > (r.heaviest.reps ?? 0)))
        r.heaviest = { weight: s.weight, reps: s.reps, date: h.date };
      if (s.reps == null) continue;
      const e = e1rm(s.weight, s.reps);
      if (!r.bestE1rm || e > r.bestE1rm.value) r.bestE1rm = { value: e, weight: s.weight, reps: s.reps, date: h.date };
      if (!r.bestSetVolume || s.weight * s.reps > r.bestSetVolume.value) r.bestSetVolume = { value: s.weight * s.reps, weight: s.weight, reps: s.reps, date: h.date };
    }
    if (h.totals.unknownReps === 0 && (!r.bestSessionVolume || h.totals.volume > r.bestSessionVolume.value))
      r.bestSessionVolume = { value: h.totals.volume, sets: h.totals.sets, date: h.date };
    if (h.totals.unknownReps === 0 && (!r.mostReps || h.totals.reps > r.mostReps.value)) r.mostReps = { value: h.totals.reps, date: h.date };
  }
  return r;
}

/** New PRs in `session` vs everything before it (same exercise, same variant). */
export function detectPRs(state, session) {
  const prs = [];
  for (const e of session.entries || []) {
    const w = workingSets(e).filter((s) => s.weight != null && s.reps != null);
    if (!w.length) continue;
    const before = exerciseHistory(state, e.exerciseId, { variant: e.variant || 'default', excludeSessionId: session.id })
      .filter((h) => h.date < session.date || (h.date === session.date && h.sessionId !== session.id && false));
    if (!before.length) continue; // first time: baseline, not a PR
    const r = recordsFrom(before);
    const ex = getEx(state, e.exerciseId);
    const top = w.reduce((a, s) => (s.weight > a.weight || (s.weight === a.weight && s.reps > a.reps) ? s : a), w[0]);
    if (r.heaviest && top.weight > r.heaviest.weight) prs.push({ exerciseId: e.exerciseId, kind: 'Heaviest weight', text: `${ex?.en || e.exerciseId}: ${top.weight} kg × ${top.reps} (previous best ${r.heaviest.weight} kg)` });
    else {
      // rep PR at a given weight
      const bestAt = Math.max(0, ...before.flatMap((h) => h.sets.filter((s) => s.weight === top.weight && s.reps != null).map((s) => s.reps)));
      if (bestAt && top.reps > bestAt) prs.push({ exerciseId: e.exerciseId, kind: 'Rep record', text: `${ex?.en || e.exerciseId}: ${top.reps} reps at ${top.weight} kg (previous best ${bestAt})` });
    }
    const vol = setsTotals(e.sets).volume;
    if (r.bestSessionVolume && vol > r.bestSessionVolume.value) prs.push({ exerciseId: e.exerciseId, kind: 'Exercise volume', text: `${ex?.en || e.exerciseId}: ${vol} kg working volume (previous best ${r.bestSessionVolume.value} kg)` });
  }
  return prs;
}

// ---------- Pain / symptom status ----------

/** Current knee / arm status as of `today` (ISO). */
export function painStatus(state, today = isoDate()) {
  const res = {};
  for (const part of ['knee', 'arm']) {
    const cis = (state.checkins || []).filter((c) => c.date <= today && c[part] != null).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    const last = cis[cis.length - 1] || null;
    const prev = cis[cis.length - 2] || null;
    const syms = (state.symptoms || []).filter((s) => (part === 'knee' ? s.area === 'knee' : s.area !== 'knee') && s.date && s.date <= today);
    const openSym = syms.filter((s) => s.status !== 'resolved').sort((a, b) => (a.date < b.date ? 1 : -1))[0] || null;
    const recentScore = last && daysBetween(last.date, today) <= 7 ? last[part] : null;
    // A later pain-free check-in clears an open symptom only if the person also marked it resolved.
    let active = false, reason = '';
    if (recentScore != null && recentScore > 0) { active = true; reason = `${part === 'knee' ? 'Knee' : 'Left arm'} pain ${recentScore}/10 logged on ${fmtShort(last.date)}`; }
    else if (openSym && daysBetween(openSym.date, today) <= 28) { active = true; reason = `${part === 'knee' ? 'Knee' : 'Left upper-arm'} symptom from ${fmtShort(openSym.date)} is not marked resolved`; }
    const worsening = !!(last && prev && last[part] > prev[part] && daysBetween(prev.date, last.date) <= 14);
    res[part] = { active, reason, score: recentScore, lastDate: last?.date || null, worsening, openSymptom: openSym };
  }
  return res;
}

// ---------- Progression suggestion (always a SUGGESTION, never a logged result) ----------

export function suggestNext(state, exId, planItem = {}, { today = isoDate(), variant = 'default', pain = null } = {}) {
  const ex = getEx(state, exId) || { increment: 5, armLoad: 0, kneeLoad: 0 };
  const inc = state.exerciseSettings?.[exId]?.increment ?? ex.increment ?? 5;
  const repsMin = planItem.repsMin ?? 10, repsMax = planItem.repsMax ?? 12;
  let sets = planItem.sets ?? 3;
  const last = lastPerformance(state, exId, { variant, beforeDate: addDays(today, 1) });
  const p = pain || painStatus(state, today);
  const out = { exerciseId: exId, kind: 'suggestion', status: 'hold', weight: null, reps: null, sets, text: '', reasons: [], blocked: false, last };

  if (ex.type === 'cardio') { out.status = 'cardio'; out.text = 'See cardio guidance.'; return out; }

  if (!last) {
    out.status = 'establish';
    out.reps = repsMin;
    out.text = `No logged history yet. Start light and find a weight you can do for ${repsMin}${repsMax !== repsMin ? '–' + repsMax : ''} clean reps.`;
  } else {
    const w = last.sets;
    const top = Math.max(...w.map((s) => s.weight ?? 0));
    const allKnown = w.every((s) => s.reps != null);
    const allAtTop = w.every((s) => s.weight === top);
    const allAtMax = allKnown && w.every((s) => s.reps >= repsMax);
    const formIssue = w.some((s) => s.formIssue || s.pain);
    const minReps = allKnown ? Math.min(...w.map((s) => s.reps)) : null;
    out.weight = top;
    if (!allKnown) {
      out.status = 'hold'; out.reps = repsMin;
      out.text = `Reps last time (${fmtShort(last.date)}) are unknown. Repeat ${top} kg and record every rep so progress can be judged.`;
    } else if (formIssue) {
      out.status = 'hold'; out.reps = Math.max(repsMin, minReps);
      out.text = `Form or pain was flagged last time — repeat ${top} kg and focus on clean, comfortable reps.`;
      out.reasons.push('Technique / pain flag on last session');
    } else if (allAtTop && allAtMax && w.length >= Math.min(sets, 2)) {
      out.status = 'increase'; out.weight = roundTo(top + inc, inc); out.reps = repsMin;
      out.text = `All sets reached ${repsMax} reps at ${top} kg on ${fmtShort(last.date)}. Next step: ${out.weight} kg for ${repsMin}+ reps — only if form was clean and you feel recovered.`;
    } else if (!allAtTop) {
      out.status = 'consolidate'; out.reps = repsMin;
      out.text = `Last time you ramped up to ${top} kg. Aim to do every working set at ${top} kg for ${repsMin}–${repsMax} reps before going heavier.`;
    } else {
      out.status = 'reps';
      out.reps = Math.min(repsMax, minReps + 1);
      out.text = minReps < repsMin
        ? `Keep ${top} kg and build clean reps (${minReps}→${out.reps}, then up to ${repsMin}–${repsMax}) before adding load.`
        : `Keep ${top} kg and add a rep where you can (target ${out.reps}–${repsMax}). Increase load once all sets reach ${repsMax}.`;
    }
  }

  // Pain gating — blocks or reduces progression
  const gate = (part, load) => {
    const s = p[part];
    if (!s?.active || !load) return;
    const label = part === 'knee' ? 'right knee' : 'left upper arm';
    out.blocked = true;
    out.reasons.push(s.reason);
    if (out.status === 'increase' || out.status === 'consolidate') { out.weight = last ? Math.max(...last.sets.map((x) => x.weight ?? 0)) : out.weight; }
    const severe = (s.score ?? 0) >= 5 || s.worsening;
    if (severe && load >= 2) {
      out.status = 'skip';
      out.text = `Pain is ${s.worsening ? 'worsening' : 'significant'} (${label}). Consider skipping this exercise today or replacing it with a pain-free alternative. If it persists or worsens, seek a professional assessment.`;
      if (out.weight) out.weight = roundTo(out.weight * 0.8, inc);
    } else if (load >= 2 || (s.score ?? 0) >= 3) {
      out.status = 'reduce';
      if (out.weight) out.weight = roundTo(out.weight * 0.85, inc);
      out.sets = Math.max(1, sets - 1);
      out.text = `${label[0].toUpperCase() + label.slice(1)} symptom active — no load increase. Suggest about 10–20 % lighter${out.weight ? ` (~${out.weight} kg)` : ''}, ${out.sets} set${out.sets > 1 ? 's' : ''}, comfortable range. Stop if the symptom appears during the set.`;
    } else {
      out.status = 'hold';
      if (last) { const kn = last.sets.filter((x) => x.reps != null).map((x) => x.reps); if (kn.length) out.reps = Math.min(...kn); }
      out.text = `${label[0].toUpperCase() + label.slice(1)} symptom noted — no load increase today. Repeat${out.weight ? ` ${out.weight} kg` : ' a comfortable weight'} only if it feels fine; stop if it hurts.`;
    }
  };
  gate('arm', ex.armLoad);
  gate('knee', ex.kneeLoad);

  if (state.settings?.deload && !out.blocked) {
    out.status = 'deload';
    out.sets = Math.max(1, sets - 1);
    if (out.weight) out.weight = roundTo(out.weight * 0.85, inc);
    out.text = `Deload week: ${out.sets} set${out.sets > 1 ? 's' : ''}${out.weight ? ` at ~${out.weight} kg` : ''}, stop 3+ reps before failure.`;
  }
  return out;
}

// ---------- Analytics ----------

export function setsPerMuscleGroup(state, fromISO, toISO) {
  const groups = {};
  for (const s of strengthSessions(state)) {
    if (s.date < fromISO || s.date > toISO) continue;
    for (const e of s.entries) {
      const ex = getEx(state, e.exerciseId);
      if (!ex) continue;
      const n = workingSets(e).length;
      if (!n) continue;
      const prim = new Set(ex.primary.map((m) => MUSCLE_GROUP[m]));
      const sec = new Set(ex.secondary.map((m) => MUSCLE_GROUP[m]).filter((g) => !prim.has(g)));
      for (const g of prim) groups[g] = (groups[g] || 0) + n;
      for (const g of sec) groups[g] = (groups[g] || 0) + n * 0.5;
    }
  }
  return groups;
}

export function weeklySummary(state, anyISO) {
  const ws = weekStart(anyISO), we = addDays(ws, 6);
  const strength = strengthSessions(state).filter((s) => s.date >= ws && s.date <= we);
  const cardio = (state.cardio || []).filter((c) => c.date >= ws && c.date <= we);
  const plannedStrength = Object.values(state.plan).filter((d) => d.type === 'strength').length;
  const plannedCardio = Object.values(state.plan).filter((d) => d.type === 'cardio').length;
  const strengthDays = new Set(strength.map((s) => s.date)).size;
  const cardioDays = new Set(cardio.map((c) => c.date)).size;
  return { weekStart: ws, weekEnd: we, strengthDays, cardioDays, plannedStrength, plannedCardio, strength, cardio,
    volume: strength.reduce((a, s) => a + sessionTotals(s).volume, 0) };
}

export function weeklySeries(state, weeks = 8, today = isoDate()) {
  const out = [];
  let ws = weekStart(today);
  for (let i = 0; i < weeks; i++) { out.unshift(weeklySummary(state, ws)); ws = addDays(ws, -7); }
  return out;
}

/** Compare a finished session with previous ones. */
export function sessionComparison(state, session) {
  const all = strengthSessions(state).filter((s) => s.id !== session.id && s.date <= session.date);
  const samePlan = all.filter((s) => session.planDay && s.planDay === session.planDay);
  const prev = (samePlan.length ? samePlan : all).slice(-1)[0] || null;
  const last4 = all.slice(-4);
  const t = sessionTotals(session);
  const avg4 = last4.length ? {
    sets: last4.reduce((a, s) => a + sessionTotals(s).sets, 0) / last4.length,
    reps: last4.reduce((a, s) => a + sessionTotals(s).reps, 0) / last4.length,
    volume: last4.reduce((a, s) => a + sessionTotals(s).volume, 0) / last4.length,
  } : null;
  const perExercise = (session.entries || []).filter((e) => workingSets(e).length).map((e) => {
    const before = exerciseHistory(state, e.exerciseId, { variant: e.variant || 'default', excludeSessionId: session.id }).filter((h) => h.date <= session.date);
    const p = before[before.length - 1];
    return { exerciseId: e.exerciseId, entry: e, prev: p || null, cmp: p ? compareSets(p.sets, workingSets(e)) : null };
  });
  return { totals: t, prev, samePlan: !!(session.planDay && samePlan.length), prevTotals: prev ? sessionTotals(prev) : null, avg4, perExercise, prs: detectPRs(state, session) };
}

// ---------- Pattern alerts (no diagnosis) ----------

export const SEEK_HELP = 'If symptoms persist, worsen, or come with weakness, swelling, bruising or loss of movement, seek a professional assessment. This app does not diagnose.';

export function patternAlerts(state, today = isoDate()) {
  const alerts = [];
  const p = painStatus(state, today);
  const syms = state.symptoms || [];
  const armSyms = syms.filter((s) => s.area !== 'knee');
  const armRecurrent = armSyms.some((s) => s.recurrent) || armSyms.length >= 2;
  if (armRecurrent) {
    alerts.push({ level: 'warn', part: 'arm', title: 'Recurring left upper-arm discomfort',
      text: 'Upper-arm discomfort has appeared after more than one intensive upper-body session. Consider reducing upper-body pressing volume (e.g. not both chest press and chest crossover at full volume), and stop exercises that provoke it. ' + SEEK_HELP });
  }
  if (p.arm.active && p.arm.openSymptom && p.arm.openSymptom.status === 'unknown') {
    alerts.push({ level: 'info', part: 'arm', title: 'Has the left-arm discomfort resolved?', text: `Not documented since ${fmtShort(p.arm.openSymptom.date)}. Add a quick check-in (0–10) so suggestions can adjust.`, action: '#/recovery/new?focus=arm' });
  }
  const kneeHits = (state.checkins || []).filter((c) => c.knee > 0 && daysBetween(c.date, today) <= 30);
  if (kneeHits.length >= 2) {
    alerts.push({ level: 'warn', part: 'knee', title: 'Knee discomfort logged repeatedly', text: `${kneeHits.length} check-ins with knee pain in the last 30 days. Prefer low-incline walking and knee-friendly machines; skip leg exercises that provoke it. ` + SEEK_HELP });
  }
  if (p.knee.worsening) alerts.push({ level: 'warn', part: 'knee', title: 'Knee score rising', text: 'Your latest knee score is higher than the one before. Progression on knee-loading exercises is paused.' });
  if (p.arm.worsening) alerts.push({ level: 'warn', part: 'arm', title: 'Left-arm score rising', text: 'Your latest left-arm score is higher than the one before. Progression on upper-body exercises is paused. ' + SEEK_HELP });
  // next-day follow-up
  const yesterday = addDays(today, -1);
  const yAfter = (state.checkins || []).find((c) => c.date === yesterday && c.timing === 'after' && ((c.knee ?? 0) > 0 || (c.arm ?? 0) > 0));
  const todayNext = (state.checkins || []).find((c) => c.date === today && c.timing === 'next-day');
  if (yAfter && !todayNext) alerts.push({ level: 'info', title: 'Next-day follow-up', text: 'You logged symptoms after yesterday\'s session. How does it feel today?', action: '#/recovery/new?timing=next-day' });
  // volume above prescription on last upper body
  const last = strengthSessions(state).slice(-1)[0];
  if (last && last.planDay && state.plan[last.planDay]) {
    const prescribed = state.plan[last.planDay].items.reduce((a, i) => a + (i.optional ? 0 : i.sets), 0);
    const done = sessionTotals(last).sets;
    if (done > prescribed && daysBetween(last.date, today) <= 10)
      alerts.push({ level: 'info', title: 'Completed more than prescribed', text: `Last ${last.title} session (${fmtShort(last.date)}): ${done} working sets vs ${prescribed} prescribed. More volume is not guaranteed to build more muscle and can add fatigue.` });
  }
  return alerts;
}

export function plannedDayFor(state, iso) {
  const k = dayKey(iso);
  return { key: k, day: state.plan[k] };
}

/** Summary rows for a history row list, filtered by range key */
export function filterRange(rows, range, today = isoDate()) {
  if (range === 'prev') return rows.slice(-2);
  if (range === 'last4') return rows.slice(-4);
  if (range === 'month') return rows.filter((r) => daysBetween(r.date, today) <= 31);
  if (range === '3months') return rows.filter((r) => daysBetween(r.date, today) <= 92);
  return rows;
}
