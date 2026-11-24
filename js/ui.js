// Shared UI pieces: toast, bottom sheet, rest timer, exercise visual, steppers, pain scale.
import { esc, tag, fmtDur, clamp } from './util.js';
import { illustration, mount, togglePause } from './figure.js';
import { getPhoto } from './store.js';
import { getEx } from './logic.js';
import { state, save } from './store.js';
import { exName, exSub } from './data/exercises.js';

export const go = (hash) => { if (location.hash === hash) window.dispatchEvent(new HashChangeEvent('hashchange')); else location.hash = hash; };

export function toast(msg, ms = 2200) {
  const t = document.createElement('div');
  t.className = 'toast'; t.textContent = msg; t.setAttribute('role', 'status');
  document.body.appendChild(t);
  setTimeout(() => t.remove(), ms);
}

let sheetEl = null;
/** Open a bottom sheet. `bind(root, close)` wires events. */
export function openSheet(html, bind) {
  closeSheet();
  sheetEl = document.createElement('div');
  sheetEl.className = 'sheet-bg';
  sheetEl.innerHTML = `<div class="sheet" role="dialog" aria-modal="true"><div class="grab"></div>${html}</div>`;
  sheetEl.addEventListener('click', (e) => { if (e.target === sheetEl || e.target.closest('[data-close]')) closeSheet(); });
  document.body.appendChild(sheetEl);
  mount(sheetEl);
  bind?.(sheetEl.querySelector('.sheet'), closeSheet);
  return sheetEl;
}
export function closeSheet() { sheetEl?.remove(); sheetEl = null; }

export function confirmBox(text, okLabel = 'Yes', danger = false) {
  return new Promise((resolve) => {
    openSheet(`<h2>${esc(text)}</h2><div class="grid2" style="margin-top:14px"><button data-close>Cancel</button><button class="${danger ? 'btn-danger' : 'btn-primary'}" id="cf-ok">${esc(okLabel)}</button></div>`,
      (root, close) => {
        root.querySelector('#cf-ok').onclick = () => { close(); resolve(true); };
        root.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => resolve(false)));
      });
  });
}

// ---------- exercise visual (user photo first, schematic otherwise) ----------
export function visual(exId, { compact = false } = {}) {
  const ex = getEx(state, exId);
  const pose = ex?.pose || 'generic';
  return `<div class="visual" data-visual="${esc(exId)}">
    <div class="badge">${tag('schematic', 'Schematic')}</div>
    <div class="vctl">
      <button type="button" data-vact="pause" aria-label="Pause or play animation">⏯</button>
      <button type="button" data-vact="photo" class="hidden">Photo</button>
      <button type="button" data-vact="schem" class="hidden">Schematic</button>
    </div>
    <img class="hidden" alt="Your photo of the machine">
    ${illustration(pose, { size: compact ? 'compact' : '' })}
  </div>`;
}

export function thumb(exId) {
  const ex = getEx(state, exId);
  return `<div class="thumb" data-thumb="${esc(exId)}">${illustration(ex?.pose || 'generic', { label: false })}</div>`;
}

/** After rendering: load photos, start animations, wire visual controls. */
export async function hydrate(root) {
  mount(root);
  for (const v of root.querySelectorAll('[data-visual]')) {
    if (v.__wired) continue;
    v.__wired = true;
    const id = v.dataset.visual;
    const svg = v.querySelector('svg'), img = v.querySelector('img'), badge = v.querySelector('.badge');
    const bPhoto = v.querySelector('[data-vact=photo]'), bSchem = v.querySelector('[data-vact=schem]'), bPause = v.querySelector('[data-vact=pause]');
    const show = (photo) => {
      img.classList.toggle('hidden', !photo); svg.classList.toggle('hidden', photo);
      bPhoto.classList.toggle('hidden', photo || !img.src); bSchem.classList.toggle('hidden', !photo);
      bPause.classList.toggle('hidden', photo);
      badge.innerHTML = photo ? tag('actual', 'Your photo') : tag('schematic', 'Schematic');
    };
    bPause.onclick = () => togglePause(svg);
    bPhoto.onclick = () => show(true);
    bSchem.onclick = () => show(false);
    const ph = await getPhoto(id);
    if (ph) { img.src = ph; show(true); }
  }
  for (const t of root.querySelectorAll('[data-thumb]')) {
    if (t.__wired) continue;
    t.__wired = true;
    const ph = await getPhoto(t.dataset.thumb);
    if (ph) t.innerHTML = `<img src="${ph}" alt="">`;
  }
}

export function exTitle(exId) {
  const ex = getEx(state, exId);
  return `<b>${esc(exName(ex, state.settings))}</b><span class="muted small">${esc(exSub(ex, state.settings))}</span>`;
}

