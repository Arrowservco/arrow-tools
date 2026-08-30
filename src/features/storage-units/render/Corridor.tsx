"use client";

/**
 * Brightness here is NOT driven via per-instance vertex colors (InstancedMesh.setColorAt):
 * combining instancing with vertex colors reliably renders the entire frame solid black
 * under this project's headless/software-GL test environment (reproduced in isolation
 * with a 4-box test scene, unrelated to any of this app's own logic). PlayerRig instead
 * renders two real THREE.PointLights that follow the player, which also matches the
 * design plan's original "two real lights" description more literally than a CPU-baked
 * per-instance approach would have.
 */

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { FloorMaterial, type MazeGrid } from "../world/grid";
import { CELL_SIZE, DECK_HEIGHT, FLOOR_MATERIAL_COLOR, WALL_HEIGHT, buildFloorMap, buildWalls, type WallBox } from "../world/walls";
import { cellToSector, LightSectorSystem, SECTOR_SIZE } from "../world/light";
import { pickExitMount, pickPlacardMounts } from "../world/signage";
import { makeCageTexture, makeDoorTexture, makeExitSignTexture, makeFloorTexture, makePlacardTexture } from "./textures";

const GREY_DOOR_FRACTION = 1 / 30;
const FLOOR_MATERIALS = [FloorMaterial.Concrete, FloorMaterial.Carpet, FloorMaterial.Wet, FloorMaterial.Drain];

interface CorridorProps {
  grid: MazeGrid;
  lightSystem: LightSectorSystem;
  wallColor: string;
  floorColor: string;
  exit: [number, number];
  criticalPath: Array<[number, number]>;
}

