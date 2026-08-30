import { Dir, FloorMaterial, type MazeGrid } from "./grid";

export const CELL_SIZE = 4;
export const WALL_THICKNESS = 0.3;
export const WALL_HEIGHT = 3.6;
export const DECK_HEIGHT = 5.2;
export const PLAYER_RADIUS = 0.35;
export const DOOR_PITCH = 3; // meters between roll-up doors printed on a wall run

export interface WallBox {
  /** World-space center X/Z (grid x/y are mapped directly to world X/Z). */
  cx: number;
  cz: number;
  halfX: number;
  halfZ: number;
  /** Deterministic 0..1 used to pick door vs. repainted-grey variant and texture offset. */
  variant: number;
  /** The grid cell this wall belongs to, for light-sector lookups (not derivable from cx/cz alone). */
  cellX: number;
  cellY: number;
}

export interface FloorMap {
  width: number;
  height: number;
  /** One FloorMaterial per cell, row-major. */
  materials: Uint8Array;
}

function variantFor(cx: number, cz: number): number {
  // Cheap deterministic hash of the wall's position so rendering stays stable
  // without threading the maze RNG into the renderer.
  const h = Math.sin(cx * 12.9898 + cz * 78.233) * 43758.5453;
  return h - Math.floor(h);
}

/** Extracts axis-aligned wall boxes from a grid, emitting each internal wall exactly once. */
export function buildWalls(grid: MazeGrid): WallBox[] {
  const walls: WallBox[] = [];
  const half = WALL_THICKNESS / 2;

  for (let y = 0; y < grid.height; y++) {
    for (let x = 0; x < grid.width; x++) {
      const x0 = x * CELL_SIZE;
      const z0 = y * CELL_SIZE;

      if (grid.hasWall(x, y, Dir.North)) {
        const cx = x0 + CELL_SIZE / 2;
        const cz = z0;
        walls.push({ cx, cz, halfX: CELL_SIZE / 2, halfZ: half, variant: variantFor(cx, cz), cellX: x, cellY: y });
      }
      if (grid.hasWall(x, y, Dir.West)) {
        const cx = x0;
        const cz = z0 + CELL_SIZE / 2;
        walls.push({ cx, cz, halfX: half, halfZ: CELL_SIZE / 2, variant: variantFor(cx, cz), cellX: x, cellY: y });
      }
      if (x === grid.width - 1 && grid.hasWall(x, y, Dir.East)) {
        const cx = x0 + CELL_SIZE;
        const cz = z0 + CELL_SIZE / 2;
        walls.push({ cx, cz, halfX: half, halfZ: CELL_SIZE / 2, variant: variantFor(cx, cz), cellX: x, cellY: y });
      }
      if (y === grid.height - 1 && grid.hasWall(x, y, Dir.South)) {
        const cx = x0 + CELL_SIZE / 2;
        const cz = z0 + CELL_SIZE;
        walls.push({ cx, cz, halfX: CELL_SIZE / 2, halfZ: half, variant: variantFor(cx, cz), cellX: x, cellY: y });
      }
    }
  }

  return walls;
}

export function buildFloorMap(grid: MazeGrid): FloorMap {
  const materials = new Uint8Array(grid.width * grid.height);
  for (let y = 0; y < grid.height; y++) {
    for (let x = 0; x < grid.width; x++) {
      materials[grid.index(x, y)] = grid.floorAt(x, y);
    }
  }
  return { width: grid.width, height: grid.height, materials };
}

export function cellCenterWorld(x: number, y: number): [number, number] {
  return [x * CELL_SIZE + CELL_SIZE / 2, y * CELL_SIZE + CELL_SIZE / 2];
}

export function worldToCell(worldX: number, worldZ: number): [number, number] {
  return [Math.floor(worldX / CELL_SIZE), Math.floor(worldZ / CELL_SIZE)];
}

export const FLOOR_MATERIAL_COLOR: Record<FloorMaterial, string> = {
  [FloorMaterial.Concrete]: "#6f6f6a",
  [FloorMaterial.Carpet]: "#5a5342",
  [FloorMaterial.Wet]: "#4a5250",
  [FloorMaterial.Drain]: "#3a3d3b",
};
