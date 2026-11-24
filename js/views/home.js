// Dashboard + onboarding
import { state, save } from '../store.js';
import { esc, tag, isoDate, fmtDate, fmtShort, fmtNum, addDays, dayKey, DAY_ORDER, weekStart, numOrNull, uid, daysBetween } from '../util.js';
import { getEx, patternAlerts, strengthSessions, sessionTotals, weeklySummary, exerciseHistory, recordsFrom, suggestNext, painStatus } from '../logic.js';
import { EXERCISES, exName } from '../data/exercises.js';
import { planFor, preCheck } from './workout.js';
import { go, toast } from '../ui.js';
import { dayNutrition } from './nutrition.js';

export function latestWeight() {
  const ms = [...state.measurements].filter((m) => m.weightKg != null).sort((a, b) => (a.date < b.date ? -1 : 1));
  return { last: ms[ms.length - 1] || null, prev: ms[ms.length - 2] || null };
}

export default {
  title: 'Dashboard',
  render() {
    const today = isoDate();
    const key = dayKey(today);
    const plan = planFor(key);
    const act = state.active;
    let h = `<div class="row between"><div><div class="muted small">${fmtDate(today, true)}</div><h1 style="margin:0">Hi ${esc(state.profile.name)}</h1></div><a class="btn btn-sm" href="#/recovery/new">+ Check-in</a></div>`;
    // ---- today ----
    h += `<div class="card hero" style="margin-top:12px"><div class="muted small">Today's plan ${tag('target')}</div><h2 style="font-size:1.35rem;margin:.2em 0">${esc(plan.title)}</h2>`;
    if (plan.type === 'strength') {
      const items = plan.items.filter((i) => !i.optional);
      h += `<div class="small muted">${items.length} exercises · ${items.reduce((a, i) => a + i.sets, 0)} working sets · ${esc(plan.priority)}</div>
        <div class="small" style="margin-top:6px">${items.map((i) => esc(getEx(state, i.exerciseId)?.de)).join(' · ')}</div>
        <div class="grid2" style="margin-top:12px">${act ? `<a class="btn btn-orange" href="#/live">Resume workout</a>` : `<button class="btn-primary" data-act="quick">Quick start</button>`}<a class="btn" href="#/workout">View plan</a></div>`;
    } else if (plan.type === 'cardio') {
      h += `<div class="small">${esc(plan.note)}</div><div class="grid2" style="margin-top:12px"><a class="btn btn-primary" href="#/cardio/new">Log treadmill</a><a class="btn" href="#/workout">Guidance</a></div>`;
    } else {
      h += `<div class="small muted">Rest / recovery day. Optional short mobility or an easy walk.</div><div class="grid2" style="margin-top:12px"><a class="btn" href="#/workout?day=r_morning_mob">Mobility</a><a class="btn" href="#/workout?day=${DAY_ORDER[(DAY_ORDER.indexOf(key) + 1) % 7]}">Tomorrow's plan</a></div>`;
    }
    h += `</div>`;
    // ---- alerts ----
    const alerts = patternAlerts(state, today);
    for (const a of alerts) h += `<div class="card ${a.level === 'warn' ? 'warn' : 'info'}"><b>${esc(a.title)}</b><p class="small" style="margin:.3em 0 0">${esc(a.text)}</p>${a.action ? `<a class="btn btn-sm" style="margin-top:8px" href="${a.action}">Add check-in</a>` : ''}</div>`;
    // ---- week ----
    const wk = weeklySummary(state, today);
    const ws = weekStart(today);
    h += `<div class="section-title"><h2>This week</h2><span class="muted small">${wk.strengthDays}/${state.profile.frequencyTarget.strength} strength · ${wk.cardioDays}/${state.profile.frequencyTarget.cardio} cardio</span></div><div class="card"><div class="weekdots">`;
    DAY_ORDER.forEach((d, i) => {
      const date = addDays(ws, i);
      const s = wk.strength.some((x) => x.date === date), c = wk.cardio.some((x) => x.date === date);
      const p = state.plan[d];
      h += `<div><div class="d ${s ? 's' : c ? 'c' : ''} ${date === today ? 'today' : ''}">${s ? '✓' : c ? '♥' : p.type === 'rest' ? '–' : '·'}</div>${d.slice(0, 2).toUpperCase()}</div>`;
    });
    const pct = Math.min(100, ((wk.strengthDays + wk.cardioDays) / (state.profile.frequencyTarget.strength + state.profile.frequencyTarget.cardio)) * 100);
    h += `</div><div class="progress" style="margin-top:10px"><div style="width:${pct}%"></div></div><p class="tiny muted" style="margin:.4em 0 0">Target: 5 gym visits (4 strength + 1 cardio). Plan days are intentions, not attendance.</p></div>`;
    // ---- last workout ----
    const last = strengthSessions(state).slice(-1)[0];
    if (last) {
      const t = sessionTotals(last);
      h += `<div class="section-title"><h2>Last workout</h2><a class="small" href="#/history">History ›</a></div>
        <a class="item" href="#/session/${last.id}"><div class="meta"><b>${esc(last.title)}</b><div class="small muted">${fmtDate(last.date)} · ${last.source === 'imported' ? 'imported log' : 'logged in app'}</div>
        <div class="small">${t.exercises} exercises · ${t.sets} working sets · ${t.reps} reps · ${fmtNum(t.volume)} kg ${tag('actual')}</div></div><span class="chev">›</span></a>`;
    }
    // ---- weight ----
    const { last: lw, prev: pw } = latestWeight();
    const stale = !lw || daysBetween(lw.date, today) > 14;
    h += `<div class="section-title"><h2>Body weight</h2><a class="small" href="#/progress?tab=body">Trend ›</a></div><div class="card tight"><div class="row between nw"><div>
      ${lw ? `<b style="font-size:1.4rem">${fmtNum(lw.weightKg, 1)} kg</b> ${tag(lw.status === 'estimate' ? 'estimate' : 'actual')}<div class="small muted">${fmtDate(lw.date)}${lw.dateNote ? ' · ' + esc(lw.dateNote) : ''}</div>` : '<b>Unknown</b>'}
      ${lw && pw ? `<div class="small">${lw.weightKg - pw.weightKg <= 0 ? '▼' : '▲'} ${fmtNum(Math.abs(lw.weightKg - pw.weightKg), 1)} kg since ${pw.dateNote ? 'October' : fmtShort(pw.date)}${pw.status === 'estimate' ? ' (vs. estimate)' : ''}</div>` : ''}
      ${stale ? '<div class="small warnc">Current weight needs updating</div>' : ''}</div><button class="btn-sm" data-act="weight">Log weight</button></div></div>`;
    // ---- records ----
    const recs = EXERCISES.filter((e) => e.type === 'strength').map((e) => { const r = recordsFrom(exerciseHistory(state, e.id)); return r.heaviest ? { e, r } : null; }).filter(Boolean)
      .sort((a, b) => (a.r.heaviest.date < b.r.heaviest.date ? 1 : -1)).slice(0, 5);
    if (recs.length) {
      h += `<div class="section-title"><h2>Best documented</h2><a class="small" href="#/progress">All ›</a></div><div class="card tight"><table class="simple">`;
      for (const { e, r } of recs) h += `<tr><td>${esc(exName(e, state.settings))}</td><td class="nowrap"><b>${r.heaviest.weight} kg × ${r.heaviest.reps ?? '?'}</b></td><td class="muted small nowrap">${fmtShort(r.heaviest.date)}</td></tr>`;
      h += `</table><p class="tiny muted" style="margin:.4em 0 0">Historical bests ${tag('actual')} — not automatically the right next load.</p></div>`;
    }
    // ---- next Sunday cardio ----
    const daysToSun = (7 - new Date().getDay()) % 7;
    const sun = addDays(today, daysToSun);
    const lastC = [...state.cardio].sort((a, b) => (a.date < b.date ? 1 : -1))[0];
    const knee = painStatus(state).knee;
    h += `<div class="section-title"><h2>Sunday cardio</h2><a class="small" href="#/cardio">Cardio ›</a></div><div class="card tight"><b>${daysToSun === 0 ? 'Today' : fmtDate(sun)}</b> · treadmill 40–50 min, 4.5–5 km/h ${tag('target')}
      <div class="small muted">${knee.active ? 'Knee symptom active → start 0–3 % incline.' : 'Incline adjusted to knee and recovery.'}${lastC ? ` Last: ${fmtShort(lastC.date)}, ${Math.round(lastC.durationSec / 60)} min, ${lastC.distanceKm ?? '?'} km${lastC.incline != null ? ', ' + lastC.incline + ' %' : ''}.` : ''}</div></div>`;
    // ---- nutrition + supplements ----
    const n = dayNutrition(today);
    const tg = state.nutrition.target;
    const taken = state.suppIntake.filter((x) => x.date === today).length;
    const active = state.supplements.filter((s) => s.status !== 'stopped' && s.status !== 'planned').length;
    h += `<div class="wide2" style="margin-top:12px"><a class="card" href="#/nutrition" style="display:block;text-decoration:none;color:inherit"><div class="row between"><b>Nutrition today</b><span class="tag tag-estimate">target est.</span></div>
      <div class="small">${fmtNum(n.kcal)} / ${fmtNum(tg.kcal)} kcal</div><div class="progress orange"><div style="width:${Math.min(100, (n.kcal / tg.kcal) * 100)}%"></div></div>
      <div class="small" style="margin-top:6px">${fmtNum(n.protein)} / ${tg.protein} g protein</div><div class="progress"><div style="width:${Math.min(100, (n.protein / tg.protein) * 100)}%"></div></div></a>
      <a class="card" href="#/supplements" style="display:block;text-decoration:none;color:inherit"><b>Supplements</b><div class="small">${taken} of ${active} ticked today</div><div class="tiny muted">Checklist only — no medical claims.</div></a></div>`;
    return h;
  },
  actions: {
    quick() { preCheck(dayKey(isoDate()), isoDate(), false); },
    weight() { go('#/progress?tab=body&add=1'); },
  },
};

