"use client";

import { useGameStore } from "../state/store";
import { SettingsPanel } from "./SettingsPanel";

export function PauseMenu({ onResume }: { onResume: () => void }) {
  const returnToTitle = useGameStore((s) => s.returnToTitle);
  const zone = useGameStore((s) => s.zone);

  return (
    <div className="pointer-events-auto absolute inset-0 flex flex-col items-center justify-center gap-6 bg-black/85 px-6 text-center">
      <h2 className="text-2xl font-semibold text-[#e8ead9]">Paused</h2>
      <SettingsPanel />
      <div className="flex w-full max-w-sm gap-3">
        <button
          onClick={onResume}
          className="flex-1 rounded-md bg-[#d3372c] px-4 py-3 text-sm font-semibold uppercase tracking-wide text-white transition hover:bg-[#b32d24]"
        >
          Resume
        </button>
        <button
          onClick={() => returnToTitle()}
          className="flex-1 rounded-md border border-[#4a4844] px-4 py-3 text-sm font-semibold uppercase tracking-wide text-[#e8ead9] transition hover:border-[#e8ead9]"
        >
          Quit to Title
        </button>
      </div>
      <p className="text-[11px] text-[#6f6f6a]">Zone {zone + 1} of 5</p>
    </div>
  );
}
