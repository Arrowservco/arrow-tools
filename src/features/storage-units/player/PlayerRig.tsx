"use client";

/**
 * three.js/R3F work by mutating objects returned from useThree()/refs every frame inside
 * useFrame — that is the API, not an accident. The react-hooks immutability rule is aimed
 * at plain React state and doesn't understand the scene-graph pattern, so it's scoped off
 * for this file rather than fought line by line.
 */
/* eslint-disable react-hooks/immutability */

import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import type { MazeGrid } from "../world/grid";
import { PLAYER_RADIUS, buildFloorMap, buildWalls, cellCenterWorld, worldToCell } from "../world/walls";
import { cellToSector, LightSectorSystem, SECTOR_SIZE } from "../world/light";
import { pickExitMount, pickPlacardMounts, type WallMount } from "../world/signage";
import type { AudioEngine } from "../audio/engine";
import type { GameSettings } from "../state/store";
import { resolveCollision, WallIndex } from "./collision";
import { useController } from "./useController";

const WALK_SPEED = 1.35;
const HURRY_SPEED = 2.1;
const EYE_HEIGHT = 1.68;
const LOOK_SENSITIVITY = 0.0025;
const MAX_PITCH = Math.PI / 2 - 0.05;
const EXIT_TRIGGER_RADIUS = 1.1;
const INTERACT_RADIUS = 2.4;
const INTERACT_DOT_THRESHOLD = 0.55;

// The two real lights the design plan calls for: one over the player's own sector, one
// over the sector ahead — everything else stays dark except for the unlit ceiling
// fixtures in Corridor.tsx, which glow independently of scene lighting.
const LIGHT_INTENSITY = 55;
const LIGHT_DECAY = 1.6;
const LIGHT_DISTANCE = 15;
const LIGHT_HEIGHT = 2.6;
const AHEAD_DISTANCE = SECTOR_SIZE * 4; // one sector-length (CELL_SIZE=4) ahead

interface PlayerRigProps {
  grid: MazeGrid;
  lightSystem: LightSectorSystem;
  spawn: [number, number];
  exit: [number, number];
  criticalPath: Array<[number, number]>;
  settings: GameSettings;
  /** A ref rather than the engine itself, so Game.tsx can create it lazily without a re-render. */
  audioRef: React.RefObject<AudioEngine | null>;
  onReachExit: () => void;
  onInteractLabel: (label: string | null) => void;
  /** Called once with the touch-input setter, so an on-screen stick can feed this rig. */
  onControllerReady?: (setTouchVector: (forward: number, strafe: number) => void) => void;
  paused: boolean;
}

