import { Dir, FloorMaterial, MazeGrid, mulberry32 } from "./grid";

export interface GeneratedZone {
  grid: MazeGrid;
  spawn: [number, number];
  exit: [number, number];
  criticalPath: Array<[number, number]>;
}

/** Recursive-backtracker perfect maze, then braided by knocking out a fraction of dead ends. */
export function backtrackerMaze(
  width: number,
  height: number,
  rng: () => number,
  braidRate: number,
): MazeGrid {
  const grid = new MazeGrid(width, height);
  const visited = new Uint8Array(width * height);
  const stack: Array<[number, number]> = [[0, 0]];
  visited[0] = 1;

  while (stack.length > 0) {
    const [x, y] = stack[stack.length - 1];
    const dirs = [Dir.North, Dir.East, Dir.South, Dir.West];
    // Fisher-Yates shuffle using the seeded RNG so the whole maze is reproducible.
    for (let i = dirs.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [dirs[i], dirs[j]] = [dirs[j], dirs[i]];
    }
    let carved = false;
    for (const dir of dirs) {
      const nx = x + (dir === Dir.East ? 1 : dir === Dir.West ? -1 : 0);
      const ny = y + (dir === Dir.South ? 1 : dir === Dir.North ? -1 : 0);
      if (!grid.inBounds(nx, ny)) continue;
      const ni = grid.index(nx, ny);
      if (visited[ni]) continue;
      grid.carve(x, y, dir);
      visited[ni] = 1;
      stack.push([nx, ny]);
      carved = true;
      break;
    }
    if (!carved) stack.pop();
  }

  // Braiding: dead ends (1 open neighbor) get one extra wall knocked out so the
  // maze reads as a building with loops rather than a strict puzzle maze.
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (grid.openNeighborCount(x, y) !== 1) continue;
      if (rng() > braidRate) continue;
      const closedDirs = [Dir.North, Dir.East, Dir.South, Dir.West].filter((d) =>
        grid.hasWall(x, y, d),
      );
      const candidates = closedDirs.filter((d) => {
        const nx = x + (d === Dir.East ? 1 : d === Dir.West ? -1 : 0);
        const ny = y + (d === Dir.South ? 1 : d === Dir.North ? -1 : 0);
        return grid.inBounds(nx, ny);
      });
      if (candidates.length === 0) continue;
      const pick = candidates[Math.floor(rng() * candidates.length)];
      grid.carve(x, y, pick);
    }
  }

  return grid;
}

function computeCriticalPath(
  grid: MazeGrid,
  spawn: [number, number],
  exit: [number, number],
): Array<[number, number]> {
  const path = grid.shortestPath(spawn, exit);
  if (!path) {
    throw new Error("Generated maze has no path from spawn to exit — generator invariant broken.");
  }
  return path;
}

export function generateBacktrackerZone(opts: {
  seed: number;
  width: number;
  height: number;
  braidRate: number;
  floor?: FloorMaterial;
  wetFraction?: number;
  deadSectorFraction?: number;
}): GeneratedZone {
  const rng = mulberry32(opts.seed);
  const grid = backtrackerMaze(opts.width, opts.height, rng, opts.braidRate);

  if (opts.floor !== undefined) {
    for (let y = 0; y < opts.height; y++) {
      for (let x = 0; x < opts.width; x++) {
        grid.setFloor(x, y, opts.floor);
      }
    }
  }

  if (opts.wetFraction && opts.wetFraction > 0) {
    for (let y = 0; y < opts.height; y++) {
      for (let x = 0; x < opts.width; x++) {
        if (rng() < opts.wetFraction) grid.setFloor(x, y, FloorMaterial.Wet);
      }
    }
  }

  if (opts.deadSectorFraction && opts.deadSectorFraction > 0) {
    for (let y = 0; y < opts.height; y += 4) {
      for (let x = 0; x < opts.width; x += 4) {
        if (rng() < opts.deadSectorFraction) grid.markDeadSector(x, y);
      }
    }
  }

  const spawn: [number, number] = [0, 0];
  // Farthest reachable cell from spawn along a BFS frontier makes a reliable exit
  // that is guaranteed connected and tends to sit far from spawn.
  const exit = farthestCell(grid, spawn);
  const criticalPath = computeCriticalPath(grid, spawn, exit);
  return { grid, spawn, exit, criticalPath };
}

