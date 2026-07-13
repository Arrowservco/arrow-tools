/**
 * Generates PWA icons and the Zircon demo screenshot fixture using headless
 * Chromium (via Playwright). Run: node scripts/generate-assets.mjs
 */
import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const iconHtml = (size) => `<!doctype html><html><body style="margin:0">
<div style="width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;
  background:linear-gradient(145deg,#14304f 0%,#0b1524 100%);border-radius:${Math.round(size * 0.18)}px;
  font-family:system-ui,sans-serif">
  <div style="position:relative;width:${size * 0.56}px;height:${size * 0.56}px;border:${Math.max(4, size * 0.05)}px solid #5b8def;border-radius:50%;display:flex;align-items:center;justify-content:center">
    <span style="color:#e7edf5;font-size:${size * 0.26}px;font-weight:800;letter-spacing:-0.03em">$</span>
    <div style="position:absolute;right:-${size * 0.12}px;bottom:-${size * 0.12}px;width:${size * 0.2}px;height:${Math.max(4, size * 0.06)}px;background:#5b8def;border-radius:${size}px;transform:rotate(45deg);transform-origin:left center"></div>
  </div>
</div></body></html>`;

// A faithful mock of the Mac.bid listing screen for the Zircon fixture.
const demoHtml = `<!doctype html><html><body style="margin:0">
<div style="width:430px;height:932px;background:#111827;font-family:system-ui,-apple-system,sans-serif;color:#fff;display:flex;flex-direction:column;overflow:hidden">
  <div style="background:#e5e7eb;height:390px;position:relative;display:flex;align-items:center;justify-content:center">
    <div style="color:#374151;text-align:center">
      <div style="width:130px;height:230px;background:linear-gradient(160deg,#facc15 0%,#eab308 60%,#a16207 100%);border-radius:16px 16px 10px 10px;margin:0 auto;position:relative;box-shadow:0 12px 24px rgba(0,0,0,.25)">
        <div style="position:absolute;top:18px;left:50%;transform:translateX(-50%);width:78px;height:56px;background:#1f2937;border-radius:8px;display:flex;align-items:center;justify-content:center;color:#a5f3fc;font-size:11px;font-weight:700">SCAN</div>
        <div style="position:absolute;bottom:26px;left:50%;transform:translateX(-50%);width:44px;height:70px;background:#1f2937;border-radius:22px"></div>
      </div>
      <p style="margin:14px 0 0;font-size:12px;color:#6b7280">Zircon SuperScan ID stud finder — product photo</p>
    </div>
    <div style="position:absolute;top:16px;left:16px;background:#fff;border-radius:24px;width:44px;height:44px;display:flex;align-items:center;justify-content:center;color:#111;font-size:20px">←</div>
    <div style="position:absolute;top:16px;right:16px;background:#fff;border-radius:24px;padding:10px 16px;color:#111;font-size:15px">☆ 3</div>
  </div>
  <div style="background:#f3f4f6;color:#111827;padding:18px 20px 14px;border-radius:0 0 0 0">
    <span style="background:#2563eb;color:#fff;font-size:12px;font-weight:700;padding:6px 14px;border-radius:16px;letter-spacing:.03em">OPEN BOX</span>
    <h1 style="font-size:27px;line-height:1.2;margin:12px 0 4px;font-weight:700">Zircon SuperScan ID One Touch Stud Finder</h1>
    <p style="margin:0;color:#6b7280;font-size:14px">Lot #DEMO-4821 · Pittsburgh warehouse</p>
  </div>
  <div style="background:#1e293b;flex:1;border-radius:24px 24px 0 0;margin-top:10px;padding:20px">
    <div style="background:#273449;border-radius:14px;padding:16px;display:flex;gap:14px;align-items:center">
      <div style="font-size:34px">🏆</div>
      <div>
        <div style="display:flex;align-items:center;gap:10px">
          <span style="font-size:30px;font-weight:800">$56</span>
          <span style="background:#3b4a63;border-radius:14px;padding:5px 12px;font-size:13px">Instant Win</span>
        </div>
        <p style="margin:6px 0 0;font-size:14px;color:#cbd5e1">Offer Expires: <span style="color:#fbbf24">2d 2h 6m 39s</span></p>
      </div>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin:18px 2px 0">
      <p style="margin:0;font-size:18px"><span style="color:#fbbf24;font-weight:700">$70</span> est. retail</p>
      <p style="margin:0;color:#4ade80;font-size:16px;font-weight:600">99% off</p>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin:16px 2px 0">
      <div style="display:flex;align-items:center;gap:10px;font-size:18px">
        <span>🛡️</span><span style="font-weight:600">$7</span>
        <span style="width:44px;height:26px;background:#475569;border-radius:14px;display:inline-block;position:relative"><span style="position:absolute;left:3px;top:3px;width:20px;height:20px;background:#f8fafc;border-radius:50%"></span></span>
      </div>
      <div style="display:flex;gap:6px;font-size:15px">
        <span style="background:#334155;border-radius:8px;padding:7px 10px">2d</span>
        <span style="background:#334155;border-radius:8px;padding:7px 10px">21h</span>
        <span style="background:#334155;border-radius:8px;padding:7px 10px">16m</span>
        <span style="background:#334155;border-radius:8px;padding:7px 10px">26s</span>
      </div>
    </div>
    <div style="display:flex;gap:12px;margin-top:22px">
      <div style="flex:1;background:#1d4ed8;background:#173a63;color:#7dd3fc;border-radius:26px;padding:16px;text-align:center;font-size:18px;font-weight:600">Max Bid</div>
      <div style="flex:2;background:#4ade80;color:#052e16;border-radius:26px;padding:16px;text-align:center;font-size:19px;font-weight:800">🔨 Bid $1</div>
    </div>
    <p style="text-align:center;color:#93c5fd;margin-top:18px;font-size:15px">✦ Bid. Win. Save!</p>
  </div>
</div></body></html>`;

const browser = await chromium.launch({ executablePath: process.env.BIDLENS_CHROMIUM ?? "/opt/pw-browsers/chromium" });
const page = await browser.newPage();

await mkdir("public/icons", { recursive: true });
await mkdir("public/demo", { recursive: true });

for (const [size, name] of [
  [512, "icon-512.png"],
  [512, "icon-maskable-512.png"],
  [192, "icon-192.png"],
]) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(iconHtml(size));
  await page.screenshot({ path: `public/icons/${name}`, omitBackground: name.includes("maskable") ? false : true });
  console.log(`wrote public/icons/${name}`);
}

await page.setViewportSize({ width: 430, height: 932 });
await page.setContent(demoHtml);
await page.screenshot({ path: "public/demo/macbid-zircon.png" });
console.log("wrote public/demo/macbid-zircon.png");

await browser.close();
