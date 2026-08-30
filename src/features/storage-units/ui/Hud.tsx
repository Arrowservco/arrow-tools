"use client";

export function Hud({ interactLabel }: { interactLabel: string | null }) {
  return (
    <div className="pointer-events-none absolute inset-0" data-testid="game-hud">
      <div className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/70" />
      {interactLabel && (
        <div className="absolute left-1/2 top-[58%] -translate-x-1/2 rounded bg-black/60 px-3 py-1 text-xs uppercase tracking-widest text-[#e8ead9]">
          {interactLabel}
        </div>
      )}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 text-[10px] uppercase tracking-widest text-white/30">
        Esc to pause
      </div>
    </div>
  );
}
