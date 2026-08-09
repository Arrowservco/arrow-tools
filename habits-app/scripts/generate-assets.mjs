/**
 * Generates PWA icons using headless Chromium (via the root repo's Playwright).
 * Run from habits-app/: node scripts/generate-assets.mjs
 */
import { createRequire } from "node:module";
import { mkdir } from "node:fs/promises";

const require = createRequire(new URL("../../package.json", import.meta.url));
const { chromium } = require("@playwright/test");

const iconHtml = (size, maskable) => `<!doctype html><html><body style="margin:0">
<div style="width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;
  background:linear-gradient(145deg,#14304f 0%,#0b1524 100%);border-radius:${maskable ? 0 : Math.round(size * 0.18)}px">
  <svg width="${size * 0.55}" height="${size * 0.55}" viewBox="0 0 24 24" fill="none"
    stroke="#6fd0a5" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>
  </svg>
</div></body></html>`;

const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM ?? undefined,
});
await mkdir(new URL("../public/icons/", import.meta.url), { recursive: true });

for (const [name, size, maskable] of [
  ["icon-192.png", 192, false],
  ["icon-512.png", 512, false],
  ["icon-maskable-512.png", 512, true],
]) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(iconHtml(size, maskable));
  await page.screenshot({
    path: new URL(`../public/icons/${name}`, import.meta.url).pathname,
    omitBackground: !maskable,
  });
  await page.close();
}
await browser.close();
console.log("icons written to public/icons/");
