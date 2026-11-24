// Small shared helpers (no dependencies)

export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const uid = (p = 'id') => p + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

export const pad2 = (n) => String(n).padStart(2, '0');

/** Local date string YYYY-MM-DD */
export function isoDate(d = new Date()) {
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
}

export function parseISO(s) {
  const [y, m, d] = String(s).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function addDays(iso, n) {
  const d = parseISO(iso);
  d.setDate(d.getDate() + n);
  return isoDate(d);
}

export function daysBetween(a, b) {
  return Math.round((parseISO(b) - parseISO(a)) / 86400000);
}

export const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
export const DAY_NAMES = { mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday', sun: 'Sunday' };
export const DAY_ORDER = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

export function dayKey(iso) {
  return DAY_KEYS[parseISO(iso).getDay()];
}

/** Monday of the ISO week containing the date */
export function weekStart(iso) {
  const d = parseISO(iso);
  const wd = (d.getDay() + 6) % 7; // Mon=0
  d.setDate(d.getDate() - wd);
  return isoDate(d);
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function fmtDate(iso, withYear = false) {
  if (!iso) return 'date unknown';
  const d = parseISO(iso);
  const wd = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()];
  return `${wd} ${d.getDate()} ${MONTHS[d.getMonth()]}${withYear ? ' ' + d.getFullYear() : ''}`;
}
export function fmtShort(iso) {
  if (!iso) return '?';
  const d = parseISO(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export function fmtNum(n, dec = 0) {
  if (n == null || Number.isNaN(n)) return '—';
  return Number(n).toLocaleString('en-US', { maximumFractionDigits: dec, minimumFractionDigits: 0 }).replace(/,/g, '’');
}

/** kg formatting: 7950 -> 7’950 kg (Swiss thousands separator) */
export const fmtKg = (n) => (n == null ? '—' : fmtNum(n, 1) + ' kg');

/** seconds -> m:ss or h:mm:ss */
export function fmtDur(sec) {
  if (sec == null) return '—';
  sec = Math.round(sec);
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return h ? `${h}:${pad2(m)}:${pad2(s)}` : `${m}:${pad2(s)}`;
}

/** "44:09" or "1:00:01" or "45" (minutes) -> seconds */
export function parseDur(str) {
  if (str == null || str === '') return null;
  const parts = String(str).trim().split(':').map(Number);
  if (parts.some(Number.isNaN)) return null;
  if (parts.length === 1) return parts[0] * 60;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0] * 3600 + parts[1] * 60 + parts[2];
}

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export const numOrNull = (v) => {
  if (v === '' || v == null) return null;
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

export function deepClone(o) {
  return JSON.parse(JSON.stringify(o));
}

/** Value-status tags used everywhere: actual / target / estimate / unknown / suggestion */
export function tag(kind, text) {
  const label = text || { actual: 'Actual', target: 'Planned target', estimate: 'Estimate', unknown: 'Unknown', suggestion: 'Suggestion', schematic: 'Schematic', imported: 'Imported log', observation: 'Your observation' }[kind] || kind;
  return `<span class="tag tag-${kind}">${esc(label)}</span>`;
}

export function download(filename, text, mime = 'application/json') {
  const blob = new Blob([text], { type: mime });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}

export function csvEscape(v) {
  if (v == null) return '';
  const s = String(v);
  return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

export function toCSV(rows, cols) {
  return [cols.join(','), ...rows.map((r) => cols.map((c) => csvEscape(r[c])).join(','))].join('\n');
}

export function parseCSV(text) {
  const rows = [];
  let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cur += '"'; i++; }
      else if (c === '"') q = false;
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cur); cur = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cur); rows.push(row); row = []; cur = '';
    } else cur += c;
  }
  if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
  const [head, ...rest] = rows.filter((r) => r.length && r.some((x) => x !== ''));
  if (!head) return [];
  return rest.map((r) => Object.fromEntries(head.map((h, i) => [h.trim(), r[i] ?? ''])));
}
