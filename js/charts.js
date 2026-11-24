// Tiny hand-written SVG charts (no dependencies, works offline).
import { esc, fmtNum } from './util.js';

/**
 * Line / dot chart. series: [{ name, color, points: [{ x: label, y: number|null, est?: bool }] }]
 * All series share the x labels of the first series.
 */
export function lineChart(series, { height = 180, unit = '', yMin = null, yMax = null, dashedEstimates = true } = {}) {
  const W = 340, H = height, pl = 38, pr = 22, pt = 12, pb = 26;
  const labels = series[0]?.points.map((p) => p.x) || [];
  const ys = series.flatMap((s) => s.points.map((p) => p.y)).filter((v) => v != null);
  if (!labels.length || !ys.length) return `<div class="empty small">No data yet for this chart.</div>`;
  let lo = yMin ?? Math.min(...ys), hi = Math.max(...ys);
  if (lo === hi) { lo -= 1; hi += 1; }
  const padv = (hi - lo) * 0.12; lo -= padv; hi += padv;
  if (yMin != null) lo = yMin;
  if (yMax != null) hi = Math.max(yMax, hi - padv);
  const n = labels.length;
  const X = (i) => pl + (n === 1 ? (W - pl - pr) / 2 : (i * (W - pl - pr)) / (n - 1));
  const Y = (v) => pt + (1 - (v - lo) / (hi - lo)) * (H - pt - pb);
  let g = '<g class="grid">';
  for (let k = 0; k <= 3; k++) {
    const v = lo + ((hi - lo) * k) / 3;
    g += `<line x1="${pl}" x2="${W - pr}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}"/><text x="${pl - 4}" y="${(Y(v) + 3).toFixed(1)}" text-anchor="end">${fmtNum(v, hi - lo < 10 ? 1 : 0)}</text>`;
  }
  g += '</g>';
  const step = Math.ceil(n / 6);
  const xl = labels.map((l, i) => (i % step === 0 || i === n - 1 ? `<text x="${X(i).toFixed(1)}" y="${H - 8}" text-anchor="middle">${esc(l)}</text>` : '')).join('');
  const lines = series.map((s) => {
    const pts = s.points.map((p, i) => (p.y == null ? null : [X(i), Y(p.y), p]));
    let d = '';
    let pen = false;
    for (const q of pts) { if (!q) { pen = false; continue; } d += (pen ? 'L' : 'M') + q[0].toFixed(1) + ' ' + q[1].toFixed(1); pen = true; }
    const dots = pts.filter(Boolean).map((q) => `<circle cx="${q[0].toFixed(1)}" cy="${q[1].toFixed(1)}" r="4" fill="${q[2].est && dashedEstimates ? 'none' : s.color}" stroke="${s.color}" stroke-width="2"><title>${esc(q[2].x)}: ${fmtNum(q[2].y, 1)} ${unit}${q[2].est ? ' (estimate)' : ''}</title></circle>`).join('');
    return `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="2.5" stroke-linejoin="round"/>${dots}`;
  }).join('');
  const legend = series.length > 1 ? `<div class="legend">${series.map((s) => `<span><i style="background:${s.color}"></i>${esc(s.name)}</span>`).join('')}</div>` : '';
  return `<svg class="chart" viewBox="0 0 ${W} ${H}">${g}${xl}${lines}</svg>${legend}`;
}

/** Vertical bar chart. bars: [{ x, y, color? }] */
export function barChart(bars, { height = 160, unit = '', target = null } = {}) {
  const W = 340, H = height, pl = 34, pr = 8, pt = 12, pb = 26;
  if (!bars.length) return `<div class="empty small">No data yet.</div>`;
  const hi = Math.max(1, target || 0, ...bars.map((b) => b.y || 0)) * 1.12;
  const bw = (W - pl - pr) / bars.length;
  const Y = (v) => pt + (1 - v / hi) * (H - pt - pb);
  let s = '<g class="grid">';
  for (let k = 0; k <= 3; k++) { const v = (hi * k) / 3; s += `<line x1="${pl}" x2="${W - pr}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}"/><text x="${pl - 4}" y="${(Y(v) + 3).toFixed(1)}" text-anchor="end">${fmtNum(v, hi < 10 ? 1 : 0)}</text>`; }
  s += '</g>';
  bars.forEach((b, i) => {
    const x = pl + i * bw + bw * 0.15, w = bw * 0.7, y = Y(b.y || 0);
    s += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${(H - pb - y).toFixed(1)}" rx="3" fill="${b.color || 'var(--accent)'}"><title>${esc(b.x)}: ${fmtNum(b.y, 1)} ${unit}</title></rect>`;
    if (bars.length <= 12) s += `<text x="${(x + w / 2).toFixed(1)}" y="${H - 8}" text-anchor="middle">${esc(b.x)}</text>`;
  });
  if (target) s += `<line x1="${pl}" x2="${W - pr}" y1="${Y(target).toFixed(1)}" y2="${Y(target).toFixed(1)}" stroke="var(--accent2)" stroke-dasharray="5 4" stroke-width="1.5"/>`;
  return `<svg class="chart" viewBox="0 0 ${W} ${H}">${s}</svg>`;
}

/** Horizontal bars (e.g. sets per muscle group). */
export function hBars(rows, { unit = '' } = {}) {
  if (!rows.length) return `<div class="empty small">No data in this period.</div>`;
  const max = Math.max(...rows.map((r) => r.value), 1);
  return `<div class="bars">${rows.map((r) => `<div class="bar"><span>${esc(r.label)}</span><div class="track"><div class="fill" style="width:${(100 * r.value) / max}%"></div></div><b class="right">${fmtNum(r.value, 1)}${unit}</b></div>`).join('')}</div>`;
}