export function PlayerRig({
  grid,
  lightSystem,
  spawn,
  exit,
  criticalPath,
  settings,
  audioRef,
  onReachExit,
  onInteractLabel,
  onControllerReady,
  paused,
}: PlayerRigProps) {
  const { camera, gl } = useThree();
  const { sample, setTouchVector } = useController(gl.domElement);

  useEffect(() => {
    onControllerReady?.(setTouchVector);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const wallIndex = useMemo(() => new WallIndex(buildWalls(grid)), [grid]);
  const floorMap = useMemo(() => buildFloorMap(grid), [grid]);
  const signage = useMemo<WallMount[]>(() => {
    const list = pickPlacardMounts(grid, criticalPath);
    const exitMount = pickExitMount(grid, exit);
    return exitMount ? [...list, exitMount] : list;
  }, [grid, criticalPath, exit]);

  const posRef = useRef(new THREE.Vector2());
  const yawRef = useRef(0);
  const pitchRef = useRef(0);
  const bobPhase = useRef(0);
  const reachedExit = useRef(false);
  const lastInteractLabel = useRef<string | null>(null);
  const currentLightRef = useRef<THREE.PointLight>(null);
  const aheadLightRef = useRef<THREE.PointLight>(null);

  useEffect(() => {
    const [sx, sz] = cellCenterWorld(spawn[0], spawn[1]);
    posRef.current.set(sx, sz);
    // Face the first step of the route out of spawn rather than a fixed north — spawn's
    // own north wall is frequently the one wall that's actually closed.
    if (criticalPath.length >= 2) {
      const dx = criticalPath[1][0] - criticalPath[0][0];
      const dy = criticalPath[1][1] - criticalPath[0][1];
      yawRef.current = Math.atan2(-dx, -dy);
    } else {
      yawRef.current = 0;
    }
    pitchRef.current = 0;
    bobPhase.current = 0;
    reachedExit.current = false;
  }, [grid, spawn, criticalPath]);

  useEffect(() => {
    if ("fov" in camera) {
      (camera as THREE.PerspectiveCamera).fov = settings.fov;
      (camera as THREE.PerspectiveCamera).updateProjectionMatrix();
    }
  }, [camera, settings.fov]);

  useFrame((_state, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    if (paused) return;

    const input = sample();
    yawRef.current -= input.lookDeltaX * LOOK_SENSITIVITY;
    pitchRef.current -= input.lookDeltaY * LOOK_SENSITIVITY;
    pitchRef.current = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, pitchRef.current));

    const speed = input.hurry ? HURRY_SPEED : WALK_SPEED;
    const sin = Math.sin(yawRef.current);
    const cos = Math.cos(yawRef.current);
    // Forward is -Z at yaw 0; strafe is +X.
    const moveX = (-sin * input.forward + cos * input.strafe) * speed * dt;
    const moveZ = (-cos * input.forward - sin * input.strafe) * speed * dt;

    const desiredX = posRef.current.x + moveX;
    const desiredZ = posRef.current.y + moveZ;
    const nearby = wallIndex.nearby(desiredX, desiredZ);
    const [resolvedX, resolvedZ] = resolveCollision(desiredX, desiredZ, PLAYER_RADIUS, nearby);

    const distanceMoved = Math.hypot(resolvedX - posRef.current.x, resolvedZ - posRef.current.y);
    posRef.current.set(resolvedX, resolvedZ);

    const [cellX, cellY] = worldToCell(resolvedX, resolvedZ);
    lightSystem.update(dt, cellX, cellY);

    if (currentLightRef.current) {
      currentLightRef.current.position.set(resolvedX, LIGHT_HEIGHT, resolvedZ);
      currentLightRef.current.intensity = LIGHT_INTENSITY * lightSystem.intensityAtCell(cellX, cellY);
    }
    if (aheadLightRef.current) {
      const aheadX = resolvedX - sin * AHEAD_DISTANCE;
      const aheadZ = resolvedZ - cos * AHEAD_DISTANCE;
      const [aheadCellX, aheadCellY] = worldToCell(aheadX, aheadZ);
      aheadLightRef.current.position.set(aheadX, LIGHT_HEIGHT, aheadZ);
      aheadLightRef.current.intensity = LIGHT_INTENSITY * lightSystem.intensityAtCell(aheadCellX, aheadCellY);
    }

    const audio = audioRef.current;
    if (audio) {
      const floorMaterial = floorMap.materials[cellY * floorMap.width + cellX] ?? 0;
      audio.tickFootsteps(distanceMoved, floorMaterial);
      const [sx, sy] = cellToSector(cellX, cellY);
      audio.setBuzzIntensity(lightSystem.intensityAt(sx, sy));
    }

    if (settings.headBob && distanceMoved > 0.0001) {
      bobPhase.current += distanceMoved * 3.2;
    }
    const bobY = settings.headBob ? Math.sin(bobPhase.current) * 0.018 : 0;
    const bobX = settings.headBob ? Math.sin(bobPhase.current * 0.5) * 0.01 : 0;

    camera.position.set(resolvedX + bobX, EYE_HEIGHT + bobY, resolvedZ);
    camera.quaternion.setFromEuler(new THREE.Euler(pitchRef.current, yawRef.current, 0, "YXZ"));

    // Interaction: the one verb is "look" — surface the nearest sign's label when close
    // and roughly facing it, matching the plan's proximity-based read prompt.
    const forwardDir = new THREE.Vector3(-sin, 0, -cos);
    let nearestLabel: string | null = null;
    let nearestDist = INTERACT_RADIUS;
    for (const mount of signage) {
      const dx = mount.position[0] - resolvedX;
      const dz = mount.position[2] - resolvedZ;
      const dist = Math.hypot(dx, dz);
      if (dist >= nearestDist) continue;
      const dot = (dx / (dist || 1)) * forwardDir.x + (dz / (dist || 1)) * forwardDir.z;
      if (dot < INTERACT_DOT_THRESHOLD) continue;
      nearestDist = dist;
      nearestLabel = mount.label;
    }
    if (nearestLabel !== lastInteractLabel.current) {
      lastInteractLabel.current = nearestLabel;
      onInteractLabel(nearestLabel);
    }

    if (!reachedExit.current) {
      const [ex, ez] = cellCenterWorld(exit[0], exit[1]);
      if (Math.hypot(resolvedX - ex, resolvedZ - ez) < EXIT_TRIGGER_RADIUS) {
        reachedExit.current = true;
        onReachExit();
      }
    }
  });

  return (
    <>
      <pointLight ref={currentLightRef} intensity={0} decay={LIGHT_DECAY} distance={LIGHT_DISTANCE} />
      <pointLight ref={aheadLightRef} intensity={0} decay={LIGHT_DECAY} distance={LIGHT_DISTANCE} />
    </>
  );
}
