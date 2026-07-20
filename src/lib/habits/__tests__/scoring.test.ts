import { describe, expect, it } from "vitest";
import {
  computeStreak,
  dayScore,
  goalMet,
  habitRates,
  localDateKey,
  maxScore,
  shiftDateKey,
  trendDays,
} from "@/lib/habits/scoring";
import type { DayLog, Habit } from "@/lib/habits/types";

function habit(id: string, points: number, overrides: Partial<Habit> = {}): Habit {
  return {
    id,
    name: id,
    points,
    order: 0,
    archived: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function log(date: string, checkedHabitIds: string[]): DayLog {
  return { date, checkedHabitIds, updatedAt: `${date}T20:00:00.000Z` };
}

const habits = [habit("walk", 4), habit("pushups", 2), habit("fast", 3), habit("sugar", 3)];

describe("date keys", () => {
  it("formats local dates and shifts across month boundaries", () => {
    expect(localDateKey(new Date(2026, 6, 20))).toBe("2026-07-20");
    expect(shiftDateKey("2026-07-01", -1)).toBe("2026-06-30");
    expect(shiftDateKey("2026-12-31", 1)).toBe("2027-01-01");
    expect(shiftDateKey("2026-03-01", -1)).toBe("2026-02-28");
  });
});

describe("dayScore", () => {
  it("sums points of checked habits", () => {
    expect(dayScore(["walk", "fast"], habits)).toBe(7);
  });

  it("ignores unknown ids and duplicates", () => {
    expect(dayScore(["walk", "walk", "deleted-habit"], habits)).toBe(4);
  });

  it("rescoring history reflects edited point values", () => {
    const retuned = habits.map((h) => (h.id === "walk" ? { ...h, points: 10 } : h));
    expect(dayScore(["walk"], retuned)).toBe(10);
  });
});

describe("maxScore / goalMet", () => {
  it("counts only active habits toward the max", () => {
    const withArchived = [...habits, habit("old", 5, { archived: true })];
    expect(maxScore(withArchived)).toBe(12);
  });

  it("requires a positive goal", () => {
    expect(goalMet(5, 0)).toBe(false);
    expect(goalMet(5, 5)).toBe(true);
    expect(goalMet(4, 5)).toBe(false);
  });
});

describe("computeStreak", () => {
  const goal = 7;

  it("counts consecutive met days ending today", () => {
    const logs = [
      log("2026-07-18", ["walk", "fast"]),
      log("2026-07-19", ["walk", "fast", "sugar"]),
      log("2026-07-20", ["walk", "fast"]),
    ];
    const s = computeStreak(logs, habits, goal, "2026-07-20");
    expect(s).toEqual({ current: 3, todayMet: true, best: 3 });
  });

  it("does not break the streak while today is still open", () => {
    const logs = [
      log("2026-07-18", ["walk", "fast"]),
      log("2026-07-19", ["walk", "fast"]),
      log("2026-07-20", ["pushups"]),
    ];
    const s = computeStreak(logs, habits, goal, "2026-07-20");
    expect(s.current).toBe(2);
    expect(s.todayMet).toBe(false);
  });

  it("resets to zero after a missed day", () => {
    const logs = [
      log("2026-07-17", ["walk", "fast"]),
      log("2026-07-18", []),
      log("2026-07-19", ["pushups"]),
    ];
    const s = computeStreak(logs, habits, goal, "2026-07-20");
    expect(s.current).toBe(0);
    expect(s.best).toBe(1);
  });

  it("treats unlogged gap days as misses", () => {
    const logs = [log("2026-07-15", ["walk", "fast"]), log("2026-07-19", ["walk", "fast"])];
    const s = computeStreak(logs, habits, goal, "2026-07-20");
    expect(s.current).toBe(1);
    expect(s.best).toBe(1);
  });

  it("tracks the best streak separately from the current one", () => {
    const logs = [
      log("2026-07-10", ["walk", "fast"]),
      log("2026-07-11", ["walk", "fast"]),
      log("2026-07-12", ["walk", "fast"]),
      log("2026-07-13", []),
      log("2026-07-19", ["walk", "fast"]),
    ];
    const s = computeStreak(logs, habits, goal, "2026-07-20");
    expect(s.current).toBe(1);
    expect(s.best).toBe(3);
  });
});

describe("trendDays", () => {
  it("pads unlogged days with zero scores oldest-first", () => {
    const logs = [log("2026-07-19", ["walk", "fast"]), log("2026-07-20", ["pushups"])];
    const trend = trendDays(logs, habits, 7, "2026-07-20", 3);
    expect(trend.map((d) => d.date)).toEqual(["2026-07-18", "2026-07-19", "2026-07-20"]);
    expect(trend.map((d) => d.score)).toEqual([0, 7, 2]);
    expect(trend.map((d) => d.met)).toEqual([false, true, false]);
    expect(trend.map((d) => d.logged)).toEqual([false, true, true]);
  });
});

describe("habitRates", () => {
  it("computes completion over the window", () => {
    const logs = [
      log("2026-07-18", ["walk"]),
      log("2026-07-19", ["walk", "pushups"]),
      log("2026-07-20", ["walk"]),
    ];
    const rates = habitRates(logs, habits, "2026-07-20", 3);
    const walk = rates.find((r) => r.habit.id === "walk");
    const pushups = rates.find((r) => r.habit.id === "pushups");
    expect(walk).toMatchObject({ checkedDays: 3, eligibleDays: 3, rate: 1 });
    expect(pushups).toMatchObject({ checkedDays: 1, eligibleDays: 3 });
  });

  it("only counts days since the habit was created", () => {
    const fresh = habit("new", 2, { createdAt: "2026-07-19T08:00:00.000Z" });
    const logs = [log("2026-07-18", []), log("2026-07-19", ["new"]), log("2026-07-20", ["new"])];
    const rates = habitRates(logs, [fresh], "2026-07-20", 7);
    expect(rates[0]).toMatchObject({ checkedDays: 2, eligibleDays: 2, rate: 1 });
  });

  it("excludes archived habits", () => {
    const rates = habitRates([], [habit("gone", 2, { archived: true })], "2026-07-20", 7);
    expect(rates).toHaveLength(0);
  });
});
