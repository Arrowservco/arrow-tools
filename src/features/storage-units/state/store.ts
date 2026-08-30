import { create } from "zustand";
import { persist } from "zustand/middleware";
import { ZONE_COUNT } from "../world/zones";

export interface GameSettings {
  fov: number;
  headBob: boolean;
  filmGrain: boolean;
  flickerReduction: boolean;
  guided: boolean;
  volume: number;
  touchControls: boolean;
}

// Only used for a first-ever run (no persisted settings yet) — a device whose primary
// pointer is a finger, not a mouse/trackpad, should see the touch stick without having to
// find it in Settings first. A returning user's explicit choice always overrides this,
// since the persist middleware layers saved state on top of these defaults.
function defaultTouchControls(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(pointer: coarse)").matches ?? false;
}

export const DEFAULT_SETTINGS: GameSettings = {
  fov: 78,
  headBob: true,
  filmGrain: true,
  flickerReduction: false,
  guided: false,
  volume: 0.7,
  touchControls: defaultTouchControls(),
};

export type GamePhase = "title" | "playing" | "paused" | "zoneComplete" | "loopComplete";

interface GameState {
  phase: GamePhase;
  seed: string;
  zone: number;
  settings: GameSettings;
  completedRuns: number;
  freeRoamUnlocked: boolean;
  freeRoam: boolean;

  startNewRun: (seed?: string) => void;
  startFreeRoam: () => void;
  advanceZone: () => void;
  setPhase: (phase: GamePhase) => void;
  updateSettings: (patch: Partial<GameSettings>) => void;
  returnToTitle: () => void;
}

function randomSeed(): string {
  return Math.random().toString(36).slice(2, 10);
}

export const useGameStore = create<GameState>()(
  persist(
    (set, get) => ({
      phase: "title",
      seed: randomSeed(),
      zone: 0,
      settings: DEFAULT_SETTINGS,
      completedRuns: 0,
      freeRoamUnlocked: false,
      freeRoam: false,

      startNewRun: (seed) =>
        set({
          phase: "playing",
          seed: seed ?? randomSeed(),
          zone: 0,
          freeRoam: false,
        }),

      startFreeRoam: () =>
        set({
          phase: "playing",
          seed: randomSeed(),
          zone: 0,
          freeRoam: true,
        }),

      advanceZone: () => {
        const { zone, freeRoam } = get();
        if (freeRoam) return; // Night Audit has no zone progression.
        if (zone >= ZONE_COUNT - 1) {
          set((s) => ({
            phase: "loopComplete",
            completedRuns: s.completedRuns + 1,
            freeRoamUnlocked: true,
          }));
          return;
        }
        set({ zone: zone + 1, phase: "playing" });
      },

      setPhase: (phase) => set({ phase }),

      updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),

      returnToTitle: () => set({ phase: "title" }),
    }),
    {
      name: "storage-units:v1",
      partialize: (s) => ({
        settings: s.settings,
        completedRuns: s.completedRuns,
        freeRoamUnlocked: s.freeRoamUnlocked,
      }),
    },
  ),
);
