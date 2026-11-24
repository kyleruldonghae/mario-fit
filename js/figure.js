// Original animated schematic illustrations. A simple 2D figure (forward kinematics) on a
// simplified machine, looping start -> end -> start. All drawings are SCHEMATIC.

const L = { T: 50, NH: 16, HR: 10, UA: 28, FA: 26, TH: 40, SH: 38, FT: 13, SW: 17, HW: 9 };
const FLOOR = 188;
const C = { fig: '#d9dfea', far: '#7f8aa0', hi: '#ff8a3d', frame: '#5b6880', pad: '#36404f', padEdge: '#4b5668', handle: '#eef2f8', cable: '#aab3c3', stack: '#6b778c', floor: '#2b3240', path: '#3ddc97' };

const rad = (a) => (a * Math.PI) / 180;
const D = (a) => [Math.sin(rad(a)), Math.cos(rad(a))];
const add = (p, v, k = 1) => [p[0] + v[0] * k, p[1] + v[1] * k];
const lerp = (a, b, p) => a + (b - a) * p;
const f1 = (n) => Math.round(n * 10) / 10;

const ln = (a, b, w, c, extra = '') => `<line x1="${f1(a[0])}" y1="${f1(a[1])}" x2="${f1(b[0])}" y2="${f1(b[1])}" stroke="${c}" stroke-width="${w}" stroke-linecap="round" ${extra}/>`;
const circ = (p, r, c, extra = '') => `<circle cx="${f1(p[0])}" cy="${f1(p[1])}" r="${r}" fill="${c}" ${extra}/>`;
const rect = (x, y, w, h, c, rx = 3, extra = '') => `<rect x="${f1(x)}" y="${f1(y)}" width="${f1(w)}" height="${f1(h)}" rx="${rx}" fill="${c}" ${extra}/>`;
const poly = (pts, c, extra = '') => `<polygon points="${pts.map((p) => f1(p[0]) + ',' + f1(p[1])).join(' ')}" fill="${c}" ${extra}/>`;
const pathD = (pts) => 'M' + pts.map((p) => f1(p[0]) + ' ' + f1(p[1])).join(' L');

function stack(x, y, w, h, lift) {
  // weight-stack tower: frame + plates; top plates rise by `lift`
  let s = rect(x - 3, y - 6, w + 6, h + 6, 'none', 3, `stroke="${C.frame}" stroke-width="3"`);
  const n = 9, ph = (h - 4) / n;
  for (let i = 0; i < n; i++) {
    const up = i < 3 ? lift : 0;
    s += rect(x, y + 2 + i * ph - up, w, ph - 2, i < 3 ? '#8794aa' : C.stack, 1.5);
  }
  s += ln([x + w / 2, y - 14 - lift], [x + w / 2, y + 2 + 3 * ph - lift], 2, C.cable);
  return s;
}
const floor = () => rect(6, FLOOR, 228, 6, C.floor, 2);

// ---------- figure ----------
function joints(P, view) {
  const H = [P.hx, P.hy];
  const S = add(H, D(P.t), L.T);
  const head = add(S, D(P.t + (P.hd || 0)), L.NH);
  const arm = (sh, ua, fa, us, fs, m) => {
    const d1 = D(ua), d2 = D(fa);
    const el = [sh[0] + m * d1[0] * L.UA * us, sh[1] + d1[1] * L.UA * us];
    const ha = [el[0] + m * d2[0] * L.FA * fs, el[1] + d2[1] * L.FA * fs];
    return { sh, el, ha, m };
  };
  const leg = (hp, th, sh, ft, ts, fts, m) => {
    const d1 = D(th), d2 = D(sh), d3 = D(ft);
    const kn = [hp[0] + m * d1[0] * L.TH * ts, hp[1] + d1[1] * L.TH * ts];
    const an = [kn[0] + m * d2[0] * L.SH, kn[1] + d2[1] * L.SH];
    const toe = [an[0] + m * d3[0] * L.FT * fts, an[1] + d3[1] * L.FT * fts];
    return { hp, kn, an, toe, m };
  };
  const us = P.us ?? 1, fs = P.fs ?? 1, ts = P.ts ?? 1, fts = P.fts ?? 1;
  if (view === 'side') {
    return {
      H, S, head, view,
      armN: arm(S, P.ua, P.fa, us, fs, 1), armF: arm(S, P.ua2 ?? P.ua, P.fa2 ?? P.fa, P.us2 ?? us, P.fs2 ?? fs, 1),
      legN: leg(H, P.th, P.sh, P.ft, ts, fts, 1), legF: leg(H, P.th2 ?? P.th, P.sh2 ?? P.sh, P.ft2 ?? P.ft, ts, fts, 1),
      fwd: D(P.t - 90), t: P.t,
    };
  }
  const SR = [S[0] + L.SW, S[1]], SL = [S[0] - L.SW, S[1]];
  const HR = [H[0] + L.HW, H[1]], HL = [H[0] - L.HW, H[1]];
  return {
    H, S, head, view,
    armR: arm(SR, P.ua, P.fa, us, fs, 1), armL: arm(SL, P.ua, P.fa, us, fs, -1),
    legR: leg(HR, P.th, P.sh, P.ft, ts, fts, 1), legL: leg(HL, P.th, P.sh, P.ft, ts, fts, -1),
    SR, SL, HR, HL, t: P.t,
  };
}

