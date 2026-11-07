// Unit tests for the pure helpers in src/app.js. Runs app.js inside a stubbed DOM (vm) and
// never touches the emulator core. Also verifies the integrity of the built dreamcast.html.
//   node tools/dreamcast/test/unit.cjs
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), zlib = require('node:zlib');
const crypto = require('node:crypto'), assert = require('node:assert/strict'), { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');

/* ---- 1. built-file integrity ---- */
const html = fs.readFileSync(path.join(root, 'dreamcast.html'), 'utf8');
const grab = (id) => new RegExp('<script type="application/octet-stream" id="' + id + '">([^<]*)</script>').exec(html)[1];
const wasm = zlib.gunzipSync(Buffer.from(grab('core-wasm'), 'base64'));
const glue = zlib.gunzipSync(Buffer.from(grab('core-glue'), 'base64')).toString();
assert.equal(crypto.createHash('sha256').update(wasm).digest('hex'), '72f7f6e3052b7bac923d4fdfed2507530ab9a66aafc90479b99029ea67fab0c8', 'embedded wasm hash');
assert.ok(!glue.includes('NODERAWFS is currently only supported'), 'NODERAWFS guard removed');
assert.ok(glue.includes('if(ENVIRONMENT_IS_NODE)for(var _key in NODERAWFS)'), 'NODERAWFS override gated');
assert.ok(!html.includes('__CORE_') && !html.includes('/*__APP__*/'), 'all template placeholders replaced');
console.log('ok  built file integrity (wasm sha256 pinned, glue patched)');

/* ---- 2. load app.js with a stub DOM ---- */
const stub = () => new Proxy(function () {}, {
  get(t, p) { if (p in t) return t[p]; if (p === 'textContent') return ''; if (p === 'classList') return { add() {}, remove() {}, toggle() {} }; if (p === 'style') return {}; if (p === Symbol.toPrimitive) return () => ''; return stub(); },
  set(t, p, v) { t[p] = v; return true; }, apply() { return stub(); },
});
const sandbox = { console, TextEncoder, TextDecoder, Blob, Response, DecompressionStream, CompressionStream, WebAssembly, URL, DataView, Uint8Array,
  performance, setTimeout, clearTimeout, setInterval, clearInterval, requestAnimationFrame() { return 0; }, cancelAnimationFrame() {},
  localStorage: { _d: {}, getItem(k) { return this._d[k] ?? null; }, setItem(k, v) { this._d[k] = v; } }, navigator: {}, confirm: () => true, atob: (s) => Buffer.from(s, 'base64').toString('binary') };
sandbox.window = sandbox; sandbox.globalThis = sandbox;
sandbox.document = { getElementById: () => stub(), createElement: () => stub(), addEventListener() {}, body: stub(), documentElement: stub(), hidden: false };
sandbox.addEventListener = () => {}; sandbox.innerWidth = 1000; sandbox.innerHeight = 800;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(root, 'src', 'app.js'), 'utf8'), sandbox);
(async () => {
  for (let i = 0; i < 50 && !sandbox.__dcpTest; i++) await new Promise((r) => setTimeout(r, 20));
  const T = sandbox.__dcpTest; assert.ok(T, 'test hooks present');

  /* path shim vs node */
  const np = path.posix;
  for (const p of ['/a/b/../c', 'a//b/./c/', '/', '', '../x', '/a/b/c/']) assert.equal(T.posix.normalize(p), np.normalize(p), 'normalize ' + p);
  for (const p of ['/a/b/c', '/a', 'a', '/a/b/']) assert.equal(T.posix.dirname(p), np.dirname(p), 'dirname ' + p);
  assert.equal(T.posix.basename('/a/b/c.txt', '.txt'), 'c');
  assert.equal(T.posix.relative('/a/b', '/a/c/d'), np.relative('/a/b', '/a/c/d'));
  assert.equal(T.posix.resolve('/a', 'b', '../c'), np.resolve('/a', 'b', '../c'));
  assert.equal(T.cleanPath('../../etc/./passwd'), 'etc/passwd');
  console.log('ok  path shim + path sanitising');

  /* gdi / cue case repair */
  const gdi = '3\n1 0 4 2352 "Track01.bin" 0\n2 756 0 2352 track02.raw 0\n3 45000 4 2352 TRACK03.BIN 0\n';
  const fixed = T.fixSheet(gdi, 'gdi', ['track01.bin', 'track02.raw', 'track03.bin']);
  assert.ok(fixed.includes('"track01.bin"') && fixed.includes(' track03.bin ') && fixed.includes('track02.raw'), fixed);
  const cue = 'FILE "Game (Track 1).BIN" BINARY\n  TRACK 01 MODE2/2352\n';
  assert.ok(T.fixSheet(cue, 'cue', ['Game (Track 1).bin']).includes('"Game (Track 1).bin"'));
  console.log('ok  gdi/cue track-name repair');

  /* main file selection */
  const names = (a) => Array.from(a, (x) => x.path).sort();
  assert.deepEqual(names(T.pickMain([{ path: 'g/disc.gdi' }, { path: 'g/track01.bin' }, { path: 'g/track03.bin' }])), ['g/disc.gdi']);
  assert.deepEqual(names(T.pickMain([{ path: 'a.chd' }, { path: 'b.cdi' }])), ['b.cdi']);
  assert.deepEqual(names(T.pickMain([{ path: 'x.txt' }])), []);
  console.log('ok  main-file selection');

  /* zip reader against a real zip (python zipfile: one stored, one deflated) */
  const tmp = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'dcz-'));
  const zpath = path.join(tmp, 't.zip');
  execFileSync('python3', ['-c', `import zipfile,sys;z=zipfile.ZipFile(sys.argv[1],'w');z.writestr('a/stored.bin',b'hello'*10,zipfile.ZIP_STORED);z.writestr('deflated.txt',b'dreamcast '*5000,zipfile.ZIP_DEFLATED);z.close()`, zpath]);
  const entries = await T.readZip(new Uint8Array(fs.readFileSync(zpath)));
  const byName = Object.fromEntries(entries.map((e) => [e.path, Buffer.from(e.data).toString()]));
  assert.equal(byName['a/stored.bin'], 'hello'.repeat(10)); assert.equal(byName['deflated.txt'], 'dreamcast '.repeat(5000));
  await assert.rejects(() => T.readZip(new Uint8Array(10)), /valid .zip/);
  console.log('ok  zip reader (stored + deflate + error)');

  /* printf over mock wasm memory */
  const mem = new Uint8Array(4096); const dv = new DataView(mem.buffer); const put = (o, s) => { Buffer.from(s + '\0').copy(mem, o); };
  put(100, '%s has %d items, %5.2f%% (%x) %c [%04d]\n'); put(200, 'queue');
  dv.setInt32(300, 200, true); dv.setInt32(304, 42, true); dv.setFloat64(312, 87.456, true); dv.setInt32(320, 255, true); dv.setInt32(324, 65, true); dv.setInt32(328, 7, true);
  assert.equal(T.cformat({ HEAPU8: mem }, 100, 300), 'queue has 42 items, 87.46% (ff) A [0007]');
  console.log('ok  C printf formatter');

  /* libretro struct parsing: core options v2 / v1 / legacy variables, input descriptors, geometry */
  const H = (m) => { const h = Object.create(T.Host.prototype); h.M = { HEAPU8: m, HEAP16: new Int16Array(m.buffer), _malloc() { return 0; } }; h.options = []; h.strCache = new Map(); h.geom = { w: 0, h: 0, maxW: 0, maxH: 0, aspect: 0 }; return h; };
  const m2 = new Uint8Array(1 << 16); const d2 = new DataView(m2.buffer); const w = (o, s) => { Buffer.from(s + '\0').copy(m2, o); };
  w(5000, 'flycast_res'); w(5020, 'Resolution'); w(5040, 'Render scale'); w(5100, '640x480'); w(5110, '1280x960'); w(5120, '640x480');
  const defsAt = 8192; d2.setUint32(0, 0, true); d2.setUint32(4, defsAt, true);
  d2.setUint32(defsAt, 5000, true); d2.setUint32(defsAt + 4, 5020, true); d2.setUint32(defsAt + 12, 5040, true);
  d2.setUint32(defsAt + 24, 5100, true); d2.setUint32(defsAt + 24 + 8, 5110, true); d2.setUint32(defsAt + 24 + 1024, 5120, true);
  const h2 = H(m2); h2.parseOptionsV2(0);
  assert.deepEqual(JSON.parse(JSON.stringify(h2.options)), [{ key: 'flycast_res', desc: 'Resolution', info: 'Render scale', values: [{ value: '640x480', label: '640x480' }, { value: '1280x960', label: '1280x960' }], def: '640x480' }]);
  // legacy "Desc; a|b|c" variables
  const m3 = new Uint8Array(4096); const d3 = new DataView(m3.buffer); Buffer.from('opt_a\0Region; Japan|USA|Europe\0').copy(m3, 200); d3.setUint32(0, 200, true); d3.setUint32(4, 206, true);
  const h3 = H(m3); h3.parseVariables(0); assert.equal(h3.options[0].desc, 'Region'); assert.deepEqual(Array.from(h3.options[0].values, (v) => v.value), ['Japan', 'USA', 'Europe']);
  // input descriptor (20-byte records)
  const m4 = new Uint8Array(4096); const d4 = new DataView(m4.buffer); Buffer.from('Cross\0').copy(m4, 900);
  d4.setUint32(0, 0, true); d4.setUint32(4, 1, true); d4.setUint32(8, 0, true); d4.setUint32(12, 0, true); d4.setUint32(16, 900, true);
  const h4 = H(m4); h4.readDescriptors(0); assert.deepEqual(JSON.parse(JSON.stringify(h4.descriptors)), [{ port: 0, device: 1, index: 0, id: 0, text: 'Cross' }]);
  // geometry + av info
  const m5 = new Uint8Array(4096); const d5 = new DataView(m5.buffer);
  [640, 480, 1280, 960].forEach((v, i) => d5.setUint32(i * 4, v, true)); d5.setFloat32(16, 4 / 3, true); d5.setFloat64(24, 59.94, true); d5.setFloat64(32, 44100, true);
  const h5 = H(m5); h5.readAvInfo(0); assert.equal(h5.geom.maxH, 960); assert.ok(Math.abs(h5.fps - 59.94) < 1e-9 && h5.sampleRate === 44100);
  console.log('ok  libretro struct parsing (options v2, legacy vars, descriptors, av_info)');

  /* input mapping */
  const hi = H(new Uint8Array(16)); hi.pads = [{ mask: (1 << 0) | (1 << 12), ax: [1000, -2000, 0, 0], trig: [32767, 0] }];
  assert.equal(hi.onInput(0, 1, 0, 0), 1); assert.equal(hi.onInput(0, 1, 0, 8), 0); assert.equal(hi.onInput(0, 1, 0, 256), (1 << 0) | (1 << 12));
  assert.equal(hi.onInput(0, 5, 0, 0), 1000); assert.equal(hi.onInput(0, 5, 0, 1), -2000); assert.equal(hi.onInput(0, 5, 2, 12), 32767); assert.equal(hi.onInput(3, 1, 0, 0), 0);
  console.log('ok  input state mapping');
  console.log('\nall unit checks passed');
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
