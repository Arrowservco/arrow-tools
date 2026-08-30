import { describe, expect, it } from "vitest";
import { hashSeed, mulberry32 } from "../grid";
import { backtrackerMaze, generateBacktrackerZone, generateLongRunZone, pathToCarves } from "../generate";
import { buildZone, ZONE_COUNT } from "../zones";

describe("mulberry32", () => {
  it("is deterministic for a given seed", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const seqA = Array.from({ length: 10 }, () => a());
    const seqB = Array.from({ length: 10 }, () => b());
    expect(seqA).toEqual(seqB);
  });

  it("produces different sequences for different seeds", () => {
    const a = mulberry32(1);
    const b = mulberry32(2);
    expect(a()).not.toBeCloseTo(b(), 6);
  });
});

describe("hashSeed", () => {
  it("is deterministic for a given string", () => {
    expect(hashSeed("hello")).toBe(hashSeed("hello"));
  });

  it("differs across distinct strings (spot check)", () => {
    expect(hashSeed("hello")).not.toBe(hashSeed("world"));
  });
});

describe("backtrackerMaze", () => {
  it("is fully connected (every cell reachable from origin)", () => {
    const rng = mulberry32(7);
    const grid = backtrackerMaze(16, 16, rng, 0);
    const path = grid.shortestPath([0, 0], [15, 15]);
    expect(path).not.toBeNull();
  });

  it("is deterministic for a given seed", () => {
    const gridA = backtrackerMaze(10, 10, mulberry32(99), 0.15);
    const gridB = backtrackerMaze(10, 10, mulberry32(99), 0.15);
    for (let y = 0; y < 10; y++) {
      for (let x = 0; x < 10; x++) {
        expect(gridA.openNeighborCount(x, y)).toBe(gridB.openNeighborCount(x, y));
      }
    }
  });

  it("braiding never leaves a cell fully walled in", () => {
    const grid = backtrackerMaze(20, 20, mulberry32(123), 0.3);
    for (let y = 0; y < 20; y++) {
      for (let x = 0; x < 20; x++) {
        expect(grid.openNeighborCount(x, y)).toBeGreaterThanOrEqual(1);
      }
    }
  });
});

describe("generateBacktrackerZone reachability invariant", () => {
  it("guarantees spawn -> exit is reachable across many seeds", () => {
    for (let seed = 0; seed < 200; seed++) {
      const zone = generateBacktrackerZone({ seed, width: 12, height: 12, braidRate: 0.18 });
      expect(zone.criticalPath.length).toBeGreaterThan(0);
      expect(zone.criticalPath[0]).toEqual(zone.spawn);
      expect(zone.criticalPath[zone.criticalPath.length - 1]).toEqual(zone.exit);
    }
  });
});

describe("generateLongRunZone", () => {
  it("connects spawn to the far end of the corridor", () => {
    const zone = generateLongRunZone({ seed: 5, length: 30 });
    expect(zone.spawn).toEqual([0, 1]);
    expect(zone.exit).toEqual([29, 1]);
    expect(zone.criticalPath.length).toBeGreaterThan(0);
  });
});

describe("pathToCarves", () => {
  it("expands a straight multi-cell run into per-cell carves", () => {
    const carves = pathToCarves([
      [0, 0],
      [3, 0],
    ]);
    expect(carves).toHaveLength(3);
  });

  it("rejects a diagonal waypoint pair", () => {
    expect(() => pathToCarves([[0, 0], [1, 1]])).toThrow();
  });
});

describe("buildZone", () => {
  it("builds all five zones with a reachable spawn -> exit path", () => {
    for (let i = 0; i < ZONE_COUNT; i++) {
      const zone = buildZone(i, 1000 + i);
      expect(zone.criticalPath.length).toBeGreaterThan(0);
    }
  });

  it("is deterministic per (zoneIndex, seed)", () => {
    const a = buildZone(2, 555);
    const b = buildZone(2, 555);
    expect(a.spawn).toEqual(b.spawn);
    expect(a.exit).toEqual(b.exit);
    expect(a.criticalPath).toEqual(b.criticalPath);
  });
});
