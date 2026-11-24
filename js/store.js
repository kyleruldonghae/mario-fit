// Local persistence: IndexedDB (key/value) with localStorage fallback.
// The whole app state is one JSON document; machine photos are stored separately.
import { seedState } from './data/seed.js';

const DB_NAME = 'mario-fit';
const STORE = 'kv';
const LS_KEY = 'mario-fit-state';
let dbp = null;
let useLS = false;

function openDB() {
  if (dbp) return dbp;
  dbp = new Promise((resolve) => {
    if (!('indexedDB' in self)) { useLS = true; return resolve(null); }
    // Some browsers (private modes, local files) never answer: fall back after a short wait.
    const timer = setTimeout(() => { useLS = true; resolve(null); }, 2500);
    const done = (v) => { clearTimeout(timer); resolve(v); };
    try {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => done(req.result);
      req.onerror = () => { useLS = true; done(null); };
      req.onblocked = () => { useLS = true; done(null); };
    } catch { useLS = true; done(null); }
  });
  return dbp;
}

async function idb(mode, fn) {
  const db = await openDB();
  if (!db) throw new Error('no-idb');
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const st = tx.objectStore(STORE);
    const req = fn(st);
    tx.oncomplete = () => resolve(req?.result);
    tx.onerror = () => reject(tx.error);
  });
}

export async function kvGet(key) {
  try { if (!useLS) return await idb('readonly', (s) => s.get(key)); } catch { useLS = true; }
  const v = localStorage.getItem(LS_KEY + ':' + key);
  return v ? JSON.parse(v) : undefined;
}
export async function kvSet(key, val) {
  try { if (!useLS) return await idb('readwrite', (s) => s.put(val, key)); } catch { useLS = true; }
  localStorage.setItem(LS_KEY + ':' + key, JSON.stringify(val));
}
export async function kvDel(key) {
  try { if (!useLS) return await idb('readwrite', (s) => s.delete(key)); } catch { useLS = true; }
  localStorage.removeItem(LS_KEY + ':' + key);
}
export async function kvKeys() {
  try { if (!useLS) return await idb('readonly', (s) => s.getAllKeys()); } catch { useLS = true; }
  return Object.keys(localStorage).filter((k) => k.startsWith(LS_KEY + ':')).map((k) => k.slice(LS_KEY.length + 1));
}

export const storageKind = () => (useLS ? 'localStorage (fallback)' : 'IndexedDB');

// ---- App state ----
export let state = null;
const listeners = new Set();

export async function loadState() {
  let s = await kvGet('state');
  if (!s) { // data may have been saved to the fallback store in an earlier visit
    try { const ls = localStorage.getItem(LS_KEY + ':state'); if (ls) s = JSON.parse(ls); } catch { /* ignore */ }
  }
  if (!s) { s = seedState(); await kvSet('state', s); }
  state = migrate(s);
  return state;
}

function migrate(s) {
  const base = seedState();
  for (const k of Object.keys(base)) if (s[k] === undefined) s[k] = base[k];
  s.settings = { ...base.settings, ...s.settings };
  s.profile = { ...base.profile, ...s.profile, unknowns: { ...base.profile.unknowns, ...(s.profile?.unknowns || {}) } };
  return s;
}

let saveTimer = null;
export function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => kvSet('state', state).catch((e) => console.error('save failed', e)), 120);
  listeners.forEach((f) => f(state));
}
export async function saveNow() { clearTimeout(saveTimer); await kvSet('state', state); }

export function onChange(f) { listeners.add(f); return () => listeners.delete(f); }

export async function replaceState(newState) {
  state = migrate(newState);
  await saveNow();
}

export async function resetAll() {
  const keys = await kvKeys();
  for (const k of keys) await kvDel(k);
  state = seedState();
  await saveNow();
}

// ---- Photos (data URLs) ----
export const photoKey = (exId) => 'photo:' + exId;
const photoCache = new Map();
export async function getPhoto(exId) {
  if (photoCache.has(exId)) return photoCache.get(exId);
  const v = (await kvGet(photoKey(exId))) || null;
  photoCache.set(exId, v);
  return v;
}
export async function setPhoto(exId, dataUrl) {
  photoCache.set(exId, dataUrl);
  if (dataUrl) await kvSet(photoKey(exId), dataUrl); else await kvDel(photoKey(exId));
}
export async function allPhotos() {
  const keys = (await kvKeys()).filter((k) => String(k).startsWith('photo:'));
  const out = {};
  for (const k of keys) out[k.slice(6)] = await kvGet(k);
  return out;
}

/** Resize an image File to a JPEG data URL (max side px). */
export function fileToDataUrl(file, max = 900) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const sc = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * sc); c.height = Math.round(img.height * sc);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
    img.src = url;
  });
}
