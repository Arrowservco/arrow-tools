import { expect, test } from "@playwright/test";

/**
 * Acceptance flow (spec §25): Demo screenshot → extraction review → research →
 * separate Auction / Instant Win results → protection toggle → promotion change
 * → instant recalculation → save → appears in History.
 */
test("demo screenshot end-to-end evaluation", async ({ page }) => {
  // 1. Open app.
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "BidLens" })).toBeVisible();

  // 2. Select the Demo screenshot.
  await page.getByTestId("demo-button").click();

  // 3. Confirm the extracted Zircon values on the review screen.
  const summary = page.getByTestId("review-summary");
  await expect(summary).toBeVisible({ timeout: 20_000 });
  await expect(summary).toContainText("Zircon SuperScan ID One Touch Stud Finder");
  await expect(summary).toContainText("Open Box");
  await expect(summary).toContainText("$1.00"); // current auction bid
  await expect(summary).toContainText("$56.00"); // Instant Win
  await expect(summary).toContainText("$70.00"); // est. retail
  await expect(summary).toContainText("$7.00"); // protection amount (off)
  await expect(summary).toContainText("Off");

  // 4. Continue through research.
  await page.getByTestId("confirm-research").click();

  // 5. Separate Auction and Instant Win results.
  await expect(page.getByTestId("verdict-headline")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("note").filter({ hasText: "Demo data, not live market evidence." })).toBeVisible();
  await expect(page.getByTestId("auction-card")).toBeVisible();
  await expect(page.getByTestId("instant-win-card")).toBeVisible();
  await expect(page.getByTestId("instant-win-price")).toHaveText("$56.00");
  // The $56 Instant Win cannot clear the $20/50%/75% floors → not a buy.
  await expect(page.getByTestId("instant-win-card")).toContainText(/PASS|INSUFFICIENT/);

  const consNet = page.getByTestId("metric-conservative-net");
  const netBefore = await consNet.textContent();

  // 6. Toggle the $7 purchase protection on → conservative net drops.
  await page.getByTestId("protection-switch").click();
  await expect(consNet).not.toHaveText(netBefore!, { timeout: 10_000 });
  const netWithProtection = await consNet.textContent();
  await page.getByTestId("protection-switch").click(); // back off
  await expect(consNet).toHaveText(netBefore!);
  expect(netWithProtection).not.toBe(netBefore);

  // 7. Change promotion from 5% to 2% → profitability recalculates instantly.
  await page.getByTestId("promo-2").click();
  await expect(consNet).not.toHaveText(netBefore!);
  const netAt2 = await consNet.textContent();
  expect(netAt2).not.toBe(netBefore);
  // 8. And back to 5% restores the original figure (deterministic math).
  await page.getByTestId("promo-5").click();
  await expect(consNet).toHaveText(netBefore!);

  // 9. Save the evaluation.
  await page.getByTestId("save-evaluation").click();
  await expect(page.getByTestId("save-evaluation")).toContainText("Saved");

  // 10. Confirm it appears in History.
  await page.goto("/history");
  const item = page.getByTestId("history-item").first();
  await expect(item).toBeVisible();
  await expect(item).toContainText("Zircon SuperScan ID One Touch Stud Finder");
  await expect(item).toContainText("DEMO");
});
