import type { DayLog, Habit } from "./types";

/**
 * Deterministic habit math. Points are always recomputed from the current
 * habit values, so retuning a habit's points rescores history — the same
 * behavior as the blueprint's spreadsheet formulas.
 */

/** Local calendar date key (YYYY-MM-DD) for a Date. */
export function localDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Shift a date key by whole days (negative = past). */
export function shiftDateKey(key: string, days: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(y, m - 1, d + days);
  return localDateKey(date);
}

/** Human label like "Mon, Jul 20" for a date key. */
export function dateKeyLabel(key: string, options?: Intl.DateTimeFormatOptions): string {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(
    "en-US",
    options ?? { weekday: "short", month: "short", day: "numeric" },
  );
}

/** Sum of points for the checked habits. Unknown/deleted habit IDs score 0. */
export function dayScore(checkedHabitIds: ReadonlyArray<string>, habits: ReadonlyArray<Habit>): number {
  const points = new Map(habits.map((h) => [h.id, h.points]));
  let total = 0;
  for (const id of new Set(checkedHabitIds)) total += points.get(id) ?? 0;
  return total;
}

/** Maximum available points for a day (active habits only). */
export function maxScore(habits: ReadonlyArray<Habit>): number {
  return habits.filter((h) => !h.archived).reduce((sum, h) => sum + h.points, 0);
}

export function goalMet(score: number, dailyGoal: number): boolean {
  return dailyGoal > 0 && score >= dailyGoal;
}

export interface StreakResult {
  /** Consecutive goal-met days ending today (or yesterday if today is still open). */
  current: number;
  /** Whether today itself has already met the goal. */
  todayMet: boolean;
  /** Longest goal-met run anywhere in history. */
  best: number;
}

/**
 * Current streak counts backward from today. An unfinished today doesn't
 * break the streak — it just doesn't extend it yet.
 */
export function computeStreak(
  logs: ReadonlyArray<DayLog>,
  habits: ReadonlyArray<Habit>,
  dailyGoal: number,
  todayKey: string,
): StreakResult {
  const metByDate = new Map<string, boolean>();
  for (const log of logs) {
    metByDate.set(log.date, goalMet(dayScore(log.checkedHabitIds, habits), dailyGoal));
  }

  const todayMet = metByDate.get(todayKey) === true;
  let current = 0;
  let cursor = todayMet ? todayKey : shiftDateKey(todayKey, -1);
  while (metByDate.get(cursor) === true) {
    current += 1;
    cursor = shiftDateKey(cursor, -1);
  }

  let best = 0;
  let run = 0;
  const sortedDates = [...metByDate.keys()].sort();
  let prev: string | null = null;
  for (const date of sortedDates) {
    if (metByDate.get(date)) {
      run = prev !== null && shiftDateKey(prev, 1) === date && run > 0 ? run + 1 : 1;
      best = Math.max(best, run);
    } else {
      run = 0;
    }
    prev = date;
  }

  return { current, todayMet, best };
}

export interface TrendDay {
  date: string;
  score: number;
  met: boolean;
  logged: boolean;
}

/** Scores for the `days` calendar days ending at `endKey`, padding unlogged days with 0. */
export function trendDays(
  logs: ReadonlyArray<DayLog>,
  habits: ReadonlyArray<Habit>,
  dailyGoal: number,
  endKey: string,
  days: number,
): TrendDay[] {
  const byDate = new Map(logs.map((l) => [l.date, l]));
  const out: TrendDay[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = shiftDateKey(endKey, -i);
    const log = byDate.get(date);
    const score = log ? dayScore(log.checkedHabitIds, habits) : 0;
    out.push({ date, score, met: goalMet(score, dailyGoal), logged: Boolean(log) });
  }
  return out;
}

export interface HabitRate {
  habit: Habit;
  /** Days checked within the window. */
  checkedDays: number;
  /** Days in the window since the habit was created (capped at window size). */
  eligibleDays: number;
  /** checkedDays / eligibleDays, or null when no eligible days. */
  rate: number | null;
}

/** Per-habit completion rate over the `days` ending at `endKey`. */
export function habitRates(
  logs: ReadonlyArray<DayLog>,
  habits: ReadonlyArray<Habit>,
  endKey: string,
  days: number,
): HabitRate[] {
  const startKey = shiftDateKey(endKey, -(days - 1));
  const window = logs.filter((l) => l.date >= startKey && l.date <= endKey);
  return habits
    .filter((h) => !h.archived)
    .sort((a, b) => a.order - b.order)
    .map((habit) => {
      const createdKey = localDateKey(new Date(habit.createdAt));
      const firstEligible = createdKey > startKey ? createdKey : startKey;
      const eligibleDays =
        firstEligible > endKey
          ? 0
          : Math.round(
              (Date.parse(`${endKey}T12:00:00`) - Date.parse(`${firstEligible}T12:00:00`)) / 86_400_000,
            ) + 1;
      const checkedDays = window.filter(
        (l) => l.date >= firstEligible && l.checkedHabitIds.includes(habit.id),
      ).length;
      return { habit, checkedDays, eligibleDays, rate: eligibleDays > 0 ? checkedDays / eligibleDays : null };
    });
}
