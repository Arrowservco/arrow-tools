"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { hashSeed } from "./world/grid";
import { buildFreeRoamZone, buildZone, ZONE_VISUALS } from "./world/zones";
import { LightSectorSystem, SECTOR_SIZE } from "./world/light";
import { Corridor } from "./render/Corridor";
import { PlayerRig } from "./player/PlayerRig";
import { AudioEngine } from "./audio/engine";
import { useGameStore } from "./state/store";
import { TitleScreen } from "./ui/TitleScreen";
import { PauseMenu } from "./ui/PauseMenu";
import { Hud } from "./ui/Hud";
import { TouchControls } from "./ui/TouchControls";
import { LoopComplete } from "./ui/LoopComplete";
import { SettingsPanel } from "./ui/SettingsPanel";

const TRANSITION_BLIND_MS = 650;
const TRANSITION_HOLD_MS = 250;

export default function Game() {
  const phase = useGameStore((s) => s.phase);
  const zone = useGameStore((s) => s.zone);
  const seed = useGameStore((s) => s.seed);
  const freeRoam = useGameStore((s) => s.freeRoam);
  const settings = useGameStore((s) => s.settings);
  const advanceZone = useGameStore((s) => s.advanceZone);
  const setPhase = useGameStore((s) => s.setPhase);

  const [interactLabel, setInteractLabel] = useState<string | null>(null);
  const [blind, setBlind] = useState(false);
  const [showTitleSettings, setShowTitleSettings] = useState(false);

  const audioRef = useRef<AudioEngine | null>(null);
  const setTouchVectorRef = useRef<((forward: number, strafe: number) => void) | null>(null);
  const transitionTimers = useRef<number[]>([]);

  const zoneVisuals = ZONE_VISUALS[freeRoam ? 0 : zone];

  const numericSeed = useMemo(() => hashSeed(seed) ^ (zone * 7919 + 1013904223), [seed, zone]);
  const generated = useMemo(() => {
    return freeRoam ? buildFreeRoamZone(numericSeed) : buildZone(zone, numericSeed);
  }, [freeRoam, zone, numericSeed]);

  const lightSystem = useMemo(
    () => new LightSectorSystem((sx, sy) => generated.grid.isDeadSector(sx * SECTOR_SIZE, sy * SECTOR_SIZE)),
    [generated],
  );

  // Audio lifecycle: created lazily on the first real user gesture (starting a run),
  // since browsers refuse to start an AudioContext before user interaction.
  useEffect(() => {
    if (phase === "playing" && !audioRef.current) {
      audioRef.current = new AudioEngine(settings.volume);
    }
    if (phase === "title" && audioRef.current) {
      audioRef.current.dispose();
      audioRef.current = null;
    }
  }, [phase, settings.volume]);

  useEffect(() => {
    audioRef.current?.setVolume(settings.volume);
  }, [settings.volume]);

  useEffect(() => {
    if (phase === "playing") audioRef.current?.startAmbience(zoneVisuals.ambience);
  }, [phase, zoneVisuals.ambience]);

  useEffect(() => {
    const timers = transitionTimers.current;
    return () => {
      audioRef.current?.dispose();
      audioRef.current = null;
      for (const id of timers) window.clearTimeout(id);
    };
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.code !== "Escape") return;
      if (phase === "playing") setPhase("paused");
      else if (phase === "paused") setPhase("playing");
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [phase, setPhase]);

  function handleReachExit() {
    if (freeRoam) return; // Night Audit has no zone progression or exit blind.
    setBlind(true);
    const t1 = window.setTimeout(() => {
      advanceZone();
      const t2 = window.setTimeout(() => setBlind(false), TRANSITION_HOLD_MS);
      transitionTimers.current.push(t2);
    }, TRANSITION_BLIND_MS);
    transitionTimers.current.push(t1);
  }

  const paused = phase !== "playing";

  return (
    <div
      className="relative h-full w-full touch-none select-none overflow-hidden bg-black"
      data-testid="storage-units-root"
    >
      <Canvas
        gl={{ antialias: true }}
        camera={{ fov: settings.fov, near: 0.05, far: 120 }}
        dpr={[1, 1.5]}
      >
        <ambientLight intensity={0.08} />
        <Corridor
          grid={generated.grid}
          lightSystem={lightSystem}
          wallColor={zoneVisuals.wallColor}
          floorColor={zoneVisuals.floorColor}
          exit={generated.exit}
          criticalPath={generated.criticalPath}
        />
        <PlayerRig
          grid={generated.grid}
          lightSystem={lightSystem}
          spawn={generated.spawn}
          exit={generated.exit}
          criticalPath={generated.criticalPath}
          settings={settings}
          audioRef={audioRef}
          onReachExit={handleReachExit}
          onInteractLabel={setInteractLabel}
          onControllerReady={(setter) => {
            setTouchVectorRef.current = setter;
          }}
          paused={paused}
        />
      </Canvas>

      {settings.filmGrain && phase === "playing" && (
        <div className="pointer-events-none absolute inset-0 opacity-[0.05] mix-blend-overlay [background-image:url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22120%22 height=%22120%22><filter id=%22n%22><feTurbulence type=%22fractalNoise%22 baseFrequency=%220.9%22 numOctaves=%222%22/></filter><rect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23n)%22/></svg>')]" />
      )}

      {phase === "playing" && (
        <>
          <Hud interactLabel={interactLabel} />
          {settings.touchControls && (
            <TouchControls onMove={(f, s) => setTouchVectorRef.current?.(f, s)} />
          )}
        </>
      )}

      <div
        className="pointer-events-none absolute inset-0 bg-black transition-opacity duration-500"
        style={{ opacity: blind ? 1 : 0 }}
      />

      {phase === "title" &&
        (showTitleSettings ? (
          <div className="pointer-events-auto absolute inset-0 flex flex-col items-center justify-center gap-6 bg-black/90 px-6">
            <SettingsPanel />
            <button
              onClick={() => setShowTitleSettings(false)}
              className="rounded-md border border-[#4a4844] px-4 py-2 text-xs uppercase tracking-widest text-[#e8ead9] hover:border-[#e8ead9]"
            >
              Back
            </button>
          </div>
        ) : (
          <TitleScreen onOpenSettings={() => setShowTitleSettings(true)} />
        ))}

      {phase === "paused" && <PauseMenu onResume={() => setPhase("playing")} />}
      {phase === "loopComplete" && <LoopComplete />}
    </div>
  );
}