// ---------------- onboarding ----------------
const yn = (name, val) => `<select name="${name}"><option value="" ${val == null ? 'selected' : ''}>Unknown / skip</option><option value="yes" ${val === 'yes' ? 'selected' : ''}>Yes</option><option value="no" ${val === 'no' ? 'selected' : ''}>No</option></select>`;

export const onboarding = {
  title: 'Welcome',
  render() {
    const u = state.profile.unknowns;
    return `<div class="card hero"><h1>Welcome${state.profile.name ? ', ' + esc(state.profile.name) : ''}</h1>
      ${state.sessions.length ? '<p>Your profile, weekly plan and history are loaded. Every value is labelled:</p>' : '<p>Have a backup file? <a class="btn btn-primary" href="#/settings">Restore backup</a> (Settings → Backup). Otherwise start fresh below. Every value is labelled:</p>'}
      <p>${tag('actual')} logged result · ${tag('target')} plan · ${tag('suggestion')} app proposal · ${tag('estimate')} approximate · ${tag('unknown')} not documented</p>
      <p class="small muted">Everything stays on this device. Nothing is sent anywhere.</p></div>
      <form class="card" data-form="ob"><h2>Fill in what you know <span class="muted small">(all optional)</span></h2>
      <div class="grid2"><div><label>Current weight (kg)</label><input name="weight" inputmode="decimal" placeholder="${state.measurements.length ? 'last: ' + state.measurements[state.measurements.length - 1].weightKg : ''}"></div><div><label>Waist (cm)</label><input name="waist" inputmode="decimal" value="${u.waistCm ?? ''}"></div>
      <div><label>Body fat % (optional)</label><input name="bf" inputmode="decimal" value="${u.bodyFatPct ?? ''}"></div><div><label>Average sleep (h)</label><input name="sleep" inputmode="decimal" value="${u.sleepHours ?? ''}"></div>
      <div><label>Resting heart rate</label><input name="rhr" inputmode="numeric" value="${u.restingHr ?? ''}"></div><div><label>Exercise names first</label><select name="names"><option value="de" ${state.settings.namesFirst === 'de' ? 'selected' : ''}>Deutsch</option><option value="en" ${state.settings.namesFirst === 'en' ? 'selected' : ''}>English</option></select></div></div>
      <label>Has the recorded upper-arm discomfort resolved?</label>${yn('arm', u.armResolvedSince20Nov)}
      <label>Taking creatine daily now?</label>${yn('creatine', u.creatineDaily)}
      <label>Following intermittent fasting?</label>${yn('ifast', u.intermittentFasting)}
      <label>Did you do cardio after your last strength workout?</label>${yn('c20', u.cardioAfter20Nov)}
      <div class="grid2" style="margin-top:16px"><button type="button" data-act="skip">Skip for now</button><button class="btn-primary">Save &amp; continue</button></div>
      <p class="tiny muted">You can edit these any time in Settings → Profile.</p></form>`;
  },
  actions: { skip() { state.onboarded = true; save(); go('#/'); } },
  forms: {
    ob(form) {
      const fd = new FormData(form);
      const u = state.profile.unknowns;
      const w = numOrNull(fd.get('weight'));
      if (w != null) { u.currentWeight = w; state.measurements.push({ id: uid('m'), date: isoDate(), weightKg: w, waistCm: numOrNull(fd.get('waist')), bodyFatPct: numOrNull(fd.get('bf')), status: 'actual', note: 'Onboarding', source: 'logged' }); }
      else if (numOrNull(fd.get('waist')) != null) state.measurements.push({ id: uid('m'), date: isoDate(), weightKg: null, waistCm: numOrNull(fd.get('waist')), bodyFatPct: numOrNull(fd.get('bf')), status: 'actual', note: 'Onboarding', source: 'logged' });
      u.waistCm = numOrNull(fd.get('waist')); u.bodyFatPct = numOrNull(fd.get('bf')); u.sleepHours = numOrNull(fd.get('sleep')); u.restingHr = numOrNull(fd.get('rhr'));
      u.armResolvedSince20Nov = fd.get('arm') || null; u.creatineDaily = fd.get('creatine') || null; u.intermittentFasting = fd.get('ifast') || null; u.cardioAfter20Nov = fd.get('c20') || null;
      state.settings.namesFirst = fd.get('names');
      if (u.armResolvedSince20Nov === 'yes') {
        const s = state.symptoms.find((x) => x.id === 'sym_arm_1120'); if (s) { s.status = 'resolved'; s.recovery = 'Reported resolved (onboarding, ' + isoDate() + ')'; }
        state.checkins.push({ id: uid('ci'), date: isoDate(), timing: 'general', context: 'onboarding', knee: null, arm: 0, armLocation: 'Left upper arm', effort: null, fatigue: null, soreness: '', sleepH: null, kneeLocation: '', unusual: '', notes: 'Reported resolved at onboarding', source: 'logged' });
      }
      if (u.creatineDaily === 'yes') { const c = state.supplements.find((s) => s.id === 'sup_creatine'); if (c) { c.days = 'daily'; c.confirmed = true; } }
      state.onboarded = true; save(); toast('Saved'); go('#/');
    },
  },
};
