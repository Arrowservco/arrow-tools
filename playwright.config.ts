import { defineConfig, devices } from "@playwright/test";
import fs from "node:fs";

// Use the environment's preinstalled Chromium when the default download is absent.
const preinstalledChromium = "/opt/pw-browsers/chromium";
const executablePath =
  process.env.BIDLENS_CHROMIUM ?? (fs.existsSync(preinstalledChromium) ? preinstalledChromium : undefined);

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
    ...devices["Pixel 7"],
    launchOptions: executablePath ? { executablePath } : {},
  },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
