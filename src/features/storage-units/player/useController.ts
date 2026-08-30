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
    const isTouchPrimary = window.matchMedia?.("(pointer: coarse)").matches ?? false;

    const onMouseMove = (e: MouseEvent) => {
      if (document.pointerLockElement !== canvas) return;
      state.current.lookDeltaX += e.movementX;
      state.current.lookDeltaY += e.movementY;
    };
    const onLockChange = () => {
      state.current.pointerLocked = document.pointerLockElement === canvas;
    };
    const onClick = () => {
      // Pointer Lock is a desktop mouse-look mechanism; a touch-primary device looks
      // around via direct finger drag instead (below), so never request it there.
      if (!isTouchPrimary && document.pointerLockElement !== canvas) {
        canvas.requestPointerLock?.();
      }
    };
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("pointerlockchange", onLockChange);
    canvas.addEventListener("click", onClick);

    // Touch-look: a finger drag anywhere on the canvas (the movement stick is a separate
    // element layered on top, so drags starting on it never reach here) turns the camera,
    // the same way a mouse move does under pointer lock.
    let activeTouchId: number | null = null;
    let lastX = 0;
    let lastY = 0;
    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType !== "touch") return;
      activeTouchId = e.pointerId;
      lastX = e.clientX;
      lastY = e.clientY;
    };
    const onPointerMove = (e: PointerEvent) => {
      if (e.pointerType !== "touch" || e.pointerId !== activeTouchId) return;
      state.current.lookDeltaX += e.clientX - lastX;
      state.current.lookDeltaY += e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
    };
    const onPointerEnd = (e: PointerEvent) => {
      if (e.pointerId === activeTouchId) activeTouchId = null;
    };
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerEnd);
    canvas.addEventListener("pointercancel", onPointerEnd);

    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("pointerlockchange", onLockChange);
      canvas.removeEventListener("click", onClick);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerEnd);
      canvas.removeEventListener("pointercancel", onPointerEnd);
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