function drawArm(a, col, hi) {
  return ln(a.sh, a.el, 9, hi.includes('ua') ? C.hi : col) + ln(a.el, a.ha, 8, hi.includes('fa') ? C.hi : col);
}
function drawLeg(l, col, hi) {
  return ln(l.hp, l.kn, 13, hi.includes('th') ? C.hi : col) + ln(l.kn, l.an, 10, hi.includes('sh') ? C.hi : col) + ln(l.an, l.toe, 7, col);
}

function markers(J, hi) {
  let s = '';
  const H = J.H, S = J.S;
  const along = (k) => [S[0] + (H[0] - S[0]) * k, S[1] + (H[1] - S[1]) * k];
  if (J.view === 'side') {
    const rot = 180 - J.t;
    const m = (k, off, rx, ry) => { const c = add(along(k), J.fwd, off); return `<ellipse cx="${f1(c[0])}" cy="${f1(c[1])}" rx="${rx}" ry="${ry}" fill="${C.hi}" transform="rotate(${f1(-rot)} ${f1(c[0])} ${f1(c[1])})"/>`; };
    if (hi.includes('chest')) s += m(0.24, 4.5, 4.5, 9);
    if (hi.includes('abs')) s += m(0.62, 4.5, 4.5, 10);
    if (hi.includes('back')) s += m(0.32, -4.5, 4.5, 12);
    if (hi.includes('glutes')) s += circ(add(H, J.fwd, -5), 6, C.hi);
    if (hi.includes('delts')) s += circ(S, 6.5, C.hi);
  } else {
    const e = (c, rx, ry) => `<ellipse cx="${f1(c[0])}" cy="${f1(c[1])}" rx="${rx}" ry="${ry}" fill="${C.hi}"/>`;
    if (hi.includes('chest')) s += e([S[0] - 8, S[1] + 11], 8, 6) + e([S[0] + 8, S[1] + 11], 8, 6);
    if (hi.includes('abs')) s += rect(S[0] - 7, S[1] + 22, 14, 22, C.hi, 5);
    if (hi.includes('lats')) s += e([S[0] - 11, S[1] + 22], 5.5, 13) + e([S[0] + 11, S[1] + 22], 5.5, 13);
    if (hi.includes('upperback')) s += e([S[0], S[1] + 9], 13, 6);
    if (hi.includes('delts')) s += circ(J.SR, 6.5, C.hi) + circ(J.SL, 6.5, C.hi);
    if (hi.includes('hips')) s += circ([J.HR[0] + 4, J.HR[1] - 3], 5.5, C.hi) + circ([J.HL[0] - 4, J.HL[1] - 3], 5.5, C.hi);
  }
  return s;
}