// ---------- steppers ----------
export function stepper(name, value, step, unit, { min = 0, max = 999, dec = 1 } = {}) {
  return `<div class="stepper" data-stepper="${name}" data-step="${step}" data-min="${min}" data-max="${max}" data-dec="${dec}">
    <button type="button" data-sd="-1" aria-label="Decrease ${name}">−</button>
    <div class="val"><input name="${name}" inputmode="decimal" value="${value ?? ''}" aria-label="${name}" autocomplete="off"><small>${unit}</small></div>
    <button type="button" data-sd="1" aria-label="Increase ${name}">+</button>
  </div>`;
}
export function wireSteppers(root) {
  root.querySelectorAll('[data-stepper]').forEach((s) => {
    if (s.__wired) return; s.__wired = true;
    const input = s.querySelector('input');
    s.querySelectorAll('[data-sd]').forEach((b) => b.addEventListener('click', () => {
      const step = Number(s.dataset.step) * Number(b.dataset.sd);
      const cur = Number(String(input.value).replace(',', '.')) || 0;
      const dec = Number(s.dataset.dec);
      const v = clamp(Math.round((cur + step) * 10 ** dec) / 10 ** dec, Number(s.dataset.min), Number(s.dataset.max));
      input.value = v;
      input.dispatchEvent(new Event('change', { bubbles: true }));
      navigator.vibrate?.(8);
    }));
  });
}

// ---------- 0–10 scale ----------
export function scale(name, value, { from = 0, to = 10, cls = '' } = {}) {
  let s = `<div class="pain-scale ${cls}" data-scale="${name}" style="grid-template-columns:repeat(${to - from + 1},1fr)">`;
  for (let i = from; i <= to; i++) s += `<button type="button" data-v="${i}" class="${value === i ? 'on' : ''}">${i}</button>`;
  return s + `</div><input type="hidden" name="${name}" value="${value ?? ''}">`;
}
export function wireScales(root) {
  root.querySelectorAll('[data-scale]').forEach((s) => {
    if (s.__wired) return; s.__wired = true;
    const input = s.nextElementSibling;
    s.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-v]'); if (!b) return;
      const was = b.classList.contains('on');
      s.querySelectorAll('button').forEach((x) => x.classList.remove('on'));
      if (!was) { b.classList.add('on'); input.value = b.dataset.v; } else input.value = '';
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
  });
}
export function wireSegs(root) {
  root.querySelectorAll('[data-seg]').forEach((s) => {
    if (s.__wired) return; s.__wired = true;
    const input = root.querySelector(`input[name="${s.dataset.seg}"]`);
    s.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-v]'); if (!b) return;
      s.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
      if (input) { input.value = b.dataset.v; input.dispatchEvent(new Event('change', { bubbles: true })); }
    });
  });
}
export function wireAll(root) { wireSteppers(root); wireScales(root); wireSegs(root); hydrate(root); }

// ---------- rest timer ----------
const timer = { endAt: 0, total: 0, label: '', iv: 0, done: false };
let audioCtx = null;
function beep() {
  if (!state.settings.sound) return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    [0, 0.25, 0.5].forEach((d) => {
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.frequency.value = 880; o.connect(g); g.connect(audioCtx.destination);
      g.gain.setValueAtTime(0.0001, audioCtx.currentTime + d);
      g.gain.exponentialRampToValueAtTime(0.3, audioCtx.currentTime + d + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + d + 0.18);
      o.start(audioCtx.currentTime + d); o.stop(audioCtx.currentTime + d + 0.2);
    });
  } catch { /* audio unavailable */ }
}
export function unlockAudio() { try { audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)(); audioCtx.resume?.(); } catch { /* */ } }

export function startTimer(sec, label = 'Rest') {
  unlockAudio();
  timer.total = sec; timer.endAt = Date.now() + sec * 1000; timer.label = label; timer.done = false;
  clearInterval(timer.iv);
  timer.iv = setInterval(renderTimer, 250);
  renderTimer();
}
export function stopTimer() { clearInterval(timer.iv); timer.endAt = 0; renderTimer(); }
function renderTimer() {
  const el = document.getElementById('timer');
  if (!el) return;
  if (!timer.endAt) { el.classList.add('hidden'); el.innerHTML = ''; return; }
  const left = Math.ceil((timer.endAt - Date.now()) / 1000);
  if (left <= 0 && !timer.done) {
    timer.done = true; beep(); if (state.settings.vibrate) navigator.vibrate?.([200, 100, 200]);
  }
  if (left < -60) { stopTimer(); return; }
  el.classList.remove('hidden');
  el.classList.toggle('done', left <= 0);
  const pct = clamp((1 - left / timer.total) * 100, 0, 100);
  el.innerHTML = `<div class="tt">${left > 0 ? fmtDur(left) : 'Go!'}</div><div class="grow small"><b>${esc(timer.label)}</b><div class="muted tiny">${left > 0 ? 'Rest timer' : 'Rest over — next set'}</div></div>
    <button type="button" data-tm="-15">−15</button><button type="button" data-tm="15">+15</button><button type="button" data-tm="x" aria-label="Close timer">✕</button><div class="prog" style="width:${pct}%"></div>`;
}
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-tm]'); if (!b) return;
  if (b.dataset.tm === 'x') return stopTimer();
  timer.endAt += Number(b.dataset.tm) * 1000; timer.total = Math.max(5, timer.total + Number(b.dataset.tm)); timer.done = false; renderTimer();
});

export function setExSetting(exId, key, val) {
  state.exerciseSettings[exId] = { ...(state.exerciseSettings[exId] || {}), [key]: val };
  save();
}
export function restFor(exId) {
  return state.exerciseSettings[exId]?.restSec ?? getEx(state, exId)?.restSec ?? state.settings.defaultRest ?? 90;
}
