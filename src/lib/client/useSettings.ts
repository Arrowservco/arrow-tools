"use client";

import { useSyncExternalStore } from "react";
import { loadSettings, saveSettings, type AppSettings } from "@/lib/storage/settings";

/**
 * Settings store backed by localStorage. Returns null during SSR/hydration,
 * then the loaded settings — without setState-in-effect cascades.
 */
let cache: AppSettings | null = null;
const listeners = new Set<() => void>();

function getSnapshot(): AppSettings | null {
  if (cache === null && typeof window !== "undefined") {
    cache = loadSettings();
  }
  return cache;
}

function subscribe(callback: () => void): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

export function updateSettings(next: AppSettings): void {
  cache = next;
  saveSettings(next);
  for (const l of listeners) l();
}

export function useSettings(): AppSettings | null {
  return useSyncExternalStore(subscribe, getSnapshot, () => null);
}
