"use client";

export function Hud({
  interactLabel,
  onPause,
}: {
  interactLabel: string | null;
  onPause: () => void;
}) {
  return (
    <div className="pointer-events-none absolute inset-0" data-testid="game-hud">
      <div className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/70" />
      {interactLabel && (
        <div className="absolute left-1/2 top-[58%] -translate-x-1/2 rounded bg-black/60 px-3 py-1 text-xs uppercase tracking-widest text-[#e8ead9]">
          {interactLabel}
        </div>
      )}
      {/* Esc pauses on desktop too, but this is the only way in on a device with no
          keyboard, so it's shown unconditionally rather than gated on touch detection. */}
      <button
        onClick={onPause}
        aria-label="Pause"
        className="pointer-events-auto absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white/70"
      >
        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden>
          <rect x="6" y="5" width="4" height="14" />
          <rect x="14" y="5" width="4" height="14" />
        </svg>
      </button>
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 text-[10px] uppercase tracking-widest text-white/30">
        Esc to pause
      </div>
    </div>
  );
}