function drawFigure(J, hi, layers) {
  let s = layers.back || '';
  if (J.view === 'side') {
    s += drawLeg(J.legF, C.far, hi) + drawArm(J.armF, C.far, hi);
    s += ln(J.H, J.S, 20, C.fig) + ln(J.S, J.head, 7, C.fig) + circ(J.head, L.HR, C.fig);
    s += markers(J, hi);
    s += layers.mid || '';
    s += drawLeg(J.legN, C.fig, hi) + drawArm(J.armN, C.fig, hi);
    s += layers.front || '';
    s += circ(J.armN.ha, 4.5, C.fig);
  } else {
    s += drawLeg(J.legL, C.fig, hi) + drawLeg(J.legR, C.fig, hi);
    const S = J.S, H = J.H;
    const torso = [J.SL, J.SR, [H[0] + L.HW + 3, H[1] - 20], [H[0] + L.HW + 2, H[1] + 4], [H[0] - L.HW - 2, H[1] + 4], [H[0] - L.HW - 3, H[1] - 20]];
    s += poly(torso, C.fig, `stroke="${C.fig}" stroke-width="8" stroke-linejoin="round"`);
    s += ln(S, J.head, 8, C.fig) + circ(J.head, L.HR, C.fig);
    s += markers(J, hi);
    s += layers.mid || '';
    s += drawArm(J.armL, C.fig, hi) + drawArm(J.armR, C.fig, hi);
    s += layers.front || '';
    s += circ(J.armL.ha, 4.5, C.fig) + circ(J.armR.ha, 4.5, C.fig);
  }
  return s;
}

// ---------- helpers for machines ----------
const SB = { hx: 95, hy: 150, t: 180, th: 90, sh: 0, ft: 90, ua: 10, fa: 20 }; // seated, side view
const FB = { hx: 120, hy: 140, t: 180, th: 8, ts: 0.28, sh: 2, ft: 90, fts: 0.35, ua: 12, fa: 15 }; // seated, front view

function backPadSide(J, off = 15, ext = 10, len = 1) {
  const back = [-J.fwd[0], -J.fwd[1]];
  const up = D(J.t);
  const a = add(J.H, back, off), b = add(add(J.H, up, L.T * len + ext), back, off);
  return ln(a, b, 9, C.pad);
}
function seatSide(x1, x2, y, postX) {
  return rect(x1, y, x2 - x1, 9, C.pad, 4) + ln([postX, y + 9], [postX, FLOOR], 6, C.frame) + ln([postX - 18, FLOOR - 1], [postX + 18, FLOOR - 1], 5, C.frame);
}
function seatFront(y = 142) {
  return rect(92, y, 56, 9, C.pad, 4) + ln([120, y + 9], [120, FLOOR], 6, C.frame);
}
function backPadFront(top = 40, bottom = 142) { return rect(97, top, 46, bottom - top, C.pad, 8); }
function grip(p, dir = 'v', len = 8) {
  return dir === 'v' ? ln([p[0], p[1] - len], [p[0], p[1] + len], 6, C.handle) : ln([p[0] - len, p[1]], [p[0] + len, p[1]], 6, C.handle);
}
function sampleHand(def, which, n = 18) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const J = joints(interp(def, i / n), def.view);
    const a = which === 'L' ? J.armL : which === 'R' ? J.armR : J.armN;
    pts.push(a.ha);
  }
  return pts;
}
function interp(def, p) {
  const A = def.A, B = { ...def.A, ...def.B };
  const o = {};
  for (const k of Object.keys(A)) o[k] = typeof A[k] === 'number' && typeof B[k] === 'number' ? lerp(A[k], B[k], p) : A[k];
  for (const k of Object.keys(B)) if (!(k in o)) o[k] = B[k];
  if (def.arc) Object.assign(o, solveArc(o, def.arc, p));
  return o;
}

// Two-link inverse kinematics: the (right) hand follows a circular arc; elbow bends outward.
function solveArc(P, arc, p) {
  const a = lerp(arc.a0, arc.a1, p);
  const h = add(arc.c, D(a), arc.r);
  const S = add([P.hx, P.hy], D(P.t), L.T);
  const sh = [S[0] + L.SW, S[1]];
  const dx = h[0] - sh[0], dy = h[1] - sh[1];
  const d = Math.min(Math.hypot(dx, dy), L.UA + L.FA - 0.5);
  const th = (Math.atan2(dx, dy) * 180) / Math.PI;
  const al = (Math.acos((L.UA * L.UA + d * d - L.FA * L.FA) / (2 * L.UA * d)) * 180) / Math.PI;
  const cands = [th + al, th - al].map((ua) => ({ ua, el: add(sh, D(ua), L.UA) }));
  const best = cands[0].el[0] >= cands[1].el[0] ? cands[0] : cands[1];
  const fa = (Math.atan2(h[0] - best.el[0], h[1] - best.el[1]) * 180) / Math.PI;
  return { ua: best.ua, fa, us: 1, fs: 1 };
}
const pathCache = new Map();
function handPath(id, def, which) {
  const key = id + which;
  if (!pathCache.has(key)) pathCache.set(key, sampleHand(def, which));
  return pathCache.get(key);
}
function dottedPath(pts) {
  return `<path d="${pathD(pts)}" fill="none" stroke="${C.path}" stroke-width="2" stroke-dasharray="2 4" stroke-linecap="round" opacity=".85"/>`;
}