/** Renders the maze geometry for the active zone: floor, walls, cage ceiling, fixtures, and signage. */
export function Corridor({ grid, lightSystem, wallColor, floorColor, exit, criticalPath }: CorridorProps) {
  const walls = useMemo(() => buildWalls(grid), [grid]);
  const floorMap = useMemo(() => buildFloorMap(grid), [grid]);
  const orangeWalls = useMemo(() => walls.filter((w) => w.variant >= GREY_DOOR_FRACTION), [walls]);
  const greyWalls = useMemo(() => walls.filter((w) => w.variant < GREY_DOOR_FRACTION), [walls]);

  const doorTextureOrange = useMemo(() => makeDoorTexture(false), []);
  const doorTextureGrey = useMemo(() => makeDoorTexture(true), []);
  const floorTexture = useMemo(() => makeFloorTexture(), []);
  const cageTexture = useMemo(() => makeCageTexture(), []);
  const exitTexture = useMemo(() => makeExitSignTexture(), []);

  useEffect(() => {
    floorTexture.repeat.set(grid.width, grid.height);
    cageTexture.repeat.set(grid.width * 2, grid.height * 2);
  }, [grid, floorTexture, cageTexture]);

  const orangeRef = useRef<THREE.InstancedMesh>(null);
  const greyRef = useRef<THREE.InstancedMesh>(null);

  const floorGroups = useMemo(() => {
    const groups = new Map<FloorMaterial, Array<[number, number]>>();
    for (let y = 0; y < grid.height; y++) {
      for (let x = 0; x < grid.width; x++) {
        const material = floorMap.materials[grid.index(x, y)] as FloorMaterial;
        const list = groups.get(material);
        if (list) list.push([x, y]);
        else groups.set(material, [[x, y]]);
      }
    }
    return groups;
  }, [grid, floorMap]);

  const sectors = useMemo(() => {
    const keys: Array<[number, number]> = [];
    const seen = new Set<string>();
    for (let y = 0; y < grid.height; y++) {
      for (let x = 0; x < grid.width; x++) {
        const [sx, sy] = cellToSector(x, y);
        const key = `${sx},${sy}`;
        if (!seen.has(key)) {
          seen.add(key);
          keys.push([sx, sy]);
        }
      }
    }
    return keys;
  }, [grid]);

  function setWallInstances(mesh: THREE.InstancedMesh | null, boxes: WallBox[]) {
    if (!mesh) return;
    const m = new THREE.Matrix4();
    boxes.forEach((box, i) => {
      m.compose(
        new THREE.Vector3(box.cx, WALL_HEIGHT / 2, box.cz),
        new THREE.Quaternion(),
        new THREE.Vector3(box.halfX * 2, WALL_HEIGHT, box.halfZ * 2),
      );
      mesh.setMatrixAt(i, m);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }

  useEffect(() => setWallInstances(orangeRef.current, orangeWalls), [orangeWalls]);
  useEffect(() => setWallInstances(greyRef.current, greyWalls), [greyWalls]);

  const baseWallColor = useMemo(() => new THREE.Color(wallColor), [wallColor]);
  const baseFloorColor = useMemo(() => new THREE.Color(floorColor), [floorColor]);

  const placards = useMemo(() => pickPlacardMounts(grid, criticalPath), [grid, criticalPath]);
  const exitMount = useMemo(() => pickExitMount(grid, exit), [grid, exit]);

  return (
    <group>
      <instancedMesh ref={orangeRef} args={[undefined, undefined, orangeWalls.length]} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial map={doorTextureOrange} color={baseWallColor} roughness={0.9} />
      </instancedMesh>
      <instancedMesh ref={greyRef} args={[undefined, undefined, greyWalls.length]} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial map={doorTextureGrey} color={baseWallColor} roughness={0.9} />
      </instancedMesh>

      {FLOOR_MATERIALS.map((material) => {
        const cells = floorGroups.get(material);
        if (!cells || cells.length === 0) return null;
        return (
          <FloorGroup
            key={material}
            cells={cells}
            texture={floorTexture}
            color={new THREE.Color(FLOOR_MATERIAL_COLOR[material]).multiply(baseFloorColor)}
          />
        );
      })}

      <mesh
        position={[(grid.width * CELL_SIZE) / 2, WALL_HEIGHT, (grid.height * CELL_SIZE) / 2]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[grid.width * CELL_SIZE, grid.height * CELL_SIZE]} />
        <meshBasicMaterial map={cageTexture} color="#c7c9c2" transparent opacity={0.85} side={THREE.DoubleSide} />
      </mesh>
      <mesh
        position={[(grid.width * CELL_SIZE) / 2, DECK_HEIGHT, (grid.height * CELL_SIZE) / 2]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[grid.width * CELL_SIZE, grid.height * CELL_SIZE]} />
        <meshBasicMaterial color="#17170f" side={THREE.DoubleSide} />
      </mesh>

      {sectors.map(([sx, sy]) => (
        <Fixture key={`${sx},${sy}`} sectorX={sx} sectorY={sy} lightSystem={lightSystem} />
      ))}

      {exitMount && (
        <mesh position={exitMount.position} rotation={[0, exitMount.rotationY, 0]}>
          <planeGeometry args={[1.4, 0.5]} />
          <meshBasicMaterial map={exitTexture} toneMapped={false} />
        </mesh>
      )}

      {placards.map((p, i) => (
        <Placard key={i} position={p.position} rotationY={p.rotationY} label={p.label} />
      ))}
    </group>
  );
}

/** One material's worth of floor tiles as a single instanced plane mesh (fixed color, lit by real lights). */
function FloorGroup({
  cells,
  texture,
  color,
}: {
  cells: Array<[number, number]>;
  texture: THREE.Texture;
  color: THREE.Color;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);

  useEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
    cells.forEach(([x, y], i) => {
      m.compose(
        new THREE.Vector3(x * CELL_SIZE + CELL_SIZE / 2, 0, y * CELL_SIZE + CELL_SIZE / 2),
        q,
        new THREE.Vector3(CELL_SIZE, CELL_SIZE, 1),
      );
      mesh.setMatrixAt(i, m);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [cells]);

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, cells.length]} frustumCulled={false}>
      <planeGeometry args={[1, 1]} />
      <meshStandardMaterial map={texture} color={color} roughness={1} side={THREE.DoubleSide} />
    </instancedMesh>
  );
}

/** A single ceiling LED-strip fixture for one sector; its own unlit material fades with sector intensity. */
function Fixture({
  sectorX,
  sectorY,
  lightSystem,
}: {
  sectorX: number;
  sectorY: number;
  lightSystem: LightSectorSystem;
}) {
  const ref = useRef<THREE.Mesh>(null);
  const size = SECTOR_SIZE * CELL_SIZE * 0.55;
  const cx = sectorX * SECTOR_SIZE * CELL_SIZE + (SECTOR_SIZE * CELL_SIZE) / 2;
  const cz = sectorY * SECTOR_SIZE * CELL_SIZE + (SECTOR_SIZE * CELL_SIZE) / 2;

  useFrame(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const intensity = lightSystem.intensityAt(sectorX, sectorY);
    (mesh.material as THREE.MeshBasicMaterial).color.setScalar(intensity);
  });

  return (
    <mesh ref={ref} position={[cx, WALL_HEIGHT - 0.05, cz]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[size, size]} />
      <meshBasicMaterial color="#000000" toneMapped={false} />
    </mesh>
  );
}

function Placard({
  position,
  rotationY,
  label,
}: {
  position: [number, number, number];
  rotationY: number;
  label: string;
}) {
  const texture = useMemo(() => makePlacardTexture(label), [label]);
  return (
    <mesh position={position} rotation={[0, rotationY, 0]}>
      <planeGeometry args={[0.9, 0.34]} />
      <meshBasicMaterial map={texture} toneMapped={false} />
    </mesh>
  );
}
