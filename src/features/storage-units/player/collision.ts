import { CELL_SIZE, type WallBox } from "../world/walls";

/** Buckets walls by grid cell (and the cell across the boundary they sit on) for fast lookup. */
export class WallIndex {
  private buckets = new Map<string, WallBox[]>();

  constructor(walls: WallBox[]) {
    for (const wall of walls) {
      const cellsTouched = this.cellsForWall(wall);
      for (const key of cellsTouched) {
        const bucket = this.buckets.get(key);
        if (bucket) bucket.push(wall);
        else this.buckets.set(key, [wall]);
      }
    }
  }

  private cellsForWall(wall: WallBox): string[] {
    // A wall sits exactly on a cell boundary, so register it in the cells on both sides.
    const keys = new Set<string>();
    const samples: Array<[number, number]> = [
      [wall.cx - wall.halfX - 0.01, wall.cz - wall.halfZ - 0.01],
      [wall.cx + wall.halfX + 0.01, wall.cz + wall.halfZ + 0.01],
    ];
    for (const [x, z] of samples) {
      keys.add(`${Math.floor(x / CELL_SIZE)},${Math.floor(z / CELL_SIZE)}`);
    }
    return Array.from(keys);
  }

  /** Returns walls in the 3x3 block of cells around a world position. */
  nearby(worldX: number, worldZ: number): WallBox[] {
    const cx = Math.floor(worldX / CELL_SIZE);
    const cz = Math.floor(worldZ / CELL_SIZE);
    const result: WallBox[] = [];
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const bucket = this.buckets.get(`${cx + dx},${cz + dy}`);
        if (bucket) result.push(...bucket);
      }
    }
    return result;
  }
}

/**
 * Pushes a circle of the given radius out of any overlapping wall boxes. Iterated a few
 * times so corner cases (two walls meeting at a right angle) settle instead of jittering.
 */
export function resolveCollision(
  x: number,
  z: number,
  radius: number,
  walls: WallBox[],
): [number, number] {
  let px = x;
  let pz = z;
  for (let iter = 0; iter < 3; iter++) {
    for (const wall of walls) {
      const closestX = Math.max(wall.cx - wall.halfX, Math.min(px, wall.cx + wall.halfX));
      const closestZ = Math.max(wall.cz - wall.halfZ, Math.min(pz, wall.cz + wall.halfZ));
      const dx = px - closestX;
      const dz = pz - closestZ;
      const distSq = dx * dx + dz * dz;
      if (distSq >= radius * radius) continue;
      const dist = Math.sqrt(distSq);
      if (dist < 1e-6) {
        // Center exactly on the box edge (degenerate) — push along the shallower axis.
        const overlapX = wall.halfX + radius - Math.abs(px - wall.cx);
        const overlapZ = wall.halfZ + radius - Math.abs(pz - wall.cz);
        if (overlapX < overlapZ) px += px < wall.cx ? -overlapX : overlapX;
        else pz += pz < wall.cz ? -overlapZ : overlapZ;
        continue;
      }
      const push = radius - dist;
      px += (dx / dist) * push;
      pz += (dz / dist) * push;
    }
  }
  return [px, pz];
}
