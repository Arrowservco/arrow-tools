// Smoke test: opens the built dreamcast.html straight from file:// in headless Chromium,
// loads the hand-assembled test ELF (no game data needed), and checks that the Flycast
// core boots, renders frames through WebGL2 and produces the expected framebuffer.
//
//   python3 tools/dreamcast/test/make-test-elf.py /tmp/test.elf
//   node tools/dreamcast/test/smoke.cjs /tmp/test.elf [/tmp/shot.png]
const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require('playwright');

const elf = path.resolve(process.argv[2] || 'test.elf');
const shot = process.argv[3] || null;
const page_url = 'file://' + path.resolve(__dirname, '..', 'dreamcast.html');

(async () => {
  const browser = await chromium.launch({
    args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
  });
  const page = await browser.newPage({ viewport: { width: 1000, height: 760 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

  await page.goto(page_url);
  await page.waitForFunction(() => window.__dcpReady === true, null, { timeout: 60000 });
  console.log('page ready; home visible =', await page.isVisible('#home'));

  await page.setInputFiles('#fileInput', elf);
  try {
    await page.waitForFunction(() => window.__dcp && window.__dcp.host && window.__dcp.host.frames > 30, null, { timeout: 90000 });
  } catch (e) {
    console.log('TIMEOUT waiting for frames');
  }
  await page.waitForTimeout(2500);

  const info = await page.evaluate(() => {
    const h = window.__dcp.host;
    if (!h) return { host: false, err: document.getElementById('errorText').textContent };
    return {
      host: true, frames: h.frames, emuFps: h.emuFps, fps: h.fps, geom: h.geom, canvas: [h.canvas.width, h.canvas.height],
      options: h.options.length, descriptors: h.descriptors.map((d) => `${d.port}/${d.device}/${d.index}/${d.id}=${d.text}`).slice(0, 30),
      audioState: h.audio && h.audio.state, lastError: h.lastError && String(h.lastError),
    };
  });
  console.log(JSON.stringify(info, null, 1));

  const log = await page.evaluate(() => [...document.querySelectorAll('#log div')].map((d) => d.textContent));
  if (!log.length) {
    await page.evaluate(() => document.getElementById('tbSettings').click());
    await page.waitForTimeout(200);
  }
  if (shot) await page.screenshot({ path: shot });
  // sample pixels from the emulator canvas through a 2D copy
  const px = await page.evaluate(() => {
    const h = window.__dcp.host; if (!h) return null;
    const c = document.createElement('canvas'); c.width = h.canvas.width; c.height = h.canvas.height;
    const x = c.getContext('2d'); x.drawImage(h.canvas, 0, 0);
    const pts = [[10, 10], [320, 240], [630, 470], [100, 400], [500, 50]];
    return { size: [c.width, c.height], samples: pts.map(([a, b]) => Array.from(x.getImageData(a, b, 1, 1).data)) };
  });
  console.log('pixels', JSON.stringify(px));
  const logText = await page.evaluate(() => (window.__dcpLog && window.__dcpLog()) || '');
  if (logText) console.log('--- core log ---\n' + logText);
  if (errors.length) console.log('--- page errors ---\n' + errors.join('\n'));
  await browser.close();
  process.exit(info.host && info.frames > 30 ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(2); });
