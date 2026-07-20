import type { Habit, HabitSettings } from "./types";

/**
 * Eric's daily system. Point values weight the harder, higher-leverage work;
 * all of them are editable in Manage Habits.
 */
export const DEFAULT_HABITS: ReadonlyArray<Omit<Habit, "createdAt">> = [
  { id: "pushups", name: "30 pushups", points: 2, order: 0, archived: false },
  { id: "zone2-walk", name: "45 min zone 2 walk", points: 4, order: 1, archived: false },
  { id: "shoulder", name: "Shoulder work", points: 2, order: 2, archived: false },
  { id: "mobility", name: "Mobility work", points: 2, order: 3, archived: false },
  { id: "core", name: "Core work", points: 2, order: 4, archived: false },
  { id: "tgu", name: "Turkish get-ups", points: 3, order: 5, archived: false },
  { id: "fast-1pm", name: "Fast until 1pm", points: 3, order: 6, archived: false },
  { id: "no-sugar", name: "No sugar", points: 3, order: 7, archived: false },
  { id: "supplements", name: "Creatine + vitamin stack", points: 1, order: 8, archived: false },
  { id: "meditation", name: "Meditation / box breathing", points: 2, order: 9, archived: false },
];

/** 24 possible points per day; the streak requires 18 (75%). */
export const DEFAULT_SETTINGS: HabitSettings = { dailyGoal: 18 };
