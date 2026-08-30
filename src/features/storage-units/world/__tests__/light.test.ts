import { describe, expect, it } from "vitest";
import { cellToSector, FADE_DURATION, LightSectorSystem, sectorKey, TIMEOUT_HOLD, WAKE_DURATION } from "../light";

describe("cellToSector / sectorKey", () => {
  it("groups cells into sectors of SECTOR_SIZE", () => {
    expect(cellToSector(0, 0)).toEqual([0, 0]);
    expect(cellToSector(3, 3)).toEqual([0, 0]);
    expect(cellToSector(4, 0)).toEqual([1, 0]);
  });

  it("formats a stable key", () => {
    expect(sectorKey(1, -2)).toBe("1,-2");
  });
});

describe("LightSectorSystem", () => {
  it("starts every sector dark", () => {
    const sys = new LightSectorSystem();
    expect(sys.intensityAt(0, 0)).toBe(0);
  });

  it("wakes the player's sector over WAKE_DURATION", () => {
    const sys = new LightSectorSystem();
    sys.update(WAKE_DURATION / 2, 0, 0);
    expect(sys.intensityAtCell(0, 0)).toBeGreaterThan(0);
    expect(sys.intensityAtCell(0, 0)).toBeLessThan(1);
    sys.update(WAKE_DURATION, 0, 0);
    expect(sys.intensityAtCell(0, 0)).toBe(1);
  });

  it("wakes the neighboring sector one ahead, not just the current one", () => {
    const sys = new LightSectorSystem();
    sys.update(WAKE_DURATION * 2, 0, 0); // sector (0,0)
    // Sector (1,0) covers cells 4-7; it should already be waking/lit as a neighbor.
    expect(sys.intensityAtCell(4, 0)).toBeGreaterThan(0);
  });

  it("holds lit while the player remains, then times out and fades after they leave", () => {
    const sys = new LightSectorSystem();
    sys.update(WAKE_DURATION * 2, 0, 0);
    expect(sys.intensityAtCell(0, 0)).toBe(1);

    // Move far away so sector (0,0) is no longer active.
    sys.update(0.1, 100, 100);
    expect(sys.intensityAtCell(0, 0)).toBe(1); // still in TIMEOUT hold

    sys.update(TIMEOUT_HOLD + 0.01, 100, 100);
    // Now fading.
    const midFade = sys.intensityAtCell(0, 0);
    expect(midFade).toBeLessThan(1);
    expect(midFade).toBeGreaterThan(0);

    sys.update(FADE_DURATION + 0.01, 100, 100);
    expect(sys.intensityAtCell(0, 0)).toBe(0);
  });

  it("re-lights immediately if the player returns during the timeout hold", () => {
    const sys = new LightSectorSystem();
    sys.update(WAKE_DURATION * 2, 0, 0);
    sys.update(1, 100, 100); // now in timeout
    sys.update(0.01, 0, 0); // back in range
    expect(sys.intensityAtCell(0, 0)).toBe(1);
  });

  it("never lights a dead sector", () => {
    const sys = new LightSectorSystem((sx, sy) => sx === 0 && sy === 0);
    sys.update(WAKE_DURATION * 5, 0, 0);
    expect(sys.intensityAtCell(0, 0)).toBe(0);
  });
});
