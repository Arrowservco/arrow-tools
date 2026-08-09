/** A trackable daily habit with a point value toward the daily goal. */
export interface Habit {
  id: string;
  name: string;
  /** Points earned when checked. Editing this recalculates history. */
  points: number;
  /** Display order on the checklist (ascending). */
  order: number;
  /** Archived habits stay in history but leave the daily checklist. */
  archived: boolean;
  createdAt: string;
}

/** One day of check-offs, keyed by local calendar date. */
export interface DayLog {
  /** Local date key, YYYY-MM-DD. */
  date: string;
  /** IDs of habits checked that day. Points are always recomputed from current habit values. */
  checkedHabitIds: string[];
  updatedAt: string;
}

export interface HabitSettings {
  /** Points required for a day to count toward the streak. */
  dailyGoal: number;
}

/** JSON backup payload for export/import. */
export interface HabitsBackup {
  version: 1;
  exportedAt: string;
  settings: HabitSettings;
  habits: Habit[];
  dayLogs: DayLog[];
}