// ---------- exercise definitions ----------
export const DEFS = {
  chest_press: {
    view: 'side', period: 3.2, hi: ['chest', 'ua'],
    A: { ...SB, ua: -45, us: 0.6, fa: 80 }, B: { ua: 78, us: 1, fa: 85 },
    draw(J, p) {
      const piv = [110, 25];
      return {
        back: floor() + ln([62, FLOOR], [62, 20], 7, C.frame) + ln([62, 20], [120, 20], 7, C.frame) + seatSide(70, 122, 152, 95) + rect(70, 92, 12, 60, C.pad, 5)
          + stack(18, 110, 28, 76, p * 16) + ln([32, 96 - p * 16], [32, 20], 2, C.cable) + ln([32, 20], [62, 20], 2, C.cable),
        front: ln(piv, J.armN.ha, 6, C.frame) + circ(piv, 5, C.frame) + grip(J.armN.ha),
      };
    },
  },
  incline_press: {
    view: 'side', period: 3.2, hi: ['chest', 'ua'],
    A: { ...SB, hx: 100, t: 200, ua: -20, us: 0.7, fa: 128 }, B: { ua: 125, us: 1, fa: 125 },
    draw(J, p, id, def) {
      const pts = handPath(id, def, 'N');
      const a = pts[0], b = pts[pts.length >> 1];
      const dx = b[0] - a[0], dy = b[1] - a[1];
      const r1 = [a[0] - dx * 0.25, a[1] - dy * 0.25], r2 = [b[0] + dx * 0.3, b[1] + dy * 0.3];
      return {
        back: floor() + seatSide(74, 124, 152, 100) + backPadSide(J, 15, 8) + ln(r2, [170, r2[1]], 6, C.frame) + ln([170, r2[1]], [170, FLOOR], 7, C.frame)
          + stack(182, 108, 28, 78, p * 16),
        mid: ln(r1, r2, 5, C.frame),
        front: grip(J.armN.ha, 'v', 7) + rect(J.armN.ha[0] - 6, J.armN.ha[1] - 4, 12, 8, C.frame, 2),
      };
    },
  },
  butterfly: {
    view: 'front', period: 3.2, hi: ['chest'],
    A: { ...FB, ua: 90, us: 1, fa: 180 }, B: { ua: 90, us: 0.3, fa: 219 },
    draw(J) {
      const pad = (a) => ln(a.el, add(a.ha, D(a.m > 0 ? 180 : 180), 4), 11, C.padEdge);
      return {
        back: floor() + ln([52, FLOOR], [52, 26], 7, C.frame) + ln([188, FLOOR], [188, 26], 7, C.frame) + ln([52, 26], [188, 26], 7, C.frame) + backPadFront(40) + seatFront(),
        mid: ln([137, 30], J.armR.ha, 5, C.frame) + ln([103, 30], J.armL.ha, 5, C.frame) + pad(J.armR) + pad(J.armL),
      };
    },
  },
  crossover: {
    view: 'front', period: 3.4, hi: ['chest', 'delts'],
    // seated: handles start high & wide and travel DOWN and inward along curved arcs
    arc: { c: [119, 58], r: 60, a0: 92, a1: 4 },
    A: { ...FB }, B: {},
    draw(J, p, id, def) {
      const R = handPath(id, def, 'R'), Lp = handPath(id, def, 'L');
      const rail = (pts) => `<path d="${pathD(pts)}" fill="none" stroke="${C.frame}" stroke-width="7" stroke-linecap="round" opacity=".55"/>`;
      const r0 = R[0], l0 = Lp[0], rm = R[R.length >> 1], lm = Lp[Lp.length >> 1];
      const arrow = (pts) => { const a = pts[pts.length - 3], b = pts[pts.length - 1]; const ang = Math.atan2(b[0] - a[0], b[1] - a[1]) * 180 / Math.PI; return poly([add(b, D(ang), 5), add(b, D(ang + 140), 6), add(b, D(ang - 140), 6)], C.path); };
      return {
        back: floor() + ln([46, FLOOR], [46, 24], 8, C.frame) + ln([194, FLOOR], [194, 24], 8, C.frame) + ln([46, 24], [194, 24], 6, C.frame) + backPadFront(36) + seatFront()
          + ln([194, r0[1]], r0, 5, C.frame) + ln([46, l0[1]], l0, 5, C.frame) + ln([194, rm[1]], rm, 5, C.frame) + ln([46, lm[1]], lm, 5, C.frame),
        mid: rail(R) + rail(Lp) + dottedPath(R) + dottedPath(Lp) + arrow(R) + arrow(Lp),
        front: grip(J.armR.ha, 'v', 7) + grip(J.armL.ha, 'v', 7),
      };
    },
  },
  lateral_raise: {
    view: 'front', period: 3, hi: ['delts', 'ua'],
    A: { ...FB, ua: 12, fa: 15, fs: 0.55 }, B: { ua: 88, fa: 95 },
    draw(J) {
      const lever = (a) => {
        const d = [a.el[0] - a.sh[0], a.el[1] - a.sh[1]], n = Math.hypot(...d), u = [d[0] / n, d[1] / n];
        const o = a.m > 0 ? [u[1], -u[0]] : [-u[1], u[0]]; // outward side of the upper arm
        return ln(add(a.sh, u, -4), add(a.el, u, 6), 4, C.frame) + ln(add(add(a.el, u, -14), o, 8), add(add(a.el, u, 2), o, 8), 10, C.padEdge);
      };
      return {
        back: floor() + backPadFront(46) + seatFront() + ln([60, FLOOR], [60, 80], 7, C.frame) + ln([180, FLOOR], [180, 80], 7, C.frame) + ln([60, 80], [96, 88], 6, C.frame) + ln([180, 80], [144, 88], 6, C.frame),
        front: lever(J.armR) + lever(J.armL),
      };
    },
  },
  db_press: {
    view: 'front', period: 3, hi: ['delts'],
    A: { ...FB, ua: 90, fa: 180 }, B: { ua: 160, fa: 172 },
    draw(J) {
      const db = (h) => ln([h[0] - 10, h[1]], [h[0] + 10, h[1]], 3, C.handle) + rect(h[0] - 14, h[1] - 7, 5, 14, '#9aa5b8', 1.5) + rect(h[0] + 9, h[1] - 7, 5, 14, '#9aa5b8', 1.5);
      return { back: floor() + backPadFront(28) + seatFront(), front: db(J.armR.ha) + db(J.armL.ha) };
    },
  },
  pushdown: {
    view: 'side', period: 2.8, hi: ['ua'],
    A: { hx: 110, hy: 110, t: 172, ua: 8, fa: 150, th: 6, sh: -4, ft: 90, th2: -4, sh2: -2, ft2: 90 }, B: { fa: 10 },
    draw(J, p) {
      const pul = [156, 18];
      return {
        back: floor() + rect(150, 10, 28, 178, 'none', 3, `stroke="${C.frame}" stroke-width="5"`) + circ(pul, 5, C.frame) + stack(154, 112, 20, 72, p * 14),
        front: ln(pul, J.armN.ha, 2, C.cable) + ln([J.armN.ha[0] - 9, J.armN.ha[1] + 2], [J.armN.ha[0] + 9, J.armN.ha[1] - 2], 5, C.handle),
      };
    },
  },
  pulldown: {
    view: 'front', period: 3.2, hi: ['lats'],
    A: { ...FB, ua: 165, fa: 172 }, B: { ua: 40, fa: 190 },
    draw(J, p) {
      const y = (J.armR.ha[1] + J.armL.ha[1]) / 2;
      const bar = [[J.armL.ha[0] - 16, y + 5], [J.armL.ha[0], y], [J.armR.ha[0], y], [J.armR.ha[0] + 16, y + 5]];
      return {
        back: floor() + rect(113, 10, 14, 178, C.frame, 3) + ln([60, 10], [214, 10], 6, C.frame) + circ([120, 13], 5, C.cable) + circ([210, 13], 5, C.cable)
          + ln([120, 13], [210, 13], 2, C.cable) + stack(197, 104, 26, 80, p * 16) + seatFront(),
        mid: rect(96, 136, 48, 9, C.padEdge, 4),
        front: ln([120, 13], [120, y], 2, C.cable) + `<path d="${pathD(bar)}" fill="none" stroke="${C.handle}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>`,
      };
    },
  },
  row: {
    view: 'side', period: 3.2, hi: ['back', 'ua'],
    A: { ...SB, ua: 80, fa: 82, th: 95, sh: 30, ft: 160 }, B: { ua: -55, us: 0.9, fa: 88 },
    draw(J, p) {
      const piv = [115, 48];
      return {
        back: floor() + seatSide(70, 120, 152, 95) + ln([60, 40], [175, 40], 7, C.frame) + ln([175, 40], [175, FLOOR], 7, C.frame) + rect(108, 100, 10, 36, C.pad, 5) + ln([113, 136], [113, 160], 5, C.frame)
          + ln([158, 192], [168, 160], 6, C.frame) + stack(190, 104, 26, 80, p * 16),
        front: ln(piv, J.armN.ha, 6, C.frame) + circ(piv, 5, C.frame) + grip(J.armN.ha),
      };
    },
  },
  reverse_fly: {
    view: 'back', period: 3, hi: ['delts', 'upperback'],
    A: { ...FB, ua: 90, us: 0.25, fa: 90, fs: 0.25 }, B: { ua: 90, us: 1, fa: 92, fs: 1 },
    draw(J) {
      return {
        back: floor() + ln([52, FLOOR], [52, 26], 7, C.frame) + ln([188, FLOOR], [188, 26], 7, C.frame) + ln([52, 26], [188, 26], 7, C.frame) + rect(102, 82, 36, 60, C.pad, 6) + seatFront(),
        front: ln([137, 30], J.armR.ha, 5, C.frame) + ln([103, 30], J.armL.ha, 5, C.frame) + grip(J.armR.ha, 'v', 7) + grip(J.armL.ha, 'v', 7),
      };
    },
  },
  curl: {
    view: 'side', period: 2.8, hi: ['ua'],
    A: { ...SB, t: 172, ua: 55, fa: 75 }, B: { fa: 200 },
    draw(J, p) {
      const a = J.armN;
      const pa = add(a.sh, [6, 12]), pb = add(a.el, [3, 9]);
      return {
        back: floor() + seatSide(70, 120, 152, 95) + ln([125, 125], [140, FLOOR], 6, C.frame) + stack(188, 104, 26, 80, p * 14) + ln([168, 60], [168, FLOOR], 7, C.frame),
        mid: ln(pa, pb, 11, C.padEdge),
        front: ln(a.el, a.ha, 4, C.frame) + circ(a.el, 5, C.frame) + grip(a.ha, 'h', 7),
      };
    },
  },
  leg_curl: {
    view: 'side', period: 3, hi: ['th'],
    A: { ...SB, hy: 128, t: 190, ua: 20, fa: 40, th: 90, sh: 88, ft: 170 }, B: { sh: -5, ft: 85 },
    draw(J, p) {
      const l = J.legN;
      const shinAng = (Math.atan2(l.an[0] - l.kn[0], l.an[1] - l.kn[1]) * 180) / Math.PI;
      const roll = add(l.an, D(shinAng - 90), 9); // roller sits behind the heel
      return {
        back: floor() + seatSide(66, 122, 130, 95) + backPadSide(J, 15, 6) + stack(196, 104, 26, 80, p * 14),
        front: ln(l.kn, roll, 5, C.frame) + circ(l.kn, 5, C.frame) + circ(roll, 7, C.padEdge) + rect(110, 105, 34, 11, C.padEdge, 5) + ln([144, 110], [170, 110], 5, C.frame) + ln([170, 110], [170, FLOOR], 6, C.frame),
      };
    },
  },
  leg_press: {
    view: 'side', period: 3.4, hi: ['th'],
    A: { hx: 80, hy: 140, t: 215, ua: 30, fa: 60, th: 145, sh: 55, ft: 172 }, B: { th: 100, sh: 100 },
    draw(J) {
      const an = J.legN.an;
      const pf = add(an, D(100), 5);
      return {
        back: floor() + ln([30, 168], [214, 168], 7, C.frame) + ln([40, 168], [40, FLOOR], 6, C.frame) + ln([200, 168], [200, FLOOR], 6, C.frame)
          + ln([52, 152], [100, 150], 9, C.pad) + backPadSide(J, 15, 10) + ln([70, 152], [70, 168], 5, C.frame) + ln([120, 146], [205, 128], 5, C.frame),
        front: ln(add(pf, D(10), 12), add(pf, D(190), 24), 8, C.padEdge) + ln(add(pf, D(100), 2), [Math.max(pf[0] + 10, 150), 140], 4, C.frame),
      };
    },
  },
  abduction: {
    view: 'front', period: 3, hi: ['hips', 'th'],
    A: { ...FB, ua: 15, fa: 25, th: 10, ts: 0.3, sh: 0 }, B: { th: 55, ts: 0.55, sh: 8 },
    draw(J) {
      const pad = (l) => { const o = l.m * 9; return ln([l.kn[0] + o, l.kn[1] - 6], [l.kn[0] + o + l.m * 2, l.kn[1] + 14], 9, C.padEdge) + ln([l.kn[0] + o, l.kn[1] + 14], [120, 168], 4, C.frame); };
      return { back: floor() + backPadFront(40) + seatFront(), front: pad(J.legR) + pad(J.legL) + grip(J.armR.ha, 'h', 5) + grip(J.armL.ha, 'h', 5) };
    },
  },
  calf: {
    view: 'side', period: 2.4, hi: ['sh'],
    A: { hx: 117.4, hy: 95.4, t: 180, ua: 22, fa: 165, th: 0, sh: 0, ft: 105 }, B: { hx: 119.4, hy: 84.5, ft: 55 },
    draw(J) {
      const S = J.S;
      return {
        back: floor() + rect(126, 170, 44, 18, C.pad, 3) + ln([90, 16], [90, FLOOR], 7, C.frame) + ln([90, S[1] - 7], [106, S[1] - 7], 5, C.frame),
        front: ln([S[0] - 12, S[1] - 8], [S[0] + 14, S[1] - 8], 9, C.padEdge),
      };
    },
  },
  crunch: {
    view: 'side', period: 2.8, hi: ['abs'],
    A: { ...SB, t: 178, ua: 25, fa: 150 }, B: { t: 140, ua: -13, fa: 112 },
    draw(J) {
      const f = J.fwd, up = D(J.t);
      const a = add(J.H, f, 16), b = add(add(J.H, up, L.T * 0.85), f, 16);
      return {
        back: floor() + seatSide(68, 122, 152, 95) + rect(68, 128, 10, 24, C.pad, 4),
        mid: ln(a, b, 4, C.frame) + circ(a, 5, C.frame) + ln(add(b, up, -6), add(b, up, 8), 9, C.padEdge),
        front: grip(J.armN.ha, 'v', 6),
      };
    },
  },
  treadmill: {
    view: 'side', period: 1.4, hi: ['sh', 'glutes'],
    A: { hx: 118, hy: 94, t: 175, ua: -22, fa: 15, ua2: 22, fa2: 60, th: 24, sh: 8, ft: 95, th2: -18, sh2: -32, ft2: 60 },
    B: { ua: 22, fa: 60, ua2: -22, fa2: 15, th: -18, sh: -32, ft: 60, th2: 24, sh2: 8, ft2: 95 },
    draw(J, p, id, def, time) {
      const y = (x) => 181 - (x - 30) * (15 / 175);
      const off = ((time * 40) % 16).toFixed(1);
      return {
        back: floor() + poly([[30, y(30) - 2], [205, y(205) - 2], [205, y(205) + 8], [30, y(30) + 8]], C.pad) + `<line x1="32" y1="${f1(y(32) + 3)}" x2="203" y2="${f1(y(203) + 3)}" stroke="#56627a" stroke-width="2" stroke-dasharray="6 10" stroke-dashoffset="${off}"/>`
          + ln([200, y(200)], [188, 78], 6, C.frame) + rect(170, 66, 34, 12, C.frame, 3) + ln([188, 96], [150, 100], 4, C.frame) + ln([30, y(30) + 8], [30, FLOOR], 5, C.frame) + ln([205, y(205) + 8], [205, FLOOR], 5, C.frame),
      };
    },
  },
  plank: {
    view: 'side', period: 4, hi: ['abs'],
    A: { hx: 119.75, hy: 163, t: 264, ua: 0, fa: 90, th: 75, sh: 75, ft: 50 }, B: { hy: 161 },
    draw() { return { back: floor() + rect(40, 183, 180, 5, '#3d4a5e', 2) }; },
  },
  generic: {
    view: 'side', period: 3, hi: [],
    A: { hx: 110, hy: 110, t: 180, ua: 5, fa: 10, th: 2, sh: -2, ft: 90 }, B: { ua: 12, fa: 25 },
    draw() { return { back: floor() }; },
  },
};

