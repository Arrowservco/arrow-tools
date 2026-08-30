import { FloorMaterial } from "./grid";
import {
  type GeneratedZone,
  generateAuthoredZone,
  generateBacktrackerZone,
  generateLongRunZone,
  pathToCarves,
} from "./generate";

export const ZONE_COUNT = 5;

export const ZONE_NAMES = [
  "The Aisle",
  "The Long Run",
  "Climate Control",
  "Sublevel",
  "The Office",
] as const;

export interface ZoneVisuals {
  wallColor: string;
  floorColor: string;
  ceilingGap: boolean; // true = open plenum with cage, false = closed office-style ceiling
  emergencyLighting: boolean;
  ambience: "aisle" | "hvac" | "hum" | "sublevel" | "office";
}

export const ZONE_VISUALS: Record<number, ZoneVisuals> = {
  0: { wallColor: "#b9b5a8", floorColor: "#6f6f6a", ceilingGap: true, emergencyLighting: false, ambience: "aisle" },
  1: { wallColor: "#b9b5a8", floorColor: "#6f6f6a", ceilingGap: true, emergencyLighting: false, ambience: "hum" },
  2: { wallColor: "#c9c6ba", floorColor: "#8a7f66", ceilingGap: true, emergencyLighting: false, ambience: "hvac" },
  3: { wallColor: "#96938a", floorColor: "#565853", ceilingGap: true, emergencyLighting: true, ambience: "sublevel" },
  4: { wallColor: "#d8d3c2", floorColor: "#7c6a4f", ceilingGap: false, emergencyLighting: false, ambience: "office" },
};

const AISLE_LAYOUT = {
  width: 12,
  height: 8,
  spawn: [0, 4] as [number, number],
  exit: [11, 4] as [number, number],
  carve: [
    ...pathToCarves([
      [0, 4],
      [2, 4],
      [2, 6],
      [6, 6],
      [6, 2],
      [9, 2],
      [9, 4],
      [11, 4],
    ]),
    // A side alcove: an open, empty unit off the main path.
    ...pathToCarves([
      [2, 4],
      [2, 1],
    ]),
  ],
  setPieces: [[2, 1]] as Array<[number, number]>,
};

const OFFICE_LAYOUT = {
  width: 9,
  height: 6,
  spawn: [0, 3] as [number, number],
  exit: [8, 4] as [number, number],
  carve: pathToCarves([
    [0, 3],
    [3, 3],
    [3, 1],
    [6, 1],
    [6, 4],
    [8, 4],
  ]),
  setPieces: [[6, 1]] as Array<[number, number]>,
};

/** Builds the maze for one zone. Deterministic for a given (zoneIndex, seed). */
export function buildZone(zoneIndex: number, seed: number): GeneratedZone {
  switch (zoneIndex) {
    case 0:
      return generateAuthoredZone(AISLE_LAYOUT);
    case 1: {
      const zone = generateLongRunZone({ seed, length: 60 });
      return zone;
    }
    case 2: {
      const zone = generateBacktrackerZone({
        seed,
        width: 28,
        height: 28,
        braidRate: 0.18,
        floor: FloorMaterial.Carpet,
      });
      return zone;
    }
    case 3: {
      const zone = generateBacktrackerZone({
        seed,
        width: 24,
        height: 24,
        braidRate: 0.18,
        wetFraction: 0.12,
        deadSectorFraction: 0.3,
      });
      return zone;
    }
    case 4:
      return generateAuthoredZone(OFFICE_LAYOUT);
    default:
      throw new Error(`buildZone: unknown zone index ${zoneIndex}`);
  }
}

/** Endless free-roam maze used by Night Audit, once the loop has been completed once. */
export function buildFreeRoamZone(seed: number): GeneratedZone {
  return generateBacktrackerZone({
    seed,
    width: 40,
    height: 40,
    braidRate: 0.2,
  });
}
