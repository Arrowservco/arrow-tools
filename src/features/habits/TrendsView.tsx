"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  computeStreak,
  dateKeyLabel,
  dayScore,
  habitRates,
  localDateKey,
  maxScore,
  shiftDateKey,
  trendDays,
  type TrendDay,
} from "@/lib/habits/scoring";
import { useHabitsData } from "./useHabitsData";

const TREND_WINDOW = 14;
const RATE_WINDOW = 30;
const HEATMAP_WEEKS = 12;

export function TrendsView() {
  const { habits, logs, settings } = useHabitsData();
  const todayKey = localDateKey(new Date());

  if (habits === null || logs === null) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-56 w-full" />
        <Skeleton className="h-56 w-full" />
      </div>
    );
  }

  const goal = settings.dailyGoal;
  const streak = computeStreak(logs, habits, goal, todayKey);
  const trend = trendDays(logs, habits, goal, todayKey, TREND_WINDOW);
  const recent = trendDays(logs, habits, goal, todayKey, RATE_WINDOW);
  const hitDays = recent.filter((d) => d.met).length;
  const rates = habitRates(logs, habits, todayKey, RATE_WINDOW);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        <StatTile label="Streak" value={`${streak.current}d`} />
        <StatTile label="Best" value={`${streak.best}d`} />
        <StatTile label="30-day hits" value={`${hitDays}/${RATE_WINDOW}`} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{TREND_WINDOW}-day consistency</CardTitle>
        </CardHeader>
        <CardContent>
          <TrendChart trend={trend} goal={goal} possible={maxScore(habits)} />
          <p className="mt-2 text-xs text-muted-foreground">
            <span aria-hidden className="mr-1 inline-block h-2 w-2 rounded-sm bg-success" />
            goal hit · <span aria-hidden className="mx-1 inline-block h-2 w-2 rounded-sm bg-warning" />
            missed · dashed line = daily goal ({goal} pts)
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Last {HEATMAP_WEEKS} weeks</CardTitle>
        </CardHeader>
        <CardContent>
          <Heatmap logs={logs} habits={habits} goal={goal} todayKey={todayKey} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Habit completion ({RATE_WINDOW} days)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {rates.map(({ habit, checkedDays, eligibleDays, rate }) => (
            <div key={habit.id}>
              <div className="mb-1 flex items-baseline justify-between text-sm">
                <span className="font-medium">{habit.name}</span>
                <span className="text-muted-foreground">
                  {checkedDays}/{eligibleDays} · {rate === null ? "—" : `${Math.round(rate * 100)}%`}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-accent transition-all"
                  style={{ width: `${Math.round((rate ?? 0) * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-3 text-center">
        <p className="text-xl font-black">{value}</p>
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}

function TrendChart({ trend, goal, possible }: { trend: TrendDay[]; goal: number; possible: number }) {
  const width = 560;
  const height = 200;
  const pad = { top: 16, right: 8, bottom: 24, left: 26 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const yMax = Math.max(possible, goal, ...trend.map((d) => d.score), 1);
  const step = plotW / trend.length;
  const barW = Math.min(28, step - 4);
  const y = (v: number) => pad.top + plotH - (v / yMax) * plotH;
  const goalY = y(goal);
  const lastIndex = trend.length - 1;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`Daily points for the last ${trend.length} days against a goal of ${goal}`}
      className="w-full"
    >
      {[0, yMax].map((v) => (
        <text
          key={v}
          x={pad.left - 6}
          y={y(v) + 4}
          textAnchor="end"
          className="fill-muted-foreground text-[10px]"
        >
          {v}
        </text>
      ))}
      <line
        x1={pad.left}
        x2={width - pad.right}
        y1={pad.top + plotH}
        y2={pad.top + plotH}
        className="stroke-border"
        strokeWidth={1}
      />
      <line
        x1={pad.left}
        x2={width - pad.right}
        y1={goalY}
        y2={goalY}
        className="stroke-muted-foreground"
        strokeWidth={1.5}
        strokeDasharray="5 4"
      />
      {trend.map((d, i) => {
        const x = pad.left + i * step + (step - barW) / 2;
        const barH = Math.max(d.score > 0 ? 3 : 0, ((d.score / yMax) * plotH) | 0);
        const weekday = dateKeyLabel(d.date, { weekday: "narrow" });
        return (
          <g key={d.date}>
            <rect x={pad.left + i * step + 1} y={pad.top} width={step - 2} height={plotH} fill="transparent">
              <title>{`${dateKeyLabel(d.date)}: ${d.score} / ${goal} pts${d.met ? " — goal hit" : ""}`}</title>
            </rect>
            {barH > 0 && (
              <rect
                x={x}
                y={y(d.score)}
                width={barW}
                height={barH}
                rx={3}
                className={cn("pointer-events-none", d.met ? "fill-success" : "fill-warning")}
              />
            )}
            {i === lastIndex && d.score > 0 && (
              <text
                x={x + barW / 2}
                y={y(d.score) - 5}
                textAnchor="middle"
                className="fill-foreground text-[11px] font-semibold"
              >
                {d.score}
              </text>
            )}
            <text
              x={pad.left + i * step + step / 2}
              y={height - 8}
              textAnchor="middle"
              className={cn(
                "text-[10px]",
                i === lastIndex ? "fill-foreground font-semibold" : "fill-muted-foreground",
              )}
            >
              {weekday}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function Heatmap({
  logs,
  habits,
  goal,
  todayKey,
}: {
  logs: NonNullable<ReturnType<typeof useHabitsData>["logs"]>;
  habits: NonNullable<ReturnType<typeof useHabitsData>["habits"]>;
  goal: number;
  todayKey: string;
}) {
  const byDate = new Map(logs.map((l) => [l.date, l]));
  const [y, m, d] = todayKey.split("-").map(Number);
  const todayDow = new Date(y, m - 1, d).getDay();
  const daysBack = HEATMAP_WEEKS * 7 - (6 - todayDow) - 1;

  const weeks: { date: string; future: boolean }[][] = [];
  for (let w = 0; w < HEATMAP_WEEKS; w++) {
    const week: { date: string; future: boolean }[] = [];
    for (let dow = 0; dow < 7; dow++) {
      const offset = -daysBack + w * 7 + dow;
      const date = shiftDateKey(todayKey, offset);
      week.push({ date, future: date > todayKey });
    }
    weeks.push(week);
  }

  return (
    <div className="flex justify-between gap-1" role="img" aria-label="Daily score heatmap, last 12 weeks">
      {weeks.map((week, wi) => (
        <div key={wi} className="flex flex-1 flex-col gap-1">
          {week.map(({ date, future }) => {
            const log = byDate.get(date);
            const score = log ? dayScore(log.checkedHabitIds, habits) : 0;
            const frac = goal > 0 ? Math.min(1, score / goal) : 0;
            const met = goal > 0 && score >= goal;
            return (
              <div
                key={date}
                title={future ? undefined : `${dateKeyLabel(date)}: ${score} / ${goal} pts`}
                className={cn(
                  "aspect-square w-full rounded-sm",
                  future ? "bg-transparent" : met ? "bg-success" : "bg-muted",
                  date === todayKey && "ring-1 ring-ring",
                )}
                style={
                  !future && !met && frac > 0
                    ? { backgroundColor: "color-mix(in oklab, var(--success) " + Math.round(25 + frac * 55) + "%, var(--muted))" }
                    : undefined
                }
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}
