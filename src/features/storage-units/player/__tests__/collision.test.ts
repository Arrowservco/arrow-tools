import { describe, expect, it } from "vitest";
import { resolveCollision, WallIndex } from "../collision";
import type { WallBox } from "../../world/walls";

describe("resolveCollision", () => {
  it("leaves position unchanged when nothing overlaps", () => {
    const walls: WallBox[] = [{ cx: 10, cz: 10, halfX: 1, halfZ: 0.15, variant: 0, cellX: 0, cellY: 0 }];
    const [x, z] = resolveCollision(0, 0, 0.35, walls);
    expect(x).toBe(0);
    expect(z).toBe(0);
  });

  it("pushes the player out along the shortest axis when overlapping a wall", () => {
    // Horizontal wall segment centered at z=0, spanning x in [-1, 1], thin in z.
    const walls: WallBox[] = [{ cx: 0, cz: 0, halfX: 1, halfZ: 0.15, variant: 0, cellX: 0, cellY: 0 }];
    const [x, z] = resolveCollision(0, 0.1, 0.35, walls);
    expect(x).toBeCloseTo(0, 5); // pushed straight out along z, not sideways
    expect(Math.abs(z)).toBeGreaterThanOrEqual(0.15 + 0.35 - 1e-6);
  });

  it("keeps the player out of the wall at a corner formed by two segments", () => {
    const walls: WallBox[] = [
      { cx: 0, cz: 0, halfX: 1, halfZ: 0.15, variant: 0, cellX: 0, cellY: 0 }, // horizontal
      { cx: 1, cz: 1, halfX: 0.15, halfZ: 1, variant: 0, cellX: 0, cellY: 0 }, // vertical
    ];
    const [x, z] = resolveCollision(0.9, 0.2, 0.35, walls);
    const closestX1 = Math.max(-1, Math.min(x, 1));
    const closestZ1 = Math.max(-0.15, Math.min(z, 0.15));
    const dist1 = Math.hypot(x - closestX1, z - closestZ1);
    expect(dist1).toBeGreaterThanOrEqual(0.35 - 1e-6);
  });
});

describe("WallIndex", () => {
  it("finds a wall from either side of the boundary it sits on", () => {
    const walls: WallBox[] = [{ cx: 4, cz: 2, halfX: 0.15, halfZ: 2, variant: 0, cellX: 0, cellY: 0 }];
    const index = new WallIndex(walls);
    expect(index.nearby(3.9, 2).length).toBeGreaterThan(0);
    expect(index.nearby(4.1, 2).length).toBeGreaterThan(0);
  });

  it("returns nothing far from any wall", () => {
    const walls: WallBox[] = [{ cx: 4, cz: 2, halfX: 0.15, halfZ: 2, variant: 0, cellX: 0, cellY: 0 }];
    const index = new WallIndex(walls);
    expect(index.nearby(100, 100)).toHaveLength(0);
  });
});