/** Hand trajectory samples (for tests): which = 'N' (side view) or 'R' / 'L' (front view). */
export function handTrajectory(poseId, which, n = 18) {
  const def = DEFS[poseId];
  const pts = sampleHand(def, which, n);
  const J0 = joints(interp(def, 0), def.view === 'side' ? 'side' : 'front');
  return { pts, shoulder: J0.view === 'side' ? J0.S : J0.SR, hip: J0.H };
}

const VIEW_LABEL = { side: 'side view', front: 'front view', back: 'view from behind' };

export function frameSVG(poseId, p, time = 0) {
  const def = DEFS[poseId] || DEFS.generic;
  const P = interp(def, p);
  const J = joints(P, def.view === 'back' ? 'front' : def.view);
  if (def.view === 'back') J.view = 'front';
  const layers = def.draw(J, p, poseId, def, time) || {};
  return drawFigure(J, def.hi || [], layers);
}

/** Static SVG markup for an exercise illustration (animated later by mount()). */
export function illustration(poseId, { size = '', p = 0, still = false, label = true } = {}) {
  const def = DEFS[poseId] || DEFS.generic;
  return `<svg class="fig ${size}" viewBox="0 0 240 208" role="img" aria-label="Schematic animation (${VIEW_LABEL[def.view]})" ${still ? '' : `data-anim="${poseId}"`}>
    <g class="fig-body">${frameSVG(poseId, p)}</g>
    ${label ? `<text x="234" y="205" text-anchor="end" class="fig-label">${VIEW_LABEL[def.view]}</text>` : ''}
  </svg>`;
}

