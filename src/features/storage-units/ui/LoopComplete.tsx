"use client";

import { useGameStore } from "../state/store";

export function LoopComplete() {
  const returnToTitle = useGameStore((s) => s.returnToTitle);
  const startFreeRoam = useGameStore((s) => s.startFreeRoam);

  return (
    <div className="pointer-events-auto absolute inset-0 flex flex-col items-center justify-center gap-6 bg-black px-6 text-center text-[#e8ead9]">
      <h2 className="text-2xl font-semibold">The office door opens onto The Aisle.</h2>
      <p className="max-w-md text-sm text-[#b9b5a8]">
        The loop closes. Night Audit — a single seeded endless maze with no zone progression —
        is now available from the title screen.
      </p>
      <div className="flex gap-3">
        <button
          onClick={() => startFreeRoam()}
          className="rounded-md bg-[#d3372c] px-4 py-3 text-sm font-semibold uppercase tracking-wide text-white transition hover:bg-[#b32d24]"
        >
          Start Night Audit
        </button>
        <button
          onClick={() => returnToTitle()}
          className="rounded-md border border-[#4a4844] px-4 py-3 text-sm font-semibold uppercase tracking-wide text-[#e8ead9] transition hover:border-[#e8ead9]"
        >
          Return to Title
        </button>
      </div>
    </div>
  );
}
