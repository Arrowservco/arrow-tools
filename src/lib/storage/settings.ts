"use client";

import type { ProviderId } from "@/lib/ai/providers/types";
import type { SourcingProfile } from "@/types/domain";
import { ericStandardProfile } from "@/lib/profile";

/**
 * Settings persistence.
 *
 * SECURITY MODEL:
 * - API keys are stored ONLY in sessionStorage (cleared when the browser
 *   session ends) and are sent only to this app's own /api routes.
 * - Keys are never written to IndexedDB, localStorage, logs, or analytics.
 * - Non-secret settings (provider choice, model, profile) use localStorage.
 */

const SETTINGS_KEY = "bidlens.settings.v1";
const KEY_PREFIX = "bidlens.key."; // sessionStorage only

export interface AppSettings {
  provider: ProviderId;
  model: string;
  webResearchEnabled: boolean;
  maxResearchCalls: number;
  profile: SourcingProfile;
}

export function defaultSettings(): AppSettings {
  return {
    provider: "demo",
    model: "",
    webResearchEnabled: true,
    maxResearchCalls: 3,
    profile: ericStandardProfile(),
  };
}

export function loadSettings(): AppSettings {
  if (typeof window === "undefined") return defaultSettings();
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (!raw) return defaultSettings();
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    const d = defaultSettings();
    return {
      provider: parsed.provider ?? d.provider,
      model: parsed.model ?? d.model,
      webResearchEnabled: parsed.webResearchEnabled ?? d.webResearchEnabled,
      maxResearchCalls: parsed.maxResearchCalls ?? d.maxResearchCalls,
      profile: { ...d.profile, ...(parsed.profile ?? {}) },
    };
  } catch {
    return defaultSettings();
  }
}

export function saveSettings(settings: AppSettings): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

/** Session-only API key handling. Never persisted beyond the browser session. */
export function getSessionKey(provider: ProviderId): string {
  if (typeof window === "undefined") return "";
  return window.sessionStorage.getItem(KEY_PREFIX + provider) ?? "";
}

export function setSessionKey(provider: ProviderId, key: string): void {
  if (typeof window === "undefined") return;
  if (key) window.sessionStorage.setItem(KEY_PREFIX + provider, key);
  else window.sessionStorage.removeItem(KEY_PREFIX + provider);
}

export function clearSessionKey(provider: ProviderId): void {
  setSessionKey(provider, "");
}
