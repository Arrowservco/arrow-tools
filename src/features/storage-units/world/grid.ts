// Bit-packed maze grid. Each cell is one byte:
//   bits 0-3: wall present on N/E/S/W (1 = wall, 0 = open)
//   bits 4-5: floor material (0=concrete 1=carpet 2=wet 3=drain)
//   bit 6:    reserved for a set-piece cell the generator must not overwrite
//   bit 7:    reserved for a dead (unlit) sector seed

export const enum Dir {
  North = 0,
  East = 1,
  South = 2,
  West = 3,
}

export const DIR_DX: Record<Dir, number> = { 0: 0, 1: 1, 2: 0, 3: -1 };
export const DIR_DY: Record<Dir, number> = { 0: -1, 1: 0, 2: 1, 3: 0 };
export const OPPOSITE: Record<Dir, Dir> = { 0: 2, 1: 3, 2: 0, 3: 1 };

export const enum FloorMaterial {
  Concrete = 0,
  Carpet = 1,
  Wet = 2,
  Drain = 3,
}

const WALL_BIT = [1, 2, 4, 8] as const; // indexed by Dir

export class MazeGrid {
  readonly width: number;
  readonly height: number;
  private cells: Uint8Array;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    // Start fully walled: every cell has all four walls set.
    this.cells = new Uint8Array(width * height).fill(0b1111);
  }

  inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.width && y < this.height;
  }

  index(x: number, y: number): number {
    return y * this.width + x;
  }

  hasWall(x: number, y: number, dir: Dir): boolean {
    if (!this.inBounds(x, y)) return true;
    return (this.cells[this.index(x, y)] & WALL_BIT[dir]) !== 0;
  }

  /**
   * Removes the wall between (x,y) and its neighbor in `dir`, and the matching wall on
   * the neighbor. A no-op if the neighbor is out of bounds, so callers can't accidentally
   * carve an opening into the exterior.
   */
  carve(x: number, y: number, dir: Dir): void {
    if (!this.inBounds(x, y)) return;
    const nx = x + DIR_DX[dir];
    const ny = y + DIR_DY[dir];
    if (!this.inBounds(nx, ny)) return;
    this.cells[this.index(x, y)] &= ~WALL_BIT[dir];
    this.cells[this.index(nx, ny)] &= ~WALL_BIT[OPPOSITE[dir]];
  }

  setFloor(x: number, y: number, material: FloorMaterial): void {
    if (!this.inBounds(x, y)) return;
    const i = this.index(x, y);
    this.cells[i] = (this.cells[i] & 0b1100_1111) | ((material & 0b11) << 4);
  }

  floorAt(x: number, y: number): FloorMaterial {
    if (!this.inBounds(x, y)) return FloorMaterial.Concrete;
    return ((this.cells[this.index(x, y)] >> 4) & 0b11) as FloorMaterial;
  }

  markSetPiece(x: number, y: number): void {
    if (!this.inBounds(x, y)) return;
    this.cells[this.index(x, y)] |= 0b0100_0000;
  }

  isSetPiece(x: number, y: number): boolean {
    if (!this.inBounds(x, y)) return false;
    return (this.cells[this.index(x, y)] & 0b0100_0000) !== 0;
  }

  markDeadSector(x: number, y: number): void {
    if (!this.inBounds(x, y)) return;
    this.cells[this.index(x, y)] |= 0b1000_0000;
  }

  isDeadSector(x: number, y: number): boolean {
    if (!this.inBounds(x, y)) return false;
    return (this.cells[this.index(x, y)] & 0b1000_0000) !== 0;
  }

  openNeighborCount(x: number, y: number): number {
    let count = 0;
    for (const dir of [Dir.North, Dir.East, Dir.South, Dir.West]) {
      if (!this.hasWall(x, y, dir)) count++;
    }
    return count;
  }

  /** Breadth-first shortest path from start to goal, or null if unreachable. */
  shortestPath(start: [number, number], goal: [number, number]): Array<[number, number]> | null {
    const startIdx = this.index(start[0], start[1]);
    const goalIdx = this.index(goal[0], goal[1]);
    const prev = new Int32Array(this.width * this.height).fill(-1);
    const visited = new Uint8Array(this.width * this.height);
    const queue: number[] = [startIdx];
    visited[startIdx] = 1;
    let head = 0;
    while (head < queue.length) {
      const cur = queue[head++];
      if (cur === goalIdx) break;
      const cx = cur % this.width;
      const cy = Math.floor(cur / this.width);
      for (const dir of [Dir.North, Dir.East, Dir.South, Dir.West]) {
        if (this.hasWall(cx, cy, dir)) continue;
        const nx = cx + DIR_DX[dir];
        const ny = cy + DIR_DY[dir];
        if (!this.inBounds(nx, ny)) continue;
        const ni = this.index(nx, ny);
        if (visited[ni]) continue;
        visited[ni] = 1;
        prev[ni] = cur;
        queue.push(ni);
      }
    }
    if (!visited[goalIdx]) return null;
    const path: Array<[number, number]> = [];
    let cur = goalIdx;
    while (cur !== -1) {
      path.push([cur % this.width, Math.floor(cur / this.width)]);
      if (cur === startIdx) break;
      cur = prev[cur];
    }
    path.reverse();
    return path;
  }
}

/** Deterministic PRNG so a run seed reproduces an identical grid. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashSeed(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
