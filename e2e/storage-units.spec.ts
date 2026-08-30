import { expect, test } from "@playwright/test";

/**
 * Smoke test for the walkthrough game: the route loads without pulling BidLens's own
 * shell (no bottom nav), the title screen renders, starting a run mounts a WebGL canvas
 * and the HUD, and no console errors surface during the first few seconds of play.
 */
test("storage units route loads, starts a run, and mounts the game canvas", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => consoleErrors.push(err.message));

  await page.goto("/storage-units");

  // Full-bleed route: BidLens's bottom nav must not be present here.
  await expect(page.getByRole("navigation", { name: "Primary" })).toHaveCount(0);

  await expect(page.getByRole("heading", { name: "The Storage Units" })).toBeVisible();
  await expect(page.getByTestId("begin-walkthrough")).toBeVisible();

  await page.getByTestId("begin-walkthrough").click();

  await expect(page.getByTestId("game-hud")).toBeVisible({ timeout: 15_000 });
  const canvas = page.locator("canvas");
  await expect(canvas).toBeVisible();
  const box = await canvas.boundingBox();
  expect(box?.width).toBeGreaterThan(0);
  expect(box?.height).toBeGreaterThan(0);

  // Let a few frames render so any render-loop exception has a chance to surface.
  await page.waitForTimeout(2_000);

  const seriousErrors = consoleErrors.filter((e) => !/WebGL|GPU stall due to ReadPixels/i.test(e));
  expect(seriousErrors, seriousErrors.join("\n")).toEqual([]);
});
