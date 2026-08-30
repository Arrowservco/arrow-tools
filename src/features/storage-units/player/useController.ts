"use client";

import { useEffect, useRef } from "react";

export interface InputState {
  forward: number; // -1..1
  strafe: number; // -1..1
  hurry: boolean;
  lookDeltaX: number; // consumed each frame by the caller
  lookDeltaY: number;
  pointerLocked: boolean;
}

const KEY_FORWARD = new Set(["KeyW", "ArrowUp"]);
const KEY_BACK = new Set(["KeyS", "ArrowDown"]);
const KEY_LEFT = new Set(["KeyA", "ArrowLeft"]);
const KEY_RIGHT = new Set(["KeyD", "ArrowRight"]);
const KEY_HURRY = new Set(["ShiftLeft", "ShiftRight"]);

/**
 * Reads keyboard, mouse-look (via pointer lock), and an optional on-screen touch stick
 * into a single mutable InputState ref. Consulted every animation frame by the game loop
 * rather than driving React state, since re-rendering per input event would be wasteful.
 */
export function useController(canvas: HTMLCanvasElement | null) {
  const state = useRef<InputState>({
    forward: 0,
    strafe: 0,
    hurry: false,
    lookDeltaX: 0,
    lookDeltaY: 0,
    pointerLocked: false,
  });
  const keys = useRef(new Set<string>());
  const touch = useRef({ forward: 0, strafe: 0 });

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => keys.current.add(e.code);
    const onKeyUp = (e: KeyboardEvent) => keys.current.delete(e.code);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  useEffect(() => {
    if (!canvas) return;
    const onMouseMove = (e: MouseEvent) => {
      if (document.pointerLockElement !== canvas) return;
      state.current.lookDeltaX += e.movementX;
      state.current.lookDeltaY += e.movementY;
    };
    const onLockChange = () => {
      state.current.pointerLocked = document.pointerLockElement === canvas;
    };
    const onClick = () => {
      if (document.pointerLockElement !== canvas) {
        canvas.requestPointerLock?.();
      }
    };
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("pointerlockchange", onLockChange);
    canvas.addEventListener("click", onClick);
    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("pointerlockchange", onLockChange);
      canvas.removeEventListener("click", onClick);
    };
  }, [canvas]);

  function setTouchVector(forward: number, strafe: number) {
    touch.current.forward = forward;
    touch.current.strafe = strafe;
  }

  /** Called once per frame; returns the current input and clears the accumulated look delta. */
  function sample(): InputState {
    let forward = 0;
    let strafe = 0;
    let hurry = false;
    for (const code of keys.current) {
      if (KEY_FORWARD.has(code)) forward += 1;
      if (KEY_BACK.has(code)) forward -= 1;
      if (KEY_RIGHT.has(code)) strafe += 1;
      if (KEY_LEFT.has(code)) strafe -= 1;
      if (KEY_HURRY.has(code)) hurry = true;
    }
    forward = clamp(forward + touch.current.forward, -1, 1);
    strafe = clamp(strafe + touch.current.strafe, -1, 1);
    const out: InputState = {
      forward,
      strafe,
      hurry,
      lookDeltaX: state.current.lookDeltaX,
      lookDeltaY: state.current.lookDeltaY,
      pointerLocked: state.current.pointerLocked,
    };
    state.current.lookDeltaX = 0;
    state.current.lookDeltaY = 0;
    return out;
  }

  return { sample, setTouchVector };
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
