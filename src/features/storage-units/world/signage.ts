import { Dir, type MazeGrid } from "./grid";
import { CELL_SIZE } from "./walls";

export interface WallMount {
  position: [number, number, number];
  rotationY: number;
  label: string;
}

const MOUNT_OPTIONS: Array<{ dir: Dir; offset: [number, number]; rotY: number }> = [
  { dir: Dir.North, offset: [0, -CELL_SIZE / 2 + 0.02], rotY: 0 },
  { dir: Dir.South, offset: [0, CELL_SIZE / 2 - 0.02], rotY: Math.PI },
  { dir: Dir.East, offset: [CELL_SIZE / 2 - 0.02, 0], rotY: -Math.PI / 2 },
  { dir: Dir.West, offset: [-CELL_SIZE / 2 + 0.02, 0], rotY: Math.PI / 2 },
];

/** Finds a wall face on the given cell to mount a placard/sign against, if any exists. */
export function findMount(
  grid: MazeGrid,
  cx: number,
  cy: number,
): { pos: [number, number, number]; rotY: number } | null {
  const center: [number, number] = [cx * CELL_SIZE + CELL_SIZE / 2, cy * CELL_SIZE + CELL_SIZE / 2];
  for (const opt of MOUNT_OPTIONS) {
    if (grid.hasWall(cx, cy, opt.dir)) {
      return { pos: [center[0] + opt.offset[0], 1.6, center[1] + opt.offset[1]], rotY: opt.rotY };
    }
  }
  return null;
}

export function pickPlacardMounts(grid: MazeGrid, criticalPath: Array<[number, number]>): WallMount[] {
  if (criticalPath.length < 4) return [];
  const fractions = [0.25, 0.5, 0.75];
  const mounts: WallMount[] = [];
  fractions.forEach((f, i) => {
    const idx = Math.floor(criticalPath.length * f);
    const [cx, cy] = criticalPath[Math.min(idx, criticalPath.length - 1)];
    const mount = findMount(grid, cx, cy);
    if (mount) {
      mounts.push({ position: mount.pos, rotationY: mount.rotY, label: `A-${100 + i * 24}` });
    }
  });
  return mounts;
}

export function pickExitMount(grid: MazeGrid, exit: [number, number]): WallMount | null {
  const mount = findMount(grid, exit[0], exit[1]);
  if (!mount) return null;
  return {
    position: [mount.pos[0], 2.4, mount.pos[2]],
    rotationY: mount.rotY,
    label: "EXIT",
  };
}
