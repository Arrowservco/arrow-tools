/* Dreamcast Player - a libretro frontend for the Flycast WebAssembly core.
 *
 * Everything here is original glue code: it loads the (patched) Flycast core that
 * build.mjs inlines into the page, implements the libretro host API (video via WebGL2,
 * audio via WebAudio, keyboard + gamepad input), mounts the user's game files into the
 * core's in-memory filesystem, and persists saves / BIOS / save states in IndexedDB.
 */
'use strict';
(() => {

/* ======================================================================== *
 * small helpers
 * ======================================================================== */
const $ = (id) => document.getElementById(id);
const raf = () => new Promise((r) => requestAnimationFrame(() => r()));
const tick = () => new Promise((r) => setTimeout(r, 0));
const enc = new TextEncoder();
const dec = new TextDecoder();

const prefs = {
  get(k, d) { try { const v = localStorage.getItem('dcp.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('dcp.' + k, JSON.stringify(v)); } catch { /* storage unavailable */ } },
};

const logLines = [];
function log(kind, text) {
  logLines.push({ kind, text: String(text) });
  if (logLines.length > 1500) logLines.splice(0, 300);
  const el = $('log');
  if (el) { appendLog(el, logLines[logLines.length - 1]); }
}
function appendLog(el, l) {
  const d = document.createElement('div');
  d.className = l.kind; d.textContent = l.text; el.appendChild(d);
  el.scrollTop = el.scrollHeight;
}

let toastTimer = 0;
function toast(msg, ms = 2200) {
  const t = $('toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, ms);
}
function showError(title, text) {
  $('errorTitle').textContent = title; $('errorText').textContent = text; $('errorBox').hidden = false;
  log('err', title + ': ' + text);
}
function showLoading(text) { $('loadingText').textContent = text; $('loading').hidden = false; }
function hideLoading() { $('loading').hidden = true; }
function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
}
const cleanPath = (p) => p.replace(/\\/g, '/').split('/').filter((x) => x && x !== '.' && x !== '..').join('/');
const baseName = (p) => p.replace(/\\/g, '/').split('/').pop();
const extOf = (p) => { const m = /\.([^./\\]+)$/.exec(p); return m ? m[1].toLowerCase() : ''; };
const stripExt = (p) => baseName(p).replace(/\.[^.]+$/, '');
const fmtBytes = (n) => n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : (n / 1024).toFixed(0) + ' KB';

/* ======================================================================== *
 * Node `path` shim - the Emscripten glue calls require("path") unconditionally
 * ======================================================================== */
const posix = (() => {
  const norm = (parts, up) => {
    const out = [];
    for (const s of parts) {
      if (!s || s === '.') continue;
      if (s === '..') { if (out.length && out[out.length - 1] !== '..') out.pop(); else if (up) out.push('..'); } else out.push(s);
    }
    return out;
  };
  const p = {
    isAbsolute: (x) => x.charAt(0) === '/',
    normalize(x) {
      const abs = p.isAbsolute(x), trail = x.endsWith('/');
      let r = norm(x.split('/'), !abs).join('/');
      if (!r && !abs) r = '.';
      if (r && trail) r += '/';
      return (abs ? '/' : '') + r;
    },
    dirname(x) {
      if (!x) return '.';
      const t = x.replace(/\/+$/, '');
      const i = t.lastIndexOf('/');
      if (i < 0) return '.';
      return i === 0 ? '/' : t.slice(0, i);
    },
    basename(x, ext) {
      const t = x.replace(/\/+$/, ''); let b = t.slice(t.lastIndexOf('/') + 1);
      if (ext && b.endsWith(ext) && b !== ext) b = b.slice(0, -ext.length);
      return b;
    },
    join(...a) { const j = a.filter(Boolean).join('/'); return j ? p.normalize(j) : '.'; },
    resolve(...a) {
      let r = '', abs = false;
      for (let i = a.length - 1; i >= 0 && !abs; i--) { if (!a[i]) continue; r = a[i] + '/' + r; abs = a[i].charAt(0) === '/'; }
      if (!abs) r = '/' + r; // no real cwd in the browser: treat as root
      return '/' + norm(r.split('/'), false).join('/');
    },
    relative(from, to) {
      const f = norm(p.resolve(from).split('/'), false), t = norm(p.resolve(to).split('/'), false);
      let i = 0; while (i < f.length && i < t.length && f[i] === t[i]) i++;
      return [...f.slice(i).map(() => '..'), ...t.slice(i)].join('/');
    },
  };
  return p;
})();
globalThis.require = (m) => {
  if (m === 'path') return { ...posix, posix };
  throw new Error('require("' + m + '") is not available in the browser');
};

/* ======================================================================== *
 * IndexedDB (saves, BIOS, save states) - all optional, degrades silently
 * ======================================================================== */
const idb = (() => {
  let dbp = null;
  const open = () => dbp || (dbp = new Promise((res, rej) => {
    if (!('indexedDB' in window)) return rej(new Error('IndexedDB unavailable'));
    const r = indexedDB.open('dcplayer', 1);
    r.onupgradeneeded = () => { for (const s of ['saves', 'states', 'bios']) r.result.createObjectStore(s); };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  }));
  const run = async (store, mode, fn) => {
    try {
      const d = await open();
      return await new Promise((res, rej) => {
        const t = d.transaction(store, mode); let rq;
        try { rq = fn(t.objectStore(store)); } catch (e) { return rej(e); }
        t.oncomplete = () => res(rq ? rq.result : undefined);
        t.onerror = t.onabort = () => rej(t.error);
      });
    } catch (e) { log('warn', 'storage: ' + (e && e.message || e)); return undefined; }
  };
  return {
    get: (s, k) => run(s, 'readonly', (o) => o.get(k)),
    put: (s, k, v) => run(s, 'readwrite', (o) => o.put(v, k)),
    del: (s, k) => run(s, 'readwrite', (o) => o.delete(k)),
    keys: async (s) => (await run(s, 'readonly', (o) => o.getAllKeys())) || [],
  };
})();

/* ======================================================================== *
 * compression + zip
 * ======================================================================== */
async function streamBytes(bytes, format, mode) {
  const T = mode === 'c' ? CompressionStream : DecompressionStream;
  const s = new Blob([bytes]).stream().pipeThrough(new T(format));
  return new Uint8Array(await new Response(s).arrayBuffer());
}
function b64ToBytes(b64) {
  const bin = atob(b64), u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return u;
}
async function readZip(bytes) {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('This does not look like a valid .zip file.');
  const count = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true);
  const out = [];
  for (let n = 0; n < count; n++) {
    if (dv.getUint32(p, true) !== 0x02014b50) break;
    const method = dv.getUint16(p + 10, true);
    const csize = dv.getUint32(p + 20, true), usize = dv.getUint32(p + 24, true);
    const nlen = dv.getUint16(p + 28, true), elen = dv.getUint16(p + 30, true), clen = dv.getUint16(p + 32, true);
    const lho = dv.getUint32(p + 42, true);
    const name = dec.decode(bytes.subarray(p + 46, p + 46 + nlen));
    p += 46 + nlen + elen + clen;
    if (name.endsWith('/')) continue;
    if (csize === 0xFFFFFFFF || usize === 0xFFFFFFFF) throw new Error('ZIP64 archives are not supported - please extract the zip and load the files directly.');
    const start = lho + 30 + dv.getUint16(lho + 26, true) + dv.getUint16(lho + 28, true);
    const raw = bytes.subarray(start, start + csize);
    if (method === 0) out.push({ path: name, data: raw });
    else if (method === 8) out.push({ path: name, data: await streamBytes(raw, 'deflate-raw', 'd') });
    else throw new Error('Unsupported zip compression method in ' + name);
  }
  return out;
}

/* ======================================================================== *
 * game file intake: files / folders / zips -> a mounted set + a main file
 * ======================================================================== */
async function entriesFromDrop(dt) {
  const out = [];
  const walk = async (entry, prefix) => {
    if (entry.isFile) {
      const file = await new Promise((res, rej) => entry.file(res, rej));
      out.push({ path: prefix + entry.name, file });
    } else if (entry.isDirectory) {
      const reader = entry.createReader();
      for (;;) {
        const batch = await new Promise((res, rej) => reader.readEntries(res, rej));
        if (!batch.length) break;
        for (const e of batch) await walk(e, prefix + entry.name + '/');
      }
    }
  };
  const items = [...(dt.items || [])].map((i) => (i.webkitGetAsEntry ? i.webkitGetAsEntry() : null));
  if (items.length && items.every(Boolean)) { for (const e of items) await walk(e, ''); return out; }
  return [...dt.files].map((f) => ({ path: f.name, file: f }));
}
const entriesFromInput = (input) => [...input.files].map((f) => ({ path: f.webkitRelativePath || f.name, file: f }));

const MAIN_PRIORITY = ['gdi', 'cdi', 'chd', 'cue', 'm3u', 'iso', 'elf', 'lst', 'bin'];

async function expandZips(items) {
  const out = [];
  for (const it of items) {
    if (extOf(it.path) === 'zip') {
      showLoading('Unzipping ' + baseName(it.path) + '...');
      const bytes = it.data || new Uint8Array(await it.file.arrayBuffer());
      const dir = it.path.includes('/') ? it.path.replace(/[^/]+$/, '') : '';
      for (const e of await readZip(bytes)) out.push({ path: dir + e.path, data: e.data });
    } else out.push(it);
  }
  return out;
}

/** Case-insensitive repair of track references in .gdi / .cue sheets. */
function fixSheet(text, ext, siblings) {
  const byLower = new Map(siblings.map((s) => [s.toLowerCase(), s]));
  const fix = (tok) => {
    const q = tok.startsWith('"');
    const name = q ? tok.slice(1, -1) : tok;
    const hit = byLower.get(baseName(name).toLowerCase());
    if (!hit || hit === name) return tok;
    return q ? '"' + hit + '"' : hit;
  };
  const lines = text.split(/\r?\n/).map((line) => {
    if (ext === 'gdi') {
      const m = /^(\s*\d+\s+-?\d+\s+\d+\s+\d+\s+)("[^"]+"|\S+)(\s+\d+\s*)$/.exec(line);
      return m ? m[1] + fix(m[2]) + m[3] : line;
    }
    const m = /^(\s*FILE\s+)("[^"]+"|\S+)(\s+\w+\s*)$/i.exec(line);
    return m ? m[1] + fix(m[2]) + m[3] : line;
  });
  return lines.join('\n');
}

function pickMain(items) {
  const cands = [];
  for (const ext of MAIN_PRIORITY) {
    const hits = items.filter((i) => extOf(i.path) === ext);
    if (hits.length) {
      // a lone .bin next to a sheet is a track, never the main file
      cands.push(...hits);
      break;
    }
  }
  return cands;
}

function askWhich(cands) {
  return new Promise((resolve) => {
    const list = $('chooserList'); list.textContent = '';
    for (const c of cands) {
      const b = document.createElement('button'); b.textContent = c.path; b.onclick = () => { $('chooser').hidden = true; resolve(c); };
      list.appendChild(b);
    }
    $('chooserCancel').onclick = () => { $('chooser').hidden = true; resolve(null); };
    $('chooser').hidden = false;
  });
}

/* ======================================================================== *
 * minimal C printf (for the core's variadic log callback)
 * ======================================================================== */
function cformat(M, fmtPtr, vaPtr) {
  const heap = M.HEAPU8, dv = new DataView(heap.buffer);
  const cstr = (p) => { if (!p) return '(null)'; let e = p; while (heap[e]) e++; return dec.decode(heap.subarray(p, e)); };
  const fmt = cstr(fmtPtr);
  let va = vaPtr, out = '';
  const rd32 = () => { va = (va + 3) & ~3; const v = dv.getInt32(va, true); va += 4; return v; };
  const rd64 = () => { va = (va + 7) & ~7; const v = dv.getBigInt64(va, true); va += 8; return v; };
  const rdD = () => { va = (va + 7) & ~7; const v = dv.getFloat64(va, true); va += 8; return v; };
  for (let i = 0; i < fmt.length; i++) {
    const c = fmt[i];
    if (c !== '%') { out += c; continue; }
    let flags = '', width = '', prec = null, len = '';
    i++;
    while ('-+ #0'.includes(fmt[i])) flags += fmt[i++];
    if (fmt[i] === '*') { width = String(rd32()); i++; } else while (/\d/.test(fmt[i])) width += fmt[i++];
    if (fmt[i] === '.') { i++; prec = ''; if (fmt[i] === '*') { prec = String(rd32()); i++; } else while (/\d/.test(fmt[i])) prec += fmt[i++]; }
    while ('hlzjtL'.includes(fmt[i])) len += fmt[i++];
    const conv = fmt[i];
    let s = '';
    switch (conv) {
      case '%': s = '%'; break;
      case 'd': case 'i': s = len === 'll' ? String(rd64()) : String(rd32()); break;
      case 'u': s = len === 'll' ? BigInt.asUintN(64, rd64()).toString() : String(rd32() >>> 0); break;
      case 'x': case 'X': s = (len === 'll' ? BigInt.asUintN(64, rd64()) : BigInt(rd32() >>> 0)).toString(16); if (conv === 'X') s = s.toUpperCase(); if (flags.includes('#')) s = '0x' + s; break;
      case 'o': s = (rd32() >>> 0).toString(8); break;
      case 'c': s = String.fromCharCode(rd32() & 255); break;
      case 's': s = cstr(rd32()); if (prec) s = s.slice(0, +prec); break;
      case 'p': s = '0x' + (rd32() >>> 0).toString(16); break;
      case 'f': case 'F': s = rdD().toFixed(prec === null || prec === '' ? 6 : +prec); break;
      case 'e': case 'E': s = rdD().toExponential(prec === null || prec === '' ? 6 : +prec); break;
      case 'g': case 'G': s = String(+rdD().toPrecision(prec ? +prec : 6)); break;
      default: s = '%' + (conv || '');
    }
    if (width && s.length < +width) s = flags.includes('-') ? s.padEnd(+width) : s.padStart(+width, flags.includes('0') && !'sc'.includes(conv) ? '0' : ' ');
    out += s;
  }
  return out.replace(/\n+$/, '');
}

/* ======================================================================== *
 * input mapping
 * ======================================================================== */
// RetroPad joypad ids (Flycast maps RetroPad B->DC A, A->DC B, Y->DC X, X->DC Y, L2/R2 -> triggers)
const RJ = { B: 0, Y: 1, SELECT: 2, START: 3, UP: 4, DOWN: 5, LEFT: 6, RIGHT: 7, A: 8, X: 9, L: 10, R: 11, L2: 12, R2: 13, L3: 14, R3: 15 };
const ACTIONS = [
  { id: 'up', label: 'D-pad up', def: 'ArrowUp', bit: RJ.UP },
  { id: 'down', label: 'D-pad down', def: 'ArrowDown', bit: RJ.DOWN },
  { id: 'left', label: 'D-pad left', def: 'ArrowLeft', bit: RJ.LEFT },
  { id: 'right', label: 'D-pad right', def: 'ArrowRight', bit: RJ.RIGHT },
  { id: 'a', label: 'A (bottom)', def: 'KeyZ', bit: RJ.B },
  { id: 'b', label: 'B (right)', def: 'KeyX', bit: RJ.A },
  { id: 'x', label: 'X (left)', def: 'KeyA', bit: RJ.Y },
  { id: 'y', label: 'Y (top)', def: 'KeyS', bit: RJ.X },
  { id: 'start', label: 'Start', def: 'Enter', bit: RJ.START },
  { id: 'lt', label: 'Left trigger', def: 'KeyQ', bit: RJ.L2 },
  { id: 'rt', label: 'Right trigger', def: 'KeyW', bit: RJ.R2 },
  { id: 'lsUp', label: 'Stick up', def: 'KeyI', stick: [1, -1] },
  { id: 'lsDown', label: 'Stick down', def: 'KeyK', stick: [1, 1] },
  { id: 'lsLeft', label: 'Stick left', def: 'KeyJ', stick: [0, -1] },
  { id: 'lsRight', label: 'Stick right', def: 'KeyL', stick: [0, 1] },
];
let keyMap = { ...Object.fromEntries(ACTIONS.map((a) => [a.id, a.def])), ...prefs.get('keys', {}) };
const keysDown = new Set();

// Standard Gamepad API layout -> RetroPad ids
const PAD_BUTTONS = { 0: RJ.B, 1: RJ.A, 2: RJ.Y, 3: RJ.X, 4: RJ.L2, 5: RJ.R2, 6: RJ.L2, 7: RJ.R2, 8: RJ.SELECT, 9: RJ.START, 10: RJ.L3, 11: RJ.R3, 12: RJ.UP, 13: RJ.DOWN, 14: RJ.LEFT, 15: RJ.RIGHT };

/* ======================================================================== *
 * the libretro host
 * ======================================================================== */
const ENV = {
  SET_ROTATION: 1, GET_CAN_DUPE: 3, SET_MESSAGE: 6, SHUTDOWN: 7, SET_PERFORMANCE_LEVEL: 8, GET_SYSTEM_DIRECTORY: 9,
  SET_PIXEL_FORMAT: 10, SET_INPUT_DESCRIPTORS: 11, SET_HW_RENDER: 14, GET_VARIABLE: 15, SET_VARIABLES: 16,
  GET_VARIABLE_UPDATE: 17, SET_SUPPORT_NO_GAME: 18, GET_LOG_INTERFACE: 27, GET_SAVE_DIRECTORY: 31,
  SET_SYSTEM_AV_INFO: 32, SET_CONTROLLER_INFO: 35, SET_GEOMETRY: 37, GET_LANGUAGE: 39, SET_SERIALIZATION_QUIRKS: 44,
  GET_INPUT_DEVICE_CAPABILITIES: 24, GET_CORE_ASSETS_DIRECTORY: 30, GET_JIT_CAPABLE: 74,
  GET_INPUT_BITMASKS: 51, GET_CORE_OPTIONS_VERSION: 52, SET_CORE_OPTIONS: 53, SET_CORE_OPTIONS_INTL: 54,
  SET_CORE_OPTIONS_DISPLAY: 55, GET_PREFERRED_HW_RENDER: 56, SET_MESSAGE_EXT: 60, GET_INPUT_MAX_USERS: 61,
  SET_CORE_OPTIONS_V2: 67, SET_CORE_OPTIONS_V2_INTL: 68, SET_CORE_OPTIONS_UPDATE_DISPLAY_CALLBACK: 69,
};

class Host {
  constructor(M, canvas, swCanvas) {
    this.M = M; this.canvas = canvas; this.sw = swCanvas;
    this.fps = 60; this.sampleRate = 44100; this.geom = { w: 640, h: 480, maxW: 640, maxH: 480, aspect: 4 / 3 };
    this.pixelFormat = 0; this.hw = null; this.gl = null; this.fbo = null;
    this.options = []; this.optValues = prefs.get('opt', {}); this.optDirty = false; this.strCache = new Map();
    this.paused = false; this.turbo = false; this.muted = !!prefs.get('muted', false); this.volume = prefs.get('volume', 0.8);
    this.running = false; this.frames = 0; this.statFrames = 0; this.statT = performance.now(); this.emuFps = 0;
    this.pads = [0, 1, 2, 3].map(() => ({ mask: 0, ax: [0, 0, 0, 0], trig: [0, 0] }));
    this.audio = null; this.audioNext = 0; this.descriptors = [];
    this.saveStamp = new Map(); this.lastError = null;
    this.onShutdown = null; this.onGeometry = null;
    this.tickFn = (t) => this.tick(t);
  }

  /* ---------- memory helpers (re-read HEAP* every time: memory can grow) ---------- */
  dv() { return new DataView(this.M.HEAPU8.buffer); }
  cstr(p) { if (!p) return ''; const h = this.M.HEAPU8; let e = p; while (h[e]) e++; return dec.decode(h.subarray(p, e)); }
  alloc(bytes) { const p = this.M._malloc(bytes.length + 1); this.M.HEAPU8.set(bytes, p); this.M.HEAPU8[p + bytes.length] = 0; return p; }
  cstrPtr(s) { let p = this.strCache.get(s); if (!p) { p = this.alloc(enc.encode(s)); this.strCache.set(s, p); } return p; }

  /* ---------- file system ---------- */
  mkdirp(dir) {
    const FS = this.M.FS; let cur = '';
    for (const part of dir.split('/').filter(Boolean)) { cur += '/' + part; try { FS.mkdir(cur); } catch { /* exists */ } }
  }
  writeFile(path, bytes) { this.mkdirp(posix.dirname(path)); this.M.FS.writeFile(path, bytes, { canOwn: true }); }
  listFiles(dir) {
    const FS = this.M.FS, out = [];
    const walk = (d) => {
      let names; try { names = FS.readdir(d); } catch { return; }
      for (const n of names) {
        if (n === '.' || n === '..') continue;
        const p = d + '/' + n; let st; try { st = FS.stat(p); } catch { continue; }
        if (FS.isDir(st.mode)) walk(p); else out.push({ path: p, size: st.size, mtime: +st.mtime });
      }
    };
    walk(dir); return out;
  }

  /* ---------- libretro environment callback ---------- */
  onEnv(rawCmd, data) {
    const cmd = rawCmd & 0xffff; const M = this.M;
    if (rawCmd === (44 | 0x10000)) return 0; // SET_HW_SHARED_CONTEXT (shares the number 44 with SET_SERIALIZATION_QUIRKS)
    try {
      switch (cmd) {
        case ENV.GET_CAN_DUPE: M.HEAPU8[data] = 1; return 1;
        case ENV.SET_ROTATION: case ENV.SET_PERFORMANCE_LEVEL: case ENV.SET_INPUT_DESCRIPTORS:
          if (cmd === ENV.SET_INPUT_DESCRIPTORS) this.readDescriptors(data);
          return 1;
        case ENV.SET_MESSAGE: { const dv = this.dv(); const msg = this.cstr(dv.getUint32(data, true)); toast(msg); log('out', '[core] ' + msg); return 1; }
        case ENV.SET_MESSAGE_EXT: { const dv = this.dv(); const msg = this.cstr(dv.getUint32(data, true)); toast(msg); log('out', '[core] ' + msg); return 1; }
        case ENV.SHUTDOWN: if (this.onShutdown) setTimeout(this.onShutdown, 0); return 1;
        case ENV.GET_SYSTEM_DIRECTORY: case ENV.GET_CORE_ASSETS_DIRECTORY: this.dv().setUint32(data, this.cstrPtr('/system'), true); return 1;
        case ENV.GET_SAVE_DIRECTORY: this.dv().setUint32(data, this.cstrPtr('/saves'), true); return 1;
        case ENV.SET_PIXEL_FORMAT: this.pixelFormat = this.dv().getInt32(data, true); return 1;
        case ENV.SET_HW_RENDER: return this.setupHwRender(data);
        case ENV.GET_VARIABLE: return this.getVariable(data);
        case ENV.SET_VARIABLES: this.parseVariables(data); return 1;
        case ENV.GET_VARIABLE_UPDATE: M.HEAPU8[data] = this.optDirty ? 1 : 0; this.optDirty = false; return 1;
        case ENV.SET_SUPPORT_NO_GAME: return 1;
        case ENV.GET_LOG_INTERFACE: this.dv().setUint32(data, this.cb.log, true); return 1;
        case ENV.SET_SYSTEM_AV_INFO: this.readAvInfo(data); return 1;
        case ENV.SET_GEOMETRY: this.readGeometry(data); return 1;
        case ENV.SET_CONTROLLER_INFO: case ENV.SET_SERIALIZATION_QUIRKS: return 1;
        case ENV.GET_LANGUAGE: this.dv().setUint32(data, 0, true); return 1; // English
        case ENV.GET_INPUT_DEVICE_CAPABILITIES: { const dv = this.dv(); dv.setUint32(data, (1 << 1) | (1 << 5), true); dv.setUint32(data + 4, 0, true); return 1; }
        case ENV.GET_JIT_CAPABLE: M.HEAPU8[data] = 1; return 1;
        case ENV.GET_INPUT_BITMASKS: return 1;
        case ENV.GET_INPUT_MAX_USERS: this.dv().setUint32(data, 4, true); return 1;
        case ENV.GET_CORE_OPTIONS_VERSION: this.dv().setUint32(data, 2, true); return 1;
        case ENV.SET_CORE_OPTIONS: this.parseOptionsV1(data); return 1;
        case ENV.SET_CORE_OPTIONS_INTL: this.parseOptionsV1(this.dv().getUint32(data, true)); return 1;
        case ENV.SET_CORE_OPTIONS_V2: this.parseOptionsV2(data); return 1;
        case ENV.SET_CORE_OPTIONS_V2_INTL: this.parseOptionsV2(this.dv().getUint32(data, true)); return 1;
        case ENV.SET_CORE_OPTIONS_DISPLAY: case ENV.SET_CORE_OPTIONS_UPDATE_DISPLAY_CALLBACK: return 1;
        case ENV.GET_PREFERRED_HW_RENDER: this.dv().setUint32(data, 4, true); return 1; // OpenGL ES 3
        default: return 0;
      }
    } catch (e) { log('err', 'env cmd ' + cmd + ': ' + (e && e.message)); return 0; }
  }

  readDescriptors(p) {
    const dv = this.dv(); this.descriptors = [];
    for (let i = 0; i < 128; i++) {
      const o = p + i * 20; const desc = dv.getUint32(o + 16, true);
      if (!desc) break;
      this.descriptors.push({ port: dv.getUint32(o, true), device: dv.getUint32(o + 4, true), index: dv.getUint32(o + 8, true), id: dv.getUint32(o + 12, true), text: this.cstr(desc) });
    }
  }

  /* ---------- core options ---------- */
  parseVariables(p) {
    const dv = this.dv(); const out = [];
    for (let i = 0; i < 512; i++) {
      const key = dv.getUint32(p + i * 8, true); if (!key) break;
      const val = this.cstr(dv.getUint32(p + i * 8 + 4, true));
      const sep = val.indexOf('; ');
      const vals = (sep >= 0 ? val.slice(sep + 2) : val).split('|');
      out.push({ key: this.cstr(key), desc: sep >= 0 ? val.slice(0, sep) : this.cstr(key), info: '', values: vals.map((v) => ({ value: v, label: v })), def: vals[0] });
    }
    this.options = out;
  }
  readValues(base, defPtr) {
    const dv = this.dv(); const vals = [];
    for (let j = 0; j < 128; j++) {
      const vp = dv.getUint32(base + j * 8, true); if (!vp) break;
      const lp = dv.getUint32(base + j * 8 + 4, true);
      vals.push({ value: this.cstr(vp), label: lp ? this.cstr(lp) : this.cstr(vp) });
    }
    return { vals, def: defPtr ? this.cstr(defPtr) : (vals[0] ? vals[0].value : '') };
  }
  parseOptionsV1(p) {
    const dv = this.dv(); const out = [];
    for (let i = 0; i < 1024; i++) {
      const o = p + i * 1040; const key = dv.getUint32(o, true); if (!key) break;
      const { vals, def } = this.readValues(o + 12, dv.getUint32(o + 12 + 1024, true));
      out.push({ key: this.cstr(key), desc: this.cstr(dv.getUint32(o + 4, true)), info: this.cstr(dv.getUint32(o + 8, true)), values: vals, def });
    }
    this.options = out;
  }
  parseOptionsV2(p) {
    const dv = this.dv(); const defs = dv.getUint32(p + 4, true); const out = [];
    for (let i = 0; i < 1024; i++) {
      const o = defs + i * 1052; const key = dv.getUint32(o, true); if (!key) break;
      const { vals, def } = this.readValues(o + 24, dv.getUint32(o + 24 + 1024, true));
      out.push({ key: this.cstr(key), desc: this.cstr(dv.getUint32(o + 4, true)), info: this.cstr(dv.getUint32(o + 12, true)), values: vals, def });
    }
    this.options = out;
  }
  getVariable(p) {
    const dv = this.dv(); const key = this.cstr(dv.getUint32(p, true));
    const opt = this.options.find((o) => o.key === key);
    if (!opt) return 0;
    let v = this.optValues[key];
    if (v === undefined || (opt.values.length && !opt.values.some((x) => x.value === v))) v = opt.def;
    dv.setUint32(p + 4, this.cstrPtr(v), true); return 1;
  }
  setOption(key, value) {
    this.optValues[key] = value; this.optDirty = true; prefs.set('opt', this.optValues);
  }

  /* ---------- video ---------- */
  readGeometry(p) {
    const dv = this.dv(); const g = this.geom;
    g.w = dv.getUint32(p, true); g.h = dv.getUint32(p + 4, true); g.maxW = dv.getUint32(p + 8, true); g.maxH = dv.getUint32(p + 12, true);
    const a = dv.getFloat32(p + 16, true); g.aspect = a > 0 ? a : g.w / g.h;
    if (this.gl && this.fbo && (g.maxW > this.fbo.w || g.maxH > this.fbo.h)) this.makeFbo(g.maxW, g.maxH);
    if (this.onGeometry) this.onGeometry();
  }
  readAvInfo(p) {
    this.readGeometry(p); const dv = this.dv();
    this.fps = dv.getFloat64(p + 24, true) || 60; this.sampleRate = dv.getFloat64(p + 32, true) || 44100;
  }
  setupHwRender(p) {
    const dv = this.dv(); const type = dv.getUint32(p, true);
    if (type !== 2 && type !== 4 && type !== 5) { log('err', 'core requested unsupported GL context type ' + type); return 0; }
    this.hw = { bottomLeft: !!dv.getUint8(p + 18), reset: dv.getUint32(p + 4, true), destroy: dv.getUint32(p + 32, true) };
    if (!this.gl) {
      const attrs = { majorVersion: 2, minorVersion: 0, alpha: false, depth: false, stencil: false, antialias: false, premultipliedAlpha: false,
        preserveDrawingBuffer: true, powerPreference: 'high-performance', failIfMajorPerformanceCaveat: false, enableExtensionsByDefault: true };
      const h = this.M.GL.createContext(this.canvas, attrs);
      if (!h) throw new Error('Could not create a WebGL2 context');
      this.M.GL.makeContextCurrent(h);
      this.gl = this.M.ctx; this.glHandle = h;
      const dbg = this.gl.getExtension('WEBGL_debug_renderer_info');
      if (dbg) log('out', 'GPU: ' + this.gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL));
    }
    dv.setUint32(p + 8, this.cb.getFb, true); dv.setUint32(p + 12, this.cb.getProc, true);
    return 1;
  }
  makeFbo(w, h) {
    const gl = this.gl, GL = this.M.GL;
    const prevFb = gl.getParameter(gl.FRAMEBUFFER_BINDING), prevRb = gl.getParameter(gl.RENDERBUFFER_BINDING), prevTex = gl.getParameter(gl.TEXTURE_BINDING_2D);
    if (this.fbo) { gl.deleteFramebuffer(this.fbo.fb); gl.deleteTexture(this.fbo.tex); gl.deleteRenderbuffer(this.fbo.rb); GL.framebuffers[this.fbo.id] = null; }
    const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    const rb = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, rb); gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH24_STENCIL8, w, h);
    const fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_STENCIL_ATTACHMENT, gl.RENDERBUFFER, rb);
    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    gl.bindFramebuffer(gl.FRAMEBUFFER, prevFb); gl.bindRenderbuffer(gl.RENDERBUFFER, prevRb); gl.bindTexture(gl.TEXTURE_2D, prevTex);
    if (status !== gl.FRAMEBUFFER_COMPLETE) throw new Error('Render target is incomplete (0x' + status.toString(16) + ')');
    const id = GL.getNewId(GL.framebuffers); fb.name = id; GL.framebuffers[id] = fb;
    this.fbo = { fb, tex, rb, id, w, h };
    log('out', 'render target ' + w + 'x' + h);
  }
  getCurrentFb() {
    if (!this.fbo) this.makeFbo(Math.max(this.geom.maxW, 640), Math.max(this.geom.maxH, 480));
    return this.fbo.id;
  }
  onVideo(data, w, h, pitch) {
    this.frames++; this.statFrames++;
    if (!w || !h) return;
    if ((data | 0) === -1) { this.blitHw(w, h); return; }
    if (data === 0) return;
    this.blitSoftware(data, w, h, pitch);
  }
  blitHw(w, h) {
    const gl = this.gl; if (!gl || !this.fbo) return;
    this.sw.hidden = true; this.canvas.hidden = false;
    if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; }
    const scissor = gl.isEnabled(gl.SCISSOR_TEST);
    const rd = gl.getParameter(gl.READ_FRAMEBUFFER_BINDING), dr = gl.getParameter(gl.DRAW_FRAMEBUFFER_BINDING);
    if (scissor) gl.disable(gl.SCISSOR_TEST);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, this.fbo.fb); gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
    const flip = this.hw && !this.hw.bottomLeft;
    gl.blitFramebuffer(0, 0, w, h, 0, flip ? h : 0, w, flip ? 0 : h, gl.COLOR_BUFFER_BIT, gl.NEAREST);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, rd); gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, dr);
    if (scissor) gl.enable(gl.SCISSOR_TEST);
  }
  blitSoftware(ptr, w, h, pitch) {
    const M = this.M; this.canvas.hidden = true; this.sw.hidden = false;
    if (this.sw.width !== w || this.sw.height !== h) { this.sw.width = w; this.sw.height = h; }
    const ctx = this.sw.getContext('2d'); const img = ctx.createImageData(w, h); const o = img.data;
    const heap = M.HEAPU8, dv = new DataView(heap.buffer);
    for (let y = 0; y < h; y++) {
      let s = ptr + y * pitch, d = y * w * 4;
      for (let x = 0; x < w; x++, d += 4) {
        if (this.pixelFormat === 1) { o[d] = heap[s + 2]; o[d + 1] = heap[s + 1]; o[d + 2] = heap[s]; s += 4; }
        else if (this.pixelFormat === 2) { const v = dv.getUint16(s, true); o[d] = ((v >> 11) & 31) * 255 / 31; o[d + 1] = ((v >> 5) & 63) * 255 / 63; o[d + 2] = (v & 31) * 255 / 31; s += 2; }
        else { const v = dv.getUint16(s, true); o[d] = ((v >> 10) & 31) * 255 / 31; o[d + 1] = ((v >> 5) & 31) * 255 / 31; o[d + 2] = (v & 31) * 255 / 31; s += 2; }
        o[d + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  /* ---------- audio ---------- */
  ensureAudio() {
    if (this.audio) return;
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    try { this.audio = new AC({ latencyHint: 'interactive' }); } catch { this.audio = new AC(); }
    this.gain = this.audio.createGain(); this.gain.gain.value = this.muted ? 0 : this.volume; this.gain.connect(this.audio.destination);
  }
  setVolume(v) { this.volume = v; prefs.set('volume', v); if (this.gain) this.gain.gain.value = this.muted ? 0 : v; }
  setMuted(m) { this.muted = m; prefs.set('muted', m); if (this.gain) this.gain.gain.value = m ? 0 : this.volume; }
  pushAudio(frames, getL, getR) {
    const ac = this.audio; if (!ac || !frames || this.turbo) return;
    if (ac.state !== 'running') return;
    const buf = ac.createBuffer(2, frames, this.sampleRate); const l = buf.getChannelData(0), r = buf.getChannelData(1);
    for (let i = 0; i < frames; i++) { l[i] = getL(i); r[i] = getR(i); }
    const src = ac.createBufferSource(); src.buffer = buf; src.connect(this.gain);
    const now = ac.currentTime;
    if (this.audioNext < now + 0.01) this.audioNext = now + 0.06;       // underrun: re-buffer a little
    if (this.audioNext > now + 0.35) return;                             // too far ahead: drop to keep latency low
    src.start(this.audioNext); this.audioNext += frames / this.sampleRate;
  }
  onAudioBatch(ptr, frames) {
    const h16 = this.M.HEAP16, base = ptr >> 1;
    this.pushAudio(frames, (i) => h16[base + 2 * i] / 32768, (i) => h16[base + 2 * i + 1] / 32768);
    return frames;
  }
  onAudio1(l, r) { this.pushAudio(1, () => l / 32768, () => r / 32768); }

  /* ---------- input ---------- */
  onPoll() {
    const p0 = this.pads[0];
    let mask = 0, lt = 0, rt = 0, ax = 0, ay = 0;
    for (const a of ACTIONS) {
      if (!keysDown.has(keyMap[a.id])) continue;
      if (a.stick) { if (a.stick[0] === 0) ax += a.stick[1]; else ay += a.stick[1]; } else { mask |= 1 << a.bit; if (a.bit === RJ.L2) lt = 32767; if (a.bit === RJ.R2) rt = 32767; }
    }
    const k = (ax && ay) ? 0.7071 : 1;
    const base = { mask, trig: [lt, rt], ax: [Math.round(ax * k * 32767), Math.round(ay * k * 32767), 0, 0] };
    for (let i = 1; i < 4; i++) { const p = this.pads[i]; p.mask = 0; p.ax = [0, 0, 0, 0]; p.trig = [0, 0]; }
    Object.assign(p0, { mask: base.mask, trig: base.trig, ax: base.ax });
    const gps = navigator.getGamepads ? navigator.getGamepads() : [];
    let slot = 0;
    for (const gp of gps) {
      if (!gp || !gp.connected || slot > 3) continue;
      const p = this.pads[slot++];
      gp.buttons.forEach((b, i) => {
        const bit = PAD_BUTTONS[i]; if (bit === undefined || !(b.pressed || b.value > 0.5)) return;
        p.mask |= 1 << bit;
        if (bit === RJ.L2) p.trig[0] = Math.max(p.trig[0], Math.round(b.value * 32767));
        if (bit === RJ.R2) p.trig[1] = Math.max(p.trig[1], Math.round(b.value * 32767));
      });
      const dz = (v) => { const a = Math.abs(v); return a < 0.18 ? 0 : Math.sign(v) * Math.min(1, (a - 0.18) / 0.82); };
      const lx = dz(gp.axes[0] || 0), ly = dz(gp.axes[1] || 0);
      if (lx || ly) { p.ax[0] = Math.round(lx * 32767); p.ax[1] = Math.round(ly * 32767); }
    }
  }
  onInput(port, device, index, id) {
    const p = this.pads[port]; if (!p) return 0;
    switch (device & 0xff) {
      case 1: return id === 256 ? (p.mask & 0xffff) : (p.mask >> id) & 1;
      case 5:
        if (index === 0) return id === 0 ? p.ax[0] : id === 1 ? p.ax[1] : 0;
        if (index === 1) return 0;
        if (index === 2) return id === RJ.L2 ? p.trig[0] : id === RJ.R2 ? p.trig[1] : 0;
        return 0;
      default: return 0;
    }
  }

  /* ---------- lifecycle ---------- */
  boot(mainPath) {
    const M = this.M;
    this.cb = {
      env: M.addFunction((c, d) => this.onEnv(c, d), 'iii'),
      video: M.addFunction((d, w, h, p) => this.onVideo(d, w, h, p), 'viiii'),
      audio1: M.addFunction((l, r) => this.onAudio1(l, r), 'vii'),
      audioB: M.addFunction((p, f) => this.onAudioBatch(p, f), 'iii'),
      poll: M.addFunction(() => this.onPoll(), 'v'),
      input: M.addFunction((a, b, c, d) => this.onInput(a, b, c, d), 'iiiii'),
      log: M.addFunction((lv, f, va) => { const msg = cformat(M, f, va); log(lv >= 3 ? 'err' : lv === 2 ? 'warn' : 'out', '[core] ' + msg); }, 'viii'),
      getFb: M.addFunction(() => this.getCurrentFb(), 'i'),
      getProc: M.addFunction((p) => M._emscripten_GetProcAddress(p), 'ii'),
    };
    M._retro_set_environment(this.cb.env);
    M._retro_init();
    M._retro_set_video_refresh(this.cb.video);
    M._retro_set_audio_sample(this.cb.audio1);
    M._retro_set_audio_sample_batch(this.cb.audioB);
    M._retro_set_input_poll(this.cb.poll);
    M._retro_set_input_state(this.cb.input);

    // system info
    const si = M._malloc(32); M._retro_get_system_info(si);
    const dv0 = this.dv();
    log('out', 'core: ' + this.cstr(dv0.getUint32(si, true)) + ' ' + this.cstr(dv0.getUint32(si + 4, true)) + ' (accepts: ' + this.cstr(dv0.getUint32(si + 8, true)) + ')');
    M._free(si);

    // load the game (the core reads it from the in-memory FS by path)
    const gi = M._malloc(16); const dv = this.dv();
    dv.setUint32(gi, this.cstrPtr(mainPath), true); dv.setUint32(gi + 4, 0, true); dv.setUint32(gi + 8, 0, true); dv.setUint32(gi + 12, 0, true);
    const ok = M._retro_load_game(gi); M._free(gi);
    if (!ok) throw new Error('The emulator could not load this game. Check the log for details.');

    const av = M._malloc(48); M._retro_get_system_av_info(av); this.readAvInfo(av); M._free(av);
    log('out', `video ${this.geom.w}x${this.geom.h} (max ${this.geom.maxW}x${this.geom.maxH}) @ ${this.fps.toFixed(2)} fps, audio ${this.sampleRate} Hz`);
    if (this.hw) {
      if (!this.fbo) this.makeFbo(Math.max(this.geom.maxW, 64), Math.max(this.geom.maxH, 64));
      if (this.hw.reset) M.dynCall('v', this.hw.reset);
    }
  }
  start() {
    this.running = true; this.last = performance.now(); this.acc = 0;
    this.raf = requestAnimationFrame(this.tickFn);
  }
  tick(now) {
    if (!this.running) return;
    this.raf = requestAnimationFrame(this.tickFn);
    if (now - this.statT >= 1000) { this.emuFps = this.statFrames * 1000 / (now - this.statT); this.statFrames = 0; this.statT = now; if (this.onStats) this.onStats(this.emuFps); }
    if (this.paused) { this.last = now; return; }
    const frameMs = 1000 / (this.fps * (this.turbo ? 3 : 1));
    this.acc += Math.min(now - this.last, 100); this.last = now;
    let n = 0;
    while (this.acc >= frameMs - 1 && n < 3) {
      if (!this.runFrame()) return;
      this.acc -= frameMs; n++;
    }
    if (this.acc > frameMs * 2) this.acc = 0;
  }
  runFrame() {
    try { this.M._retro_run(); return true; } catch (e) {
      this.lastError = e; this.running = false;
      log('err', 'emulation stopped: ' + (e && e.stack || e));
      if (this.onCrash) this.onCrash(e);
      return false;
    }
  }
  setPaused(p) { this.paused = p; if (!p) { this.last = performance.now(); this.audioNext = 0; } if (this.audio) { if (p) this.audio.suspend(); else this.audio.resume(); } }
  reset() { this.M._retro_reset(); }

  /* ---------- states ---------- */
  saveState() {
    const M = this.M; const size = M._retro_serialize_size(); const p = M._malloc(size);
    try { if (!M._retro_serialize(p, size)) throw new Error('The core refused to save a state.'); return M.HEAPU8.slice(p, p + size); } finally { M._free(p); }
  }
  loadState(bytes) {
    const M = this.M; const p = M._malloc(bytes.length);
    try { M.HEAPU8.set(bytes, p); if (!M._retro_unserialize(p, bytes.length)) throw new Error('The core rejected that save state.'); } finally { M._free(p); }
  }

  /* ---------- persistence of /saves ---------- */
  async restoreSaves() {
    for (const k of await idb.keys('saves')) {
      const bytes = await idb.get('saves', k); if (bytes) this.writeFile('/saves/' + k, bytes);
    }
    for (const f of this.listFiles('/saves')) this.saveStamp.set(f.path, f.mtime + ':' + f.size);
  }
  async flushSaves() {
    for (const f of this.listFiles('/saves')) {
      const stamp = f.mtime + ':' + f.size;
      if (this.saveStamp.get(f.path) === stamp) continue;
      this.saveStamp.set(f.path, stamp);
      await idb.put('saves', f.path.replace(/^\/saves\//, ''), this.M.FS.readFile(f.path));
    }
  }

  destroy() {
    this.running = false; cancelAnimationFrame(this.raf);
    const M = this.M;
    try { M._retro_unload_game(); } catch { /* ignore */ }
    try { M._retro_deinit(); } catch { /* ignore */ }
    try { if (this.audio) this.audio.close(); } catch { /* ignore */ }
    try { const ext = this.gl && this.gl.getExtension('WEBGL_lose_context'); if (ext) ext.loseContext(); } catch { /* ignore */ }
    this.audio = null;
  }
}

/* ======================================================================== *
 * core bootstrap
 * ======================================================================== */
let coreFactory = null, wasmModule = null;

async function prepareCore() {
  const glue = dec.decode(await streamBytes(b64ToBytes($('core-glue').textContent.trim()), 'gzip', 'd'));
  const wasm = await streamBytes(b64ToBytes($('core-wasm').textContent.trim()), 'gzip', 'd');
  wasmModule = await WebAssembly.compile(wasm);
  const url = URL.createObjectURL(new Blob([glue], { type: 'text/javascript' }));
  try { coreFactory = (await import(url)).default; } finally { URL.revokeObjectURL(url); }
}
function newModule() {
  return coreFactory({
    instantiateWasm(imports, done) { WebAssembly.instantiate(wasmModule, imports).then((inst) => done(inst, wasmModule)); return {}; },
    print: (t) => log('out', t), printErr: (t) => log('warn', t),
  });
}

function checkSupport() {
  const problems = [];
  if (typeof WebAssembly !== 'object') problems.push('WebAssembly');
  try { if (!document.createElement('canvas').getContext('webgl2')) problems.push('WebGL2 (enable hardware acceleration in your browser)'); } catch { problems.push('WebGL2'); }
  if (typeof DecompressionStream !== 'function') problems.push('DecompressionStream (update your browser)');
  return problems;
}

/* ======================================================================== *
 * session: game start / stop
 * ======================================================================== */
let host = null, gameId = '', gameName = '', slot = prefs.get('slot', 1), saveTimer = 0, panelPausedGame = false;

async function loadBiosInto(h) {
  for (const k of await idb.keys('bios')) { const b = await idb.get('bios', k); if (b) h.writeFile('/system/dc/' + k, b); }
}

async function startFromItems(rawItems) {
  if (!coreFactory) { showError('Still starting up', 'The emulator core has not finished loading yet. Try again in a moment.'); return; }
  showLoading('Reading files...');
  let h = null;
  try {
    if (host) await ejectGame(true);
    const items = await expandZips(rawItems);
    const cands = pickMain(items);
    if (!cands.length) throw new Error('I could not find a Dreamcast game in those files.\n\nLook for a .gdi (with its track files), .cdi, .chd, .cue, .iso or .elf file.');
    hideLoading();
    const main = cands.length === 1 ? cands[0] : await askWhich(cands);
    if (!main) return;
    showLoading('Starting emulator core...');
    await raf();
    const M = await newModule();
    const canvasOld = $('gl'); const canvas = document.createElement('canvas'); canvas.id = 'gl'; canvasOld.replaceWith(canvas);
    h = new Host(M, canvas, $('sw'));
    h.mkdirp('/system/dc'); h.mkdirp('/saves'); h.mkdirp('/game');
    await loadBiosInto(h); await h.restoreSaves();

    // mount game files
    const dir = main.path.includes('/') ? main.path.replace(/[^/]+$/, '') : '';
    const mainExt = extOf(main.path);
    const siblings = items.filter((i) => (i.path.includes('/') ? i.path.replace(/[^/]+$/, '') : '') === dir).map((i) => baseName(i.path));
    let done = 0;
    for (const it of items) {
      showLoading(`Loading ${baseName(it.path)} (${++done}/${items.length})...`);
      await tick();
      let bytes = it.data || new Uint8Array(await it.file.arrayBuffer());
      if (it === main && (mainExt === 'gdi' || mainExt === 'cue')) bytes = enc.encode(fixSheet(dec.decode(bytes), mainExt, siblings));
      h.writeFile('/game/' + cleanPath(it.path), bytes);
    }
    gameName = stripExt(main.path); gameId = gameName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    showLoading('Booting ' + gameName + '...'); await raf(); await tick();

    h.onCrash = (e) => { showError('The emulator stopped', 'The game crashed the emulator core (' + (e && e.message || e) + '). Open Settings > Log for details.'); };
    h.onShutdown = () => ejectGame();
    h.onStats = (f) => { const el = $('hud'); if (!el.hidden) el.textContent = f.toFixed(0) + ' fps'; };
    h.onGeometry = layout;
    h.ensureAudio();
    h.boot('/game/' + cleanPath(main.path));
    host = h; h = null;
    window.__dcp = { host };
    $('home').hidden = true; $('stage').hidden = false; hideLoading();
    layout(); wakeToolbar();
    host.start();
    setTimeout(() => { if (host && host.audio && host.audio.state !== 'running' && !host.paused) $('soundGate').hidden = false; }, 700);
    saveTimer = setInterval(() => host && host.flushSaves().catch(() => {}), 8000);
    $('tbSave').textContent = `Save state (${slot})`; $('tbLoad').textContent = `Load state (${slot})`;
    toast('Playing ' + gameName + ' - press Esc for settings');
  } catch (e) {
    hideLoading();
    if (h) { try { h.destroy(); } catch { /* ignore */ } }
    $('stage').hidden = true; $('home').hidden = false;
    const msg = (e && e.message) || String(e);
    const mem = (e && e.name === 'RangeError') || /allocation|out of memory|not readable/i.test(msg);
    showError('Could not start the game', mem
      ? 'The browser ran out of memory loading this game. Close other tabs/apps and try again, or use a smaller format such as .chd.\n\n(' + msg + ')'
      : msg);
  }
}

async function ejectGame(silent) {
  if (!host) return;
  clearInterval(saveTimer);
  const h = host; host = null; window.__dcp = {};
  try { await h.flushSaves(); } catch { /* ignore */ }
  h.destroy();
  $('panel').hidden = true; $('soundGate').hidden = true; $('pausedBadge').hidden = true;
  if (!silent) { $('stage').hidden = true; $('home').hidden = false; }
}

/* ======================================================================== *
 * layout, toolbar, fullscreen
 * ======================================================================== */
function layout() {
  const screen = $('screen'); if (!host) return;
  const mode = prefs.get('aspect', 'core'); const W = window.innerWidth, H = window.innerHeight;
  let a = host.geom.aspect || 4 / 3;
  if (mode === '4:3') a = 4 / 3; else if (mode === '16:9') a = 16 / 9;
  if (mode === 'fill') { screen.style.width = W + 'px'; screen.style.height = H + 'px'; return; }
  let w = W, h = W / a; if (h > H) { h = H; w = H * a; }
  screen.style.width = Math.floor(w) + 'px'; screen.style.height = Math.floor(h) + 'px';
  $('stage').classList.toggle('pixel', prefs.get('pixel', false));
}
window.addEventListener('resize', layout);

let idleTimer = 0;
function wakeToolbar() {
  $('toolbar').classList.remove('idle'); $('stage').classList.remove('idle');
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => { if ($('panel').hidden) { $('toolbar').classList.add('idle'); $('stage').classList.add('idle'); } }, 2800);
}
['mousemove', 'mousedown', 'touchstart'].forEach((ev) => $('stage').addEventListener(ev, wakeToolbar, { passive: true }));

function toggleFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen(); else $('stage').requestFullscreen && $('stage').requestFullscreen().catch(() => {});
}
document.addEventListener('fullscreenchange', layout);

function togglePause(force) {
  if (!host) return;
  const p = typeof force === 'boolean' ? force : !host.paused;
  host.setPaused(p); $('pausedBadge').hidden = !p; $('tbPause').textContent = p ? 'Resume' : 'Pause';
}

async function saveStateNow() {
  if (!host) return;
  try {
    const raw = host.saveState(); const gz = await streamBytes(raw, 'gzip', 'c');
    await idb.put('states', `${gameId}#${slot}`, { gz, size: raw.length, at: Date.now() });
    toast(`Saved state to slot ${slot} (${fmtBytes(gz.length)})`);
  } catch (e) { showError('Could not save state', e.message || String(e)); }
}
async function loadStateNow() {
  if (!host) return;
  const rec = await idb.get('states', `${gameId}#${slot}`);
  if (!rec) { toast(`Slot ${slot} is empty`); return; }
  try { host.loadState(await streamBytes(rec.gz, 'gzip', 'd')); toast(`Loaded slot ${slot}`); } catch (e) { showError('Could not load state', e.message || String(e)); }
}
function screenshot() {
  if (!host) return;
  const c = host.sw.hidden ? host.canvas : host.sw;
  c.toBlob((b) => b && download(b, `${gameName || 'dreamcast'}-${Date.now()}.png`), 'image/png');
}

$('tbPause').onclick = () => togglePause();
$('tbReset').onclick = () => { if (host) { host.reset(); toast('Console reset'); } };
$('tbSave').onclick = saveStateNow;
$('tbLoad').onclick = loadStateNow;
$('tbShot').onclick = screenshot;
$('tbMute').onclick = () => { if (!host) return; host.setMuted(!host.muted); $('tbMute').textContent = host.muted ? 'Unmute' : 'Mute'; };
$('tbFull').onclick = toggleFullscreen;
$('tbSettings').onclick = () => openPanel('controls');
$('tbEject').onclick = () => ejectGame();
$('soundOk').onclick = () => { $('soundGate').hidden = true; if (host && host.audio) host.audio.resume(); };
$('errorOk').onclick = () => { $('errorBox').hidden = true; };
$('errorLog').onclick = () => { $('errorBox').hidden = true; openPanel('log'); };

/* ======================================================================== *
 * keyboard
 * ======================================================================== */
let capturing = null;
window.addEventListener('keydown', (e) => {
  if (capturing) {
    e.preventDefault();
    if (e.code !== 'Escape') { keyMap[capturing.id] = e.code; prefs.set('keys', keyMap); }
    capturing.done(); capturing = null; return;
  }
  const t = e.target; if (t && (t.tagName === 'SELECT' || (t.tagName === 'INPUT' && t.type !== 'file' && t.type !== 'range'))) return;
  if (!host) return;
  if (e.code === 'Escape') { if (!document.fullscreenElement) { e.preventDefault(); $('panel').hidden ? openPanel('controls') : closePanel(); } return; }
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const mapped = Object.values(keyMap).includes(e.code);
  if (mapped) { e.preventDefault(); keysDown.add(e.code); return; }
  switch (e.code) {
    case 'KeyP': togglePause(); break;
    case 'F5': e.preventDefault(); saveStateNow(); break;
    case 'F8': e.preventDefault(); loadStateNow(); break;
    case 'F12': e.preventDefault(); screenshot(); break;
    case 'KeyM': $('tbMute').click(); break;
    case 'KeyF': toggleFullscreen(); break;
    case 'Tab': e.preventDefault(); if (host) host.turbo = true; break;
    default: break;
  }
});
window.addEventListener('keyup', (e) => { keysDown.delete(e.code); if (e.code === 'Tab' && host) host.turbo = false; });
window.addEventListener('blur', () => { keysDown.clear(); if (host) host.turbo = false; });
window.addEventListener('gamepadconnected', (e) => toast('Gamepad connected: ' + e.gamepad.id.slice(0, 40)));
document.addEventListener('visibilitychange', () => { if (document.hidden && host) host.flushSaves().catch(() => {}); });
window.addEventListener('pagehide', () => { if (host) host.flushSaves().catch(() => {}); });
['pointerdown', 'keydown'].forEach((ev) => window.addEventListener(ev, () => { if (host && host.audio && host.audio.state === 'suspended' && !host.paused) host.audio.resume().then(() => { $('soundGate').hidden = true; }).catch(() => {}); }, { capture: true }));

/* ======================================================================== *
 * settings panel
 * ======================================================================== */
const TABS = [['controls', 'Controls'], ['display', 'Display & audio'], ['options', 'Game options'], ['data', 'Saves & BIOS'], ['log', 'Log'], ['about', 'About']];
let currentTab = 'controls';

function openPanel(tab) {
  $('panel').hidden = false; wakeToolbar();
  if (host && !host.paused) { panelPausedGame = true; togglePause(true); }
  renderTabs(tab || currentTab);
}
function closePanel() {
  $('panel').hidden = true;
  if (host && panelPausedGame) { panelPausedGame = false; togglePause(false); }
  wakeToolbar();
}
$('panelClose').onclick = closePanel;

function renderTabs(tab) {
  currentTab = tab; const bar = $('tabs'); bar.textContent = '';
  for (const [id, label] of TABS) {
    const b = document.createElement('button'); b.textContent = label; b.setAttribute('role', 'tab'); b.setAttribute('aria-selected', String(id === tab));
    b.onclick = () => renderTabs(id); bar.appendChild(b);
  }
  const body = $('tabbody'); body.textContent = '';
  Promise.resolve(({ controls: tabControls, display: tabDisplay, options: tabOptions, data: tabData, log: tabLog, about: tabAbout })[tab](body)).catch((e) => log('err', 'settings: ' + (e && e.message)));
}
const el = (tag, props = {}, ...kids) => { const e = Object.assign(document.createElement(tag), props); for (const k of kids) e.append(k); return e; };
function field(label, control, hint) {
  const l = el('label', {}, label); if (hint) l.append(el('small', { textContent: hint }));
  return el('div', { className: 'field' }, l, control);
}
function select(opts, value, onchange) {
  const s = el('select'); for (const [v, t] of opts) s.append(el('option', { value: v, textContent: t, selected: String(v) === String(value) })); s.onchange = () => onchange(s.value); return s;
}

function tabControls(body) {
  body.append(el('div', { className: 'note', textContent: 'Click a key, then press the new key. Gamepads work automatically - plug one in and press a button. Hold Tab for fast-forward.' }));
  const grid = el('div', { className: 'pad' });
  for (const a of ACTIONS) {
    const b = el('button', { className: 'keybtn', textContent: keyMap[a.id] });
    b.onclick = () => { b.textContent = 'press a key...'; b.classList.add('listening'); capturing = { id: a.id, done: () => { b.textContent = keyMap[a.id]; b.classList.remove('listening'); } }; };
    grid.append(field(a.label, b));
  }
  body.append(grid, el('div', { className: 'sect', textContent: 'Shortcuts' }),
    el('div', { className: 'note', innerHTML: 'Esc settings &middot; P pause &middot; F fullscreen &middot; M mute &middot; F5 save state &middot; F8 load state &middot; F12 screenshot &middot; Tab (hold) fast-forward' }));
  const reset = el('button', { textContent: 'Restore default keys' }); reset.onclick = () => { keyMap = Object.fromEntries(ACTIONS.map((a) => [a.id, a.def])); prefs.set('keys', keyMap); renderTabs('controls'); };
  body.append(el('div', { className: 'row', style: 'justify-content:flex-start' }, reset));
}
function tabDisplay(body) {
  body.append(field('Screen shape', select([['core', 'Automatic'], ['4:3', '4:3 (original TV)'], ['16:9', '16:9 stretched'], ['fill', 'Fill window']], prefs.get('aspect', 'core'), (v) => { prefs.set('aspect', v); layout(); })));
  body.append(field('Pixel filter', select([['false', 'Smooth'], ['true', 'Sharp pixels']], String(prefs.get('pixel', false)), (v) => { prefs.set('pixel', v === 'true'); layout(); })));
  const vol = el('input', { type: 'range', min: 0, max: 1, step: 0.05, value: host ? host.volume : prefs.get('volume', 0.8) }); vol.oninput = () => host && host.setVolume(+vol.value);
  body.append(field('Volume', vol));
  const fps = el('input', { type: 'checkbox', checked: !$('hud').hidden }); fps.onchange = () => { $('hud').hidden = !fps.checked; };
  body.append(field('Show FPS counter', fps));
  body.append(el('div', { className: 'note', textContent: 'Rendering resolution and other emulation settings are under "Game options" while a game is running.' }));
}
function tabOptions(body) {
  if (!host || !host.options.length) { body.append(el('div', { className: 'note', textContent: 'Start a game to see its emulation options (resolution, region, controller type...).' })); return; }
  body.append(el('div', { className: 'note', textContent: 'Changes apply immediately; a few (marked by the core) need Reset. They are remembered between sessions.' }));
  for (const o of host.options) {
    const cur = host.optValues[o.key] ?? o.def;
    const s = select(o.values.map((v) => [v.value, v.label]), cur, (v) => host.setOption(o.key, v));
    body.append(field(o.desc || o.key, s, o.info));
  }
  const r = el('button', { textContent: 'Reset all options to defaults' }); r.onclick = () => { host.optValues = {}; prefs.set('opt', {}); host.optDirty = true; renderTabs('options'); };
  body.append(el('div', { className: 'row', style: 'justify-content:flex-start' }, r));
}
async function tabData(body) {
  body.append(el('div', { className: 'sect', textContent: 'Save-state slot' }));
  body.append(field('Slot used by Save / Load', select([1, 2, 3, 4, 5].map((n) => [n, 'Slot ' + n]), slot, (v) => { slot = +v; prefs.set('slot', slot); $('tbSave').textContent = `Save state (${slot})`; $('tbLoad').textContent = `Load state (${slot})`; })));

  body.append(el('div', { className: 'sect', textContent: 'BIOS files (optional)' }));
  body.append(el('div', { className: 'note', textContent: 'The built-in HLE BIOS runs many games. For best compatibility add dc_boot.bin and dc_flash.bin from your own console, then turn off "HLE BIOS" in Game options.' }));
  const keys = await idb.keys('bios');
  body.append(el('div', {}, ...(keys.length ? keys.map((k) => el('span', { className: 'pill ok', textContent: k + ' ' })) : [el('span', { className: 'pill', textContent: 'none added' })])));
  const addB = el('button', { textContent: 'Add BIOS files...' }); addB.onclick = () => $('biosInput').click();
  const clrB = el('button', { textContent: 'Remove BIOS files' }); clrB.onclick = async () => { for (const k of await idb.keys('bios')) await idb.del('bios', k); renderTabs('data'); refreshBiosStatus(); };
  body.append(el('div', { className: 'row', style: 'justify-content:flex-start' }, addB, clrB));

  body.append(el('div', { className: 'sect', textContent: 'Memory card (VMU) & game saves' }));
  if (host) { try { await host.flushSaves(); } catch { /* ignore */ } }
  const saves = await idb.keys('saves');
  if (!saves.length) body.append(el('div', { className: 'note', textContent: 'No save files yet. They appear once a game writes to its memory card.' }));
  for (const k of saves) {
    const dl = el('button', { textContent: 'Download' }); dl.onclick = async () => download(new Blob([await idb.get('saves', k)]), baseName(k));
    const rm = el('button', { textContent: 'Delete' }); rm.onclick = async () => { if (confirm('Delete ' + k + '?')) { await idb.del('saves', k); renderTabs('data'); } };
    body.append(el('div', { className: 'field' }, el('label', { textContent: k }), el('div', { className: 'row', style: 'margin:0;justify-content:flex-end' }, dl, rm)));
  }
  const imp = el('button', { textContent: 'Import save files...' }); imp.onclick = () => $('saveInput').click();
  body.append(el('div', { className: 'row', style: 'justify-content:flex-start' }, imp), el('div', { className: 'note', textContent: 'Imported saves load the next time you start a game. Names must match what Flycast uses (e.g. vmu_save_A1.bin).' }));
}
function tabLog(body) {
  const box = el('div', { id: 'log' }); for (const l of logLines) appendLog(box, l); body.append(box);
  const c = el('button', { textContent: 'Copy log' }); c.onclick = () => navigator.clipboard && navigator.clipboard.writeText(logLines.map((l) => l.text).join('\n')).then(() => toast('Log copied'));
  body.append(el('div', { className: 'row', style: 'justify-content:flex-start' }, c));
}
function tabAbout(body) {
  body.append(el('div', { className: 'note', innerHTML:
    'Dreamcast Player is a small front-end around <b>Flycast</b> (GPL-2.0-or-later, &copy; the Flycast contributors), running as WebAssembly. ' +
    'Source for the emulator core: <a href="https://github.com/flyinghead/flycast" target="_blank" rel="noopener" style="color:var(--accent2)">github.com/flyinghead/flycast</a>. ' +
    'The WebAssembly build used here is the <code>__CORE_VERSION__</code> npm package (<a href="https://github.com/monteslu/romdev" target="_blank" rel="noopener" style="color:var(--accent2)">build scripts</a>). ' +
    'Because the core is GPL-licensed, this program is offered under the same terms, with no warranty.' }));
  body.append(el('div', { className: 'note', textContent: 'No games or console firmware are included. Use only discs and BIOS dumps from hardware you own. Everything stays on your computer - the page makes no network requests.' }));
}

/* BIOS / save import */
async function importInto(store, input, rename) {
  for (const f of input.files) {
    const bytes = new Uint8Array(await f.arrayBuffer());
    await idb.put(store, rename ? rename(f.name) : f.name, bytes);
  }
  input.value = ''; toast('Imported'); if (!$('panel').hidden) renderTabs(currentTab); refreshBiosStatus();
}
$('biosInput').onchange = () => importInto('bios', $('biosInput'), (n) => n.toLowerCase());
$('saveInput').onchange = () => importInto('saves', $('saveInput'));
async function refreshBiosStatus() {
  const keys = await idb.keys('bios');
  $('biosStatus').textContent = keys.length ? 'BIOS files added: ' + keys.join(', ') : 'Built-in HLE BIOS works for many games. Add real BIOS files for best compatibility.';
}
$('btnBiosHome').onclick = () => $('biosInput').click();
$('aboutLink').onclick = (e) => { e.preventDefault(); $('home').hidden = false; openPanel('about'); };

/* ======================================================================== *
 * home screen: file picking + drag & drop
 * ======================================================================== */
$('btnFiles').onclick = (e) => { e.stopPropagation(); $('fileInput').click(); };
$('btnFolder').onclick = (e) => { e.stopPropagation(); $('dirInput').click(); };
$('drop').onclick = () => $('fileInput').click();
$('drop').onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('fileInput').click(); } };
for (const id of ['fileInput', 'dirInput']) {
  $(id).onchange = () => { const items = entriesFromInput($(id)); $(id).value = ''; if (items.length) startFromItems(items); };
}
['dragenter', 'dragover'].forEach((ev) => window.addEventListener(ev, (e) => { e.preventDefault(); if (!host) $('drop').classList.add('over'); }));
['dragleave', 'drop'].forEach((ev) => window.addEventListener(ev, (e) => { e.preventDefault(); if (ev === 'drop' || e.target === document.documentElement) $('drop').classList.remove('over'); }));
window.addEventListener('drop', async (e) => {
  e.preventDefault(); $('drop').classList.remove('over');
  if (host) { toast('Eject the current game first to load another'); return; }
  const items = await entriesFromDrop(e.dataTransfer);
  if (items.length) startFromItems(items);
});

/* ======================================================================== *
 * boot
 * ======================================================================== */
(async function main() {
  window.__dcp = {};
  window.__dcpLog = () => logLines.map((l) => l.kind + ': ' + l.text).join('\n');
  const problems = checkSupport();
  if (problems.length) { const c = $('compat'); c.hidden = false; c.textContent = 'This browser is missing: ' + problems.join(', ') + '. Try the latest Chrome, Edge or Firefox.'; }
  $('home').hidden = false;
  refreshBiosStatus();
  showLoading('Unpacking emulator core...');
  try { await prepareCore(); hideLoading(); log('out', 'core ready'); } catch (e) { hideLoading(); showError('Could not start the emulator core', (e && e.message) || String(e)); }
  window.__dcpReady = true;
  window.__dcpTest = { readZip, fixSheet, cformat, pickMain, posix, cleanPath, Host };
})();

})();
