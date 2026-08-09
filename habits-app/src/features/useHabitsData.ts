"use client";

import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ensureSeeded, habitsDb, loadHabitSettings, saveHabitSettings } from "@/lib/habits/db";
import type { DayLog, Habit, HabitSettings } from "@/lib/habits/types";
import { DEFAULT_SETTINGS } from "@/lib/habits/defaults";

export interface HabitsData {
  /** null while the first IndexedDB read is in flight. */
  habits: Habit[] | null;
  activeHabits: Habit[];
  logs: DayLog[] | null;
  settings: HabitSettings;
  setSettings: (next: HabitSettings) => void;
}

/** Live habit data shared by all three habit screens. Seeds defaults on first run. */
export function useHabitsData(): HabitsData {
  // Settings only surface after the IndexedDB reads resolve (post-hydration),
  // so reading localStorage in the initializer can't cause an SSR mismatch.
  const [settings, setSettingsState] = useState<HabitSettings>(() =>
    typeof window === "undefined" ? DEFAULT_SETTINGS : loadHabitSettings(),
  );

  useEffect(() => {
    void ensureSeeded();
  }, []);

  const habits = useLiveQuery(() => habitsDb.habits.orderBy("order").toArray(), []) ?? null;
  const logs = useLiveQuery(() => habitsDb.dayLogs.toArray(), []) ?? null;

  const setSettings = (next: HabitSettings) => {
    setSettingsState(next);
    saveHabitSettings(next);
  };

  return {
    habits,
    activeHabits: (habits ?? []).filter((h) => !h.archived),
    logs,
    settings,
    setSettings,
  };
}