function farthestCell(grid: MazeGrid, from: [number, number]): [number, number] {
  const startIdx = grid.index(from[0], from[1]);
  const visited = new Uint8Array(grid.width * grid.height);
  const queue: number[] = [startIdx];
  visited[startIdx] = 1;
  let last = startIdx;
  let head = 0;
  while (head < queue.length) {
    const cur = queue[head++];
    last = cur;
    const cx = cur % grid.width;
    const cy = Math.floor(cur / grid.width);
    for (const dir of [Dir.North, Dir.East, Dir.South, Dir.West]) {
      if (grid.hasWall(cx, cy, dir)) continue;
      const nx = cx + (dir === Dir.East ? 1 : dir === Dir.West ? -1 : 0);
      const ny = cy + (dir === Dir.South ? 1 : dir === Dir.North ? -1 : 0);
      if (!grid.inBounds(nx, ny)) continue;
      const ni = grid.index(nx, ny);
      if (visited[ni]) continue;
      visited[ni] = 1;
      queue.push(ni);
    }
  }
  return [last % grid.width, Math.floor(last / grid.width)];
}

/**
 * A single one-cell-wide corridor, extended forward from spawn. Rare alcoves are
 * carved off to the side so it does not read as a perfectly straight hallway.
 */
export function generateLongRunZone(opts: { seed: number; length: number }): GeneratedZone {
  const rng = mulberry32(opts.seed);
  const width = opts.length;
  const height = 3; // one main row plus room for alcoves above/below
  const grid = new MazeGrid(width, height);
  const midY = 1;
  for (let x = 0; x < width - 1; x++) {
    grid.carve(x, midY, Dir.East);
  }
  for (let x = 2; x < width - 2; x++) {
    if (rng() < 0.06) {
      const dir = rng() < 0.5 ? Dir.North : Dir.South;
      grid.carve(x, midY, dir);
    }
  }
  const spawn: [number, number] = [0, midY];
  const exit: [number, number] = [width - 1, midY];
  const criticalPath = computeCriticalPath(grid, spawn, exit);
  return { grid, spawn, exit, criticalPath };
}

/**
 * Turns a fixed sequence of axis-aligned waypoints into carve instructions, so a
 * hand-authored layout can be specified as a readable path (straight runs collapsed
 * to their endpoints) instead of a raw bit list or a step for every single cell.
 */
export function pathToCarves(points: Array<[number, number]>): Array<[number, number, Dir]> {
  const carves: Array<[number, number, Dir]> = [];
  for (let i = 0; i < points.length - 1; i++) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[i + 1];
    const dx = Math.sign(x2 - x1);
    const dy = Math.sign(y2 - y1);
    if (dx !== 0 && dy !== 0) {
      throw new Error(`pathToCarves: waypoints (${x1},${y1}) -> (${x2},${y2}) are not axis-aligned`);
    }
    if (dx === 0 && dy === 0) continue;
    const dir = dx === 1 ? Dir.East : dx === -1 ? Dir.West : dy === 1 ? Dir.South : Dir.North;
    let x = x1;
    let y = y1;
    while (x !== x2 || y !== y2) {
      carves.push([x, y, dir]);
      x += dx;
      y += dy;
    }
  }
  return carves;
}

/** Hand-authored bookend zones (The Aisle, The Office) loaded from a fixed layout. */
export function generateAuthoredZone(layout: {
  width: number;
  height: number;
  spawn: [number, number];
  exit: [number, number];
  /** List of [x, y, dir] wall removals describing the fixed corridor plan. */
  carve: Array<[number, number, Dir]>;
  setPieces?: Array<[number, number]>;
}): GeneratedZone {
  const grid = new MazeGrid(layout.width, layout.height);
  for (const [x, y, dir] of layout.carve) {
    grid.carve(x, y, dir);
  }
  for (const [x, y] of layout.setPieces ?? []) {
    grid.markSetPiece(x, y);
  }
  const criticalPath = computeCriticalPath(grid, layout.spawn, layout.exit);
  return { grid, spawn: layout.spawn, exit: layout.exit, criticalPath };
}
