export const SECTOR_SIZE = 4; // cells per light sector, per §8 of the design plan

export const WAKE_DURATION = 0.25;
export const TIMEOUT_HOLD = 12;
export const FADE_DURATION = 1.5;

type SectorPhase = "dark" | "waking" | "lit" | "timeout" | "fading";

interface SectorState {
  phase: SectorPhase;
  timer: number;
  intensity: number;
}

export function sectorKey(sectorX: number, sectorY: number): string {
  return `${sectorX},${sectorY}`;
}

export function cellToSector(cellX: number, cellY: number): [number, number] {
  return [Math.floor(cellX / SECTOR_SIZE), Math.floor(cellY / SECTOR_SIZE)];
}

/**
 * The motion-sensor light system: a sector wakes when the player enters it or a
 * neighboring sector, holds while active, then times out and fades once the player has
 * moved on — so the way forward is always lit a step ahead and the way back goes dark
 * behind you. See design-plan §8.
 */
export class LightSectorSystem {
  private sectors = new Map<string, SectorState>();
  private isDead: (sectorX: number, sectorY: number) => boolean;

  constructor(isDead?: (sectorX: number, sectorY: number) => boolean) {
    this.isDead = isDead ?? (() => false);
  }

  private get(key: string): SectorState {
    let s = this.sectors.get(key);
    if (!s) {
      s = { phase: "dark", timer: 0, intensity: 0 };
      this.sectors.set(key, s);
    }
    return s;
  }

  /** Advances the simulation by dt seconds given the player's current cell. */
  update(dt: number, playerCellX: number, playerCellY: number): void {
    const [psx, psy] = cellToSector(playerCellX, playerCellY);
    const active = new Set<string>();
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        active.add(sectorKey(psx + dx, psy + dy));
      }
    }
    // Sectors that have never been touched don't need bookkeeping until they become
    // active or a neighbor is queried; only advance sectors already tracked plus newly
    // active ones.
    for (const key of active) this.get(key);

    for (const [key, s] of this.sectors) {
      const [sx, sy] = key.split(",").map(Number);
      if (this.isDead(sx, sy)) continue;
      this.advance(s, dt, active.has(key));
    }
  }

  /**
   * Steps one sector forward by dt seconds, looping across phase boundaries so a large
   * dt (e.g. a dropped frame) still lands on the correct phase/intensity instead of
   * getting stuck at the start of whichever phase it entered.
   */
  private advance(s: SectorState, dt: number, isActive: boolean): void {
    let remaining = dt;
    while (remaining > 0) {
      switch (s.phase) {
        case "dark": {
          if (!isActive) {
            s.intensity = 0;
            return;
          }
          s.phase = "waking";
          s.timer = 0;
          break;
        }
        case "waking": {
          const need = WAKE_DURATION - s.timer;
          if (remaining < need) {
            s.timer += remaining;
            s.intensity = s.timer / WAKE_DURATION;
            return;
          }
          remaining -= need;
          s.phase = "lit";
          s.timer = 0;
          s.intensity = 1;
          break;
        }
        case "lit": {
          s.intensity = 1;
          if (isActive) return;
          s.phase = "timeout";
          s.timer = 0;
          break;
        }
        case "timeout": {
          if (isActive) {
            s.phase = "lit";
            s.timer = 0;
            s.intensity = 1;
            return;
          }
          const need = TIMEOUT_HOLD - s.timer;
          if (remaining < need) {
            s.timer += remaining;
            s.intensity = 1;
            return;
          }
          remaining -= need;
          s.phase = "fading";
          s.timer = 0;
          break;
        }
        case "fading": {
          if (isActive) {
            s.phase = "lit";
            s.timer = 0;
            s.intensity = 1;
            return;
          }
          const need = FADE_DURATION - s.timer;
          if (remaining < need) {
            s.timer += remaining;
            s.intensity = Math.max(0, 1 - s.timer / FADE_DURATION);
            return;
          }
          remaining -= need;
          s.phase = "dark";
          s.timer = 0;
          s.intensity = 0;
          return;
        }
      }
    }
  }

  intensityAt(sectorX: number, sectorY: number): number {
    if (this.isDead(sectorX, sectorY)) return 0;
    return this.sectors.get(sectorKey(sectorX, sectorY))?.intensity ?? 0;
  }

  intensityAtCell(cellX: number, cellY: number): number {
    const [sx, sy] = cellToSector(cellX, cellY);
    return this.intensityAt(sx, sy);
  }
}
