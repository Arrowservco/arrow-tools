"use client";

import { useState } from "react";
import { useGameStore } from "../state/store";

export function TitleScreen({ onOpenSettings }: { onOpenSettings: () => void }) {
  const startNewRun = useGameStore((s) => s.startNewRun);
  const startFreeRoam = useGameStore((s) => s.startFreeRoam);
  const freeRoamUnlocked = useGameStore((s) => s.freeRoamUnlocked);
  const completedRuns = useGameStore((s) => s.completedRuns);
  const [seed, setSeed] = useState("");

  return (
    <div className="pointer-events-auto absolute inset-0 flex flex-col items-center justify-center gap-6 bg-black/85 px-6 text-center text-[#e8ead9]">
      <div>
        <p className="text-xs uppercase tracking-[0.4em] text-[#9c5a2b]">Sentinel Self Storage presents</p>
        <h1 className="mt-2 text-4xl font-bold tracking-tight sm:text-5xl">The Storage Units</h1>
        <p className="mx-auto mt-3 max-w-md text-sm text-[#b9b5a8]">
          Walk. Look. There is no other verb. The facility does not end where it should, and the
          lights only ever tell you where you have already stopped being.
        </p>
      </div>

      <div className="flex w-full max-w-xs flex-col gap-3">
        <input
          value={seed}
          onChange={(e) => setSeed(e.target.value)}
          placeholder="Run seed (optional)"
          className="rounded-md border border-[#4a4844] bg-black/40 px-3 py-2 text-center text-sm text-[#e8ead9] placeholder:text-[#6f6f6a] focus:border-[#d3372c] focus:outline-none"
        />
        <button
          data-testid="begin-walkthrough"
          onClick={() => startNewRun(seed.trim() || undefined)}
          className="rounded-md bg-[#d3372c] px-4 py-3 text-sm font-semibold uppercase tracking-wide text-white transition hover:bg-[#b32d24]"
        >
          Begin Walkthrough
        </button>
        {freeRoamUnlocked && (
          <button
            onClick={() => startFreeRoam()}
            className="rounded-md border border-[#4a4844] px-4 py-3 text-sm font-semibold uppercase tracking-wide text-[#e8ead9] transition hover:border-[#e8ead9]"
          >
            Night Audit (Free Roam)
          </button>
        )}
        <button
          onClick={onOpenSettings}
          className="rounded-md border border-transparent px-4 py-2 text-xs uppercase tracking-widest text-[#b9b5a8] transition hover:text-[#e8ead9]"
        >
          Settings
        </button>
      </div>

      <p className="max-w-sm text-[11px] text-[#6f6f6a]">
        Contains flashing/strobing sensor lighting. A flicker-reduction mode that replaces snaps
        with fades is available in Settings.
        {completedRuns > 0 && <> · Completed runs: {completedRuns}</>}
      </p>
    </div>
  );
}
