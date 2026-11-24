// Supplements: checklist, details, adherence, self-observations, labs. No endorsements or medical claims.
import { state, save } from '../store.js';
import { esc, tag, isoDate, addDays, fmtDate, numOrNull, uid, dayKey } from '../util.js';
import { openSheet, go, toast, confirmBox } from '../ui.js';

const STATUS = { reported: 'Reported — reconfirm', taking: 'Taking (confirmed)', planned: 'Planned', paused: 'Paused', stopped: 'Stopped' };
const due = (s, date) => (s.status === 'reported' || s.status === 'taking') && (s.days !== 'mon-fri' || !['sat', 'sun'].includes(dayKey(date)));

export default {
  title: 'Supplements',
  render() {
    const today = isoDate();
    const sups = state.supplements;
    const taken = (id, d) => state.suppIntake.some((x) => x.date === d && x.suppId === id);
    let h = `<div class="card info small">Checklist and notes only. The app makes no health claims and does not recommend products or doses. Please review supplements with your physician.</div>
      <div class="section-title"><h2>Today</h2><span class="muted small">${fmtDate(today)}</span></div><div class="card">`;
    const dueToday = sups.filter((s) => due(s, today));
    h += dueToday.length ? dueToday.map((s) => `<label class="check"><input type="checkbox" data-change="take" data-id="${s.id}" ${taken(s.id, today) ? 'checked' : ''}><span class="grow">${esc(s.name)} <span class="muted small">${s.dose ?? ''} ${esc(s.unit)} · ${esc(s.timing)}${s.reminder ? ` · ⏰ ${s.reminder}` : ''}</span></span></label>`).join('') : '<p class="small muted">Nothing scheduled today.</p>';
    h += `<p class="tiny muted" style="margin:.4em 0 0">Reminder times are shown here; phones may not allow background notifications for web apps.</p></div>`;
    // adherence
    const days = Array.from({ length: 14 }, (_, i) => addDays(today, -13 + i));
    h += `<div class="section-title"><h2>Your supplements</h2><button class="btn-sm" data-act="edit" data-id="">+ Add</button></div><div class="list">`;
    for (const s of sups) {
      const dueDays = days.filter((d) => due(s, d));
      const n = dueDays.filter((d) => taken(s.id, d)).length;
      h += `<button class="item" style="width:100%;text-align:left" data-act="edit" data-id="${s.id}"><div class="meta"><div class="row between"><b>${esc(s.name)}</b><span class="tag ${s.status === 'taking' ? 'tag-good' : s.status === 'stopped' ? 'tag-bad' : 'tag-unknown'}">${STATUS[s.status]}</span></div>
        <div class="small muted">${[s.brand, s.form].filter(Boolean).map(esc).join(' · ')}${s.brand || s.form ? ' · ' : ''}${s.dose != null ? `${s.dose} ${esc(s.unit)}` : 'dose not set'} · ${esc(s.timing)}${s.days === 'mon-fri' ? ' · Mon–Fri' : ''}</div>
        ${dueDays.length ? `<div class="small">Ticked ${n}/${dueDays.length} scheduled days (14 d)</div>` : ''}
        ${s.notes ? `<div class="tiny muted">${esc(s.notes)}</div>` : ''}${s.effects ? `<div class="tiny">${tag('observation')} ${esc(s.effects)}</div>` : ''}</div><span class="chev">›</span></button>`;
    }
    h += `</div><div class="section-title"><h2>Lab results</h2><button class="btn-sm" data-act="lab">+ Add</button></div>`;
    h += state.labs.length ? `<div class="card tight"><table class="simple">${[...state.labs].sort((a, b) => (a.date < b.date ? 1 : -1)).map((l) => `<tr><td class="nowrap">${fmtDate(l.date)}</td><td><b>${esc(l.test)}</b>: ${esc(l.result)}${l.note ? `<div class="tiny muted">${esc(l.note)}</div>` : ''}</td><td class="act"><button class="btn-sm" data-act="dellab" data-id="${l.id}">✕</button></td></tr>`).join('')}</table></div>`
      : `<div class="card tight small muted">Reported: liver/kidney labs roughly every 4 months, normal at the time ${tag('unknown', 'no values stored')}. Add results here if you like.</div>`;
    return h;
  },
  changes: {
    take(el) {
      const d = isoDate();
      state.suppIntake = state.suppIntake.filter((x) => !(x.date === d && x.suppId === el.dataset.id));
      if (el.checked) state.suppIntake.push({ date: d, suppId: el.dataset.id, ts: new Date().toISOString() });
      save();
    },
  },
  actions: {
    edit(el) {
      const isNew = !el.dataset.id;
      const s = isNew ? { id: uid('sup'), name: '', brand: '', form: '', dose: null, unit: 'mg', timing: 'Morning', status: 'taking', days: 'daily', startDate: isoDate(), stopDate: null, reminder: '', effects: '', sideEffects: '', medicalNotes: '', notes: '' } : state.supplements.find((x) => x.id === el.dataset.id);
      const f = (id, label, v, extra = '') => `<label>${label}</label><input id="${id}" value="${esc(v ?? '')}" ${extra}>`;
      openSheet(`<h2>${isNew ? 'Add supplement' : esc(s.name)}</h2>
        ${f('s-name', 'Name', s.name)}<div class="grid2"><div>${f('s-brand', 'Brand / product', s.brand)}</div><div>${f('s-form', 'Formulation', s.form)}</div>
        <div>${f('s-dose', 'Dose', s.dose, 'inputmode="decimal"')}</div><div>${f('s-unit', 'Unit', s.unit)}</div><div>${f('s-timing', 'Timing', s.timing)}</div>
        <div><label>Days</label><select id="s-days"><option value="daily" ${s.days === 'daily' ? 'selected' : ''}>Daily</option><option value="mon-fri" ${s.days === 'mon-fri' ? 'selected' : ''}>Mon–Fri</option></select></div>
        <div><label>Status</label><select id="s-status">${Object.entries(STATUS).map(([k, l]) => `<option value="${k}" ${s.status === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div><div>${f('s-rem', 'Reminder time', s.reminder, 'type="time"')}</div>
        <div>${f('s-start', 'Start date', s.startDate, 'type="date"')}</div><div>${f('s-stop', 'Stop date', s.stopDate, 'type="date"')}</div></div>
        <label>Self-reported effects ${tag('observation')}</label><textarea id="s-eff">${esc(s.effects)}</textarea>
        <label>Side effects</label><textarea id="s-side">${esc(s.sideEffects)}</textarea>
        <label>Medical advice notes</label><textarea id="s-med">${esc(s.medicalNotes)}</textarea>
        <label>Other notes</label><textarea id="s-notes">${esc(s.notes || '')}</textarea>
        <p class="tiny muted">Your observations are recorded as observations, not evidence of effect.</p>
        <div class="grid2" style="margin-top:10px">${isNew ? '<button data-close>Cancel</button>' : '<button class="btn-danger" id="s-del">Delete</button>'}<button class="btn-primary" id="s-ok">Save</button></div>`, (r, close) => {
        const g = (id) => r.querySelector('#' + id).value;
        r.querySelector('#s-ok').onclick = () => {
          if (!g('s-name').trim()) return toast('Enter a name');
          Object.assign(s, { name: g('s-name').trim(), brand: g('s-brand'), form: g('s-form'), dose: numOrNull(g('s-dose')), unit: g('s-unit'), timing: g('s-timing'), days: g('s-days'), status: g('s-status'), reminder: g('s-rem'), startDate: g('s-start') || null, stopDate: g('s-stop') || null, effects: g('s-eff'), sideEffects: g('s-side'), medicalNotes: g('s-med'), notes: g('s-notes'), confirmed: g('s-status') === 'taking' });
          if (isNew) state.supplements.push(s);
          save(); close(); go(location.hash);
        };
        r.querySelector('#s-del')?.addEventListener('click', async () => { close(); if (await confirmBox(`Delete ${s.name}?`, 'Delete', true)) { state.supplements = state.supplements.filter((x) => x.id !== s.id); save(); go(location.hash); } });
      });
    },
    lab() {
      openSheet(`<h2>Lab result</h2><label>Date</label><input type="date" id="l-d" value="${isoDate()}"><label>Test</label><input id="l-t" placeholder="e.g. ALT, creatinine"><label>Result</label><input id="l-r" placeholder="value + unit + reference range"><label>Note</label><input id="l-n">
        <button class="btn-primary btn-block" style="margin-top:10px" id="l-ok">Save</button>`, (r, close) => {
        r.querySelector('#l-ok').onclick = () => { state.labs.push({ id: uid('lab'), date: r.querySelector('#l-d').value, test: r.querySelector('#l-t').value, result: r.querySelector('#l-r').value, note: r.querySelector('#l-n').value }); save(); close(); go(location.hash); };
      });
    },
    dellab(el) { state.labs = state.labs.filter((l) => l.id !== el.dataset.id); save(); go(location.hash); },
  },
};
