"use client";

import { useRef } from "react";

const STICK_RADIUS = 48;

/**
 * A single on-screen thumbstick for movement. Look is handled by dragging anywhere else
 * on the canvas (wired up alongside pointer lock in the controller), so only one stick
 * is needed here.
 */
export function TouchControls({ onMove }: { onMove: (forward: number, strafe: number) => void }) {
  const originRef = useRef<{ x: number; y: number } | null>(null);
  const knobRef = useRef<HTMLDivElement>(null);

  function handleStart(e: React.PointerEvent) {
    originRef.current = { x: e.clientX, y: e.clientY };
  }

  function handleMove(e: React.PointerEvent) {
    if (!originRef.current) return;
    const dx = e.clientX - originRef.current.x;
    const dy = e.clientY - originRef.current.y;
    const dist = Math.min(STICK_RADIUS, Math.hypot(dx, dy));
    const angle = Math.atan2(dy, dx);
    const clampedX = Math.cos(angle) * dist;
    const clampedY = Math.sin(angle) * dist;
    if (knobRef.current) {
      knobRef.current.style.transform = `translate(${clampedX}px, ${clampedY}px)`;
    }
    onMove(-clampedY / STICK_RADIUS, clampedX / STICK_RADIUS);
  }

  function handleEnd() {
    originRef.current = null;
    if (knobRef.current) knobRef.current.style.transform = "translate(0px, 0px)";
    onMove(0, 0);
  }

  return (
    <div
      className="pointer-events-auto absolute bottom-8 left-8 flex h-28 w-28 items-center justify-center rounded-full border border-white/20 bg-white/5"
      onPointerDown={handleStart}
      onPointerMove={handleMove}
      onPointerUp={handleEnd}
      onPointerLeave={handleEnd}
      onPointerCancel={handleEnd}
    >
      <div ref={knobRef} className="h-12 w-12 rounded-full bg-white/30 transition-transform" />
    </div>
  );
}
