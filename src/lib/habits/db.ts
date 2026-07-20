import Dexie, { type EntityTable } from "dexie";
import type { DayLog, Habit, HabitSettings, HabitsBackup } from "./types";
import { DEFAULT_HABITS, DEFAULT_SETTINGS } from "./defaults";

const SETTINGS_KEY = "bidlens.habits.settings.v1";

export class HabitsDB extends Dexie {
  habits!: EntityTable<Habit, "id">;
  dayLogs!: EntityTable<DayLog, "date">;
  constructor() {
    super("bidlens-habits");
    this.version(1).stores({
      habits: "id, order",
      dayLogs: "date",
    });
  }
}

export const habitsDb = new HabitsDB();

/** Seed the default habit list on first run. Safe to call repeatedly. */
export async function ensureSeeded(): Promise<void> {
  await habitsDb.transaction("rw", habitsDb.habits, async () => {
    const count = await habitsDb.habits.count();
    if (count > 0) return;
    const createdAt = new Date().toISOString();
    await habitsDb.habits.bulkAdd(DEFAULT_HABITS.map((h) => ({ ...h, createdAt })));
  });
}

export function loadHabitSettings(): HabitSettings {
  if (typeof window === "undefined") return { ...DEFAULT_SETTINGS };
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<HabitSettings>;
    const goal = Number(parsed.dailyGoal);
    return { dailyGoal: Number.isFinite(goal) && goal > 0 ? Math.round(goal) : DEFAULT_SETTINGS.dailyGoal };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveHabitSettings(settings: HabitSettings): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export async function toggleHabit(dateKey: string, habitId: string): Promise<void> {
  await habitsDb.transaction("rw", habitsDb.dayLogs, async () => {
    const log = await habitsDb.dayLogs.get(dateKey);
    const checked = new Set(log?.checkedHabitIds ?? []);
    if (checked.has(habitId)) checked.delete(habitId);
    else checked.add(habitId);
    await habitsDb.dayLogs.put({
      date: dateKey,
      checkedHabitIds: [...checked],
      updatedAt: new Date().toISOString(),
    });
  });
}

export async function exportBackup(): Promise<HabitsBackup> {
  const [habits, dayLogs] = await Promise.all([
    habitsDb.habits.toArray(),
    habitsDb.dayLogs.toArray(),
  ]);
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    settings: loadHabitSettings(),
    habits,
    dayLogs,
  };
}

/** Replaces all habit data with the backup contents. */
export async function importBackup(backup: HabitsBackup): Promise<void> {
  if (backup.version !== 1 || !Array.isArray(backup.habits) || !Array.isArray(backup.dayLogs)) {
    throw new Error("Unrecognized backup file.");
  }
  await habitsDb.transaction("rw", habitsDb.habits, habitsDb.dayLogs, async () => {
    await habitsDb.habits.clear();
    await habitsDb.dayLogs.clear();
    await habitsDb.habits.bulkAdd(backup.habits);
    await habitsDb.dayLogs.bulkAdd(backup.dayLogs);
  });
  if (backup.settings) saveHabitSettings(backup.settings);
}