// ---------- animation loop ----------
const live = new Set();
let raf = 0;
const reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const io = typeof IntersectionObserver !== 'undefined' ? new IntersectionObserver((ents) => {
  for (const e of ents) { const r = e.target.__anim; if (r) r.visible = e.isIntersecting; }
}) : null;

const ease = (x) => x * x * (3 - 2 * x);
function phase(u) { // 0..1 -> start->end->start with short holds
  const h = 0.08;
  if (u < h) return 0;
  if (u < 0.5 - h / 2) return ease((u - h) / (0.5 - 1.5 * h));
  if (u < 0.5 + h / 2) return 1;
  if (u < 1 - h) return 1 - ease((u - 0.5 - h / 2) / (0.5 - 1.5 * h));
  return 0;
}

function tick(ts) {
  raf = 0;
  for (const r of live) {
    if (!r.el.isConnected) { live.delete(r); io?.unobserve(r.el); continue; }
    if (!r.visible || r.paused) continue;
    const def = DEFS[r.id] || DEFS.generic;
    const t = ts / 1000;
    const u = ((t / (def.period * r.speed)) + r.offset) % 1;
    r.g.innerHTML = frameSVG(r.id, phase(u), t);
  }
  if (live.size) raf = requestAnimationFrame(tick);
}

export function mount(root = document) {
  root.querySelectorAll('svg[data-anim]').forEach((el) => {
    if (el.__anim) return;
    const r = { el, id: el.dataset.anim, g: el.querySelector('.fig-body'), visible: !io, paused: reduced, speed: 1, offset: Math.random() * 0.2 };
    el.__anim = r;
    live.add(r);
    io?.observe(el);
  });
  if (!raf && live.size) raf = requestAnimationFrame(tick);
}

export function togglePause(el) {
  const r = el?.__anim; if (!r) return false;
  r.paused = !r.paused;
  if (!raf) raf = requestAnimationFrame(tick);
  return r.paused;
}
export function setSpeed(el, s) { const r = el?.__anim; if (r) r.speed = s; }
export function setPhase(el, p) { const r = el?.__anim; if (r) { r.paused = true; r.g.innerHTML = frameSVG(r.id, p, 0); } }
