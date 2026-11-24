// Original front/back muscle map. Primary muscles bright, secondary muscles faded.
const BASE = '#2d3644', OFF = '#3d4757', ON = '#ff8a3d';

const E = (cx, cy, rx, ry) => ({ t: 'e', cx, cy, rx, ry });
const R = (x, y, w, h, r = 5) => ({ t: 'r', x, y, w, h, r });
const P = (pts) => ({ t: 'p', pts });

const REGIONS = {
  // front (centre x=55)
  front_delts: [E(37, 45, 7, 8), E(73, 45, 7, 8)],
  side_delts: [E(28, 48, 4.5, 8), E(82, 48, 4.5, 8), E(137, 48, 4.5, 8), E(193, 48, 4.5, 8)],
  chest: [R(40, 41, 14, 19, 6), R(56, 41, 14, 19, 6)],
  upper_chest: [R(41, 40, 13, 7, 4), R(56, 40, 13, 7, 4)],
  biceps: [E(28, 67, 5, 11), E(82, 67, 5, 11)],
  forearms: [E(24, 93, 4.5, 12), E(86, 93, 4.5, 12), E(134, 93, 4.5, 12), E(196, 93, 4.5, 12)],
  abs: [R(48, 63, 14, 36, 5)],
  obliques: [E(42, 80, 4, 13), E(68, 80, 4, 13)],
  quads: [E(46, 138, 8, 24), E(64, 138, 8, 24)],
  hip_abductors: [E(37, 110, 4, 9), E(73, 110, 4, 9), E(145, 106, 4, 9), E(185, 106, 4, 9)],
  calves: [E(45, 186, 4.5, 13), E(65, 186, 4.5, 13), E(156, 184, 6, 15), E(174, 184, 6, 15)],
  // back (centre x=165)
  traps: [P([[165, 30], [148, 41], [165, 48], [182, 41]])],
  rear_delts: [E(145, 46, 7, 7), E(185, 46, 7, 7)],
  triceps: [E(138, 67, 5, 11), E(192, 67, 5, 11)],
  mid_back: [R(156, 48, 18, 20, 5)],
  lats: [E(150, 74, 7, 17), E(180, 74, 7, 17)],
  lower_back: [R(158, 82, 14, 17, 5)],
  glutes: [E(157, 112, 9, 10), E(173, 112, 9, 10)],
  hamstrings: [E(156, 142, 7, 21), E(174, 142, 7, 21)],
};

function body(cx) {
  const s = `stroke="${BASE}" stroke-linecap="round" stroke-linejoin="round"`;
  return `<circle cx="${cx}" cy="18" r="11" fill="${BASE}"/>
  <line x1="${cx}" y1="26" x2="${cx}" y2="36" ${s} stroke-width="10"/>
  <polygon points="${cx - 22},38 ${cx + 22},38 ${cx + 15},100 ${cx + 17},118 ${cx - 17},118 ${cx - 15},100" fill="${BASE}" ${s} stroke-width="10"/>
  <polyline points="${cx - 25},42 ${cx - 28},70 ${cx - 31},106" fill="none" ${s} stroke-width="13"/>
  <polyline points="${cx + 25},42 ${cx + 28},70 ${cx + 31},106" fill="none" ${s} stroke-width="13"/>
  <polyline points="${cx - 9},116 ${cx - 10},162 ${cx - 10},206" fill="none" ${s} stroke-width="17"/>
  <polyline points="${cx + 9},116 ${cx + 10},162 ${cx + 10},206" fill="none" ${s} stroke-width="17"/>`;
}

function shape(sh, fill, op) {
  const a = `fill="${fill}" opacity="${op}"`;
  if (sh.t === 'e') return `<ellipse cx="${sh.cx}" cy="${sh.cy}" rx="${sh.rx}" ry="${sh.ry}" ${a}/>`;
  if (sh.t === 'r') return `<rect x="${sh.x}" y="${sh.y}" width="${sh.w}" height="${sh.h}" rx="${sh.r}" ${a}/>`;
  return `<polygon points="${sh.pts.map((p) => p.join(',')).join(' ')}" ${a}/>`;
}

export function muscleMap(primary = [], secondary = []) {
  let regions = '';
  for (const [id, shapes] of Object.entries(REGIONS)) {
    const on = primary.includes(id) ? 1 : secondary.includes(id) ? 0.45 : 0;
    regions += shapes.map((s) => shape(s, on ? ON : OFF, on || 1)).join('');
  }
  return `<div class="muscle-map"><svg viewBox="0 0 220 222" role="img" aria-label="Muscle map: primary muscles bright, secondary faded">
    ${body(55)}${body(165)}${regions}
    <text x="55" y="219" text-anchor="middle" class="fig-label">front</text><text x="165" y="219" text-anchor="middle" class="fig-label">back</text>
  </svg><div class="legend"><span><i style="background:${ON}"></i>Primary</span><span><i style="background:${ON};opacity:.45"></i>Secondary</span></div></div>`;
}
