"use client";

import { Check, Flame } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { toggleHabit } from "@/lib/habits/db";
import {
  computeStreak,
  dateKeyLabel,
  dayScore,
  goalMet,
  localDateKey,
  maxScore,
  shiftDateKey,
} from "@/lib/habits/scoring";
import { useHabitsData } from "./useHabitsData";

export function TodayView() {
  const { habits, activeHabits, logs, settings } = useHabitsData();
  const todayKey = localDateKey(new Date());

  if (habits === null || logs === null) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const todayLog = logs.find((l) => l.date === todayKey);
  const checked = new Set(todayLog?.checkedHabitIds ?? []);
  const score = dayScore([...checked], habits);
  const possible = maxScore(habits);
  const goal = settings.dailyGoal;
  const streak = computeStreak(logs, habits, goal, todayKey);

  const yesterdayKey = shiftDateKey(todayKey, -1);
  const yesterdayLog = logs.find((l) => l.date === yesterdayKey);
  const yesterdayScore = yesterdayLog ? dayScore(yesterdayLog.checkedHabitIds, habits) : null;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Today&apos;s score
              </p>
              <p className="text-3xl font-black">
                {score}
                <span className="text-lg font-medium text-muted-foreground"> / {goal} pts</span>
              </p>
              <p className="text-xs text-muted-foreground">{possible} available</p>
            </div>
            <div className="text-right">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Streak</p>
              <p className="flex items-center justify-end gap-1 text-3xl font-black">
                <Flame
                  aria-hidden
                  className={cn("h-6 w-6", streak.current > 0 ? "text-warning" : "text-muted-foreground")}
                />
                {streak.current}
                <span className="text-lg font-medium text-muted-foreground"> d</span>
              </p>
              {streak.best > streak.current && (
                <p className="text-xs text-muted-foreground">best {streak.best}</p>
              )}
            </div>
          </div>
          <Progress value={goal > 0 ? Math.min(100, (score / goal) * 100) : 0} />
          <p
            className={cn(
              "rounded-md border-l-4 px-3 py-2 text-sm",
              streak.todayMet
                ? "border-success bg-success/10 text-success"
                : "border-warning bg-warning/10 text-warning",
            )}
          >
            {streak.todayMet ? (
              <>
                <strong>Target achieved.</strong> The data reflects the effort — keep compounding.
              </>
            ) : (
              <>
                <strong>{goal - score} points to go</strong> to keep the streak alive.
              </>
            )}
          </p>
        </CardContent>
      </Card>

      {yesterdayScore !== null && (
        <Card>
          <CardContent className="flex items-center justify-between p-4 text-sm">
            <span className="text-muted-foreground">Yesterday ({dateKeyLabel(yesterdayKey)})</span>
            <span
              className={cn("font-semibold", goalMet(yesterdayScore, goal) ? "text-success" : "text-warning")}
            >
              {yesterdayScore} / {goal} pts — {goalMet(yesterdayScore, goal) ? "target hit" : "target missed"}
            </span>
          </CardContent>
        </Card>
      )}

      <ul className="space-y-2">
        {activeHabits.map((habit) => {
          const isChecked = checked.has(habit.id);
          return (
            <li key={habit.id}>
              <button
                type="button"
                aria-pressed={isChecked}
                onClick={() => void toggleHabit(todayKey, habit.id)}
                className={cn(
                  "flex min-h-14 w-full items-center gap-3 rounded-lg border bg-card px-4 py-3 text-left transition-colors",
                  isChecked ? "border-success/50 bg-success/10" : "hover:bg-muted",
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                    isChecked ? "border-success bg-success text-success-foreground" : "border-input",
                  )}
                >
                  {isChecked && <Check className="h-4 w-4" />}
                </span>
                <span
                  className={cn(
                    "flex-1 font-medium",
                    isChecked && "text-muted-foreground line-through decoration-success/60",
                  )}
                >
                  {habit.name}
                </span>
                <span className="text-sm font-semibold text-muted-foreground">+{habit.points}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
