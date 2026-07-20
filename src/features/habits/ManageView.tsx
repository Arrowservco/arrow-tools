"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { ArchiveRestore, ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { exportBackup, habitsDb, importBackup } from "@/lib/habits/db";
import { maxScore } from "@/lib/habits/scoring";
import type { Habit, HabitsBackup } from "@/lib/habits/types";
import { useHabitsData } from "./useHabitsData";

export function ManageView() {
  const { habits, activeHabits, settings, setSettings } = useHabitsData();
  const [newName, setNewName] = useState("");
  const [newPoints, setNewPoints] = useState("2");
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (habits === null) {
    return <Skeleton className="h-96 w-full" />;
  }

  const archived = habits.filter((h) => h.archived);
  const possible = maxScore(habits);

  const updateHabit = (id: string, patch: Partial<Habit>) => {
    void habitsDb.habits.update(id, patch);
  };

  const move = (habit: Habit, dir: -1 | 1) => {
    const idx = activeHabits.findIndex((h) => h.id === habit.id);
    const neighbor = activeHabits[idx + dir];
    if (!neighbor) return;
    void habitsDb.transaction("rw", habitsDb.habits, async () => {
      await habitsDb.habits.update(habit.id, { order: neighbor.order });
      await habitsDb.habits.update(neighbor.id, { order: habit.order });
    });
  };

  const addHabit = () => {
    const name = newName.trim();
    const points = Math.max(1, Math.round(Number(newPoints) || 1));
    if (!name) return;
    const order = habits.reduce((max, h) => Math.max(max, h.order), -1) + 1;
    void habitsDb.habits.add({
      id: crypto.randomUUID(),
      name,
      points,
      order,
      archived: false,
      createdAt: new Date().toISOString(),
    });
    setNewName("");
    setNewPoints("2");
  };

  const deleteHabit = (habit: Habit) => {
    if (!window.confirm(`Delete "${habit.name}" permanently? Its history checkmarks stop scoring. Archiving keeps history scored.`)) return;
    void habitsDb.habits.delete(habit.id);
  };

  const handleExport = async () => {
    const backup = await exportBackup();
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `habits-backup-${backup.exportedAt.slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text()) as HabitsBackup;
      if (!window.confirm("Importing replaces all current habits and history. Continue?")) return;
      await importBackup(parsed);
      setSettings(parsed.settings ?? settings);
      toast.success("Backup imported.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not read that backup file.");
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Daily goal</CardTitle>
          <CardDescription>
            Points needed for a day to count toward your streak ({possible} available).
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-3">
          <Input
            type="number"
            inputMode="numeric"
            min={1}
            value={settings.dailyGoal}
            onChange={(e) => {
              const goal = Math.round(Number(e.target.value));
              if (Number.isFinite(goal) && goal > 0) setSettings({ dailyGoal: goal });
            }}
            className="w-24"
            aria-label="Daily goal points"
          />
          <span className="text-sm text-muted-foreground">pts / day</span>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Habits</CardTitle>
          <CardDescription>Rename, retune points (history rescoring is automatic), reorder, or archive.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {activeHabits.map((habit, idx) => (
            <div key={habit.id} className="flex items-center gap-2">
              <div className="flex flex-col">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 min-h-0"
                  aria-label={`Move ${habit.name} up`}
                  disabled={idx === 0}
                  onClick={() => move(habit, -1)}
                >
                  <ArrowUp className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 min-h-0"
                  aria-label={`Move ${habit.name} down`}
                  disabled={idx === activeHabits.length - 1}
                  onClick={() => move(habit, 1)}
                >
                  <ArrowDown className="h-3 w-3" />
                </Button>
              </div>
              <Input
                defaultValue={habit.name}
                aria-label="Habit name"
                onBlur={(e) => {
                  const name = e.target.value.trim();
                  if (name && name !== habit.name) updateHabit(habit.id, { name });
                }}
                className="flex-1"
              />
              <Input
                type="number"
                inputMode="numeric"
                min={1}
                defaultValue={habit.points}
                aria-label={`Points for ${habit.name}`}
                onBlur={(e) => {
                  const points = Math.round(Number(e.target.value));
                  if (Number.isFinite(points) && points > 0 && points !== habit.points) {
                    updateHabit(habit.id, { points });
                  }
                }}
                className="w-16 text-center"
              />
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Archive ${habit.name}`}
                onClick={() => updateHabit(habit.id, { archived: true })}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}

          <div className="flex items-center gap-2 border-t pt-3">
            <Input
              placeholder="New habit…"
              value={newName}
              aria-label="New habit name"
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addHabit()}
              className="flex-1"
            />
            <Input
              type="number"
              inputMode="numeric"
              min={1}
              value={newPoints}
              aria-label="New habit points"
              onChange={(e) => setNewPoints(e.target.value)}
              className="w-16 text-center"
            />
            <Button variant="accent" size="icon" aria-label="Add habit" onClick={addHabit} disabled={!newName.trim()}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {archived.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Archived</CardTitle>
            <CardDescription>Off the checklist; past check-offs still score.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {archived.map((habit) => (
              <div key={habit.id} className="flex items-center gap-2 text-sm">
                <span className="flex-1 text-muted-foreground">{habit.name}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => updateHabit(habit.id, { archived: false })}
                >
                  <ArchiveRestore className="h-4 w-4" /> Restore
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive"
                  onClick={() => deleteHabit(habit)}
                >
                  <Trash2 className="h-4 w-4" /> Delete
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Backup</CardTitle>
          <CardDescription>Data lives only in this browser. Export a JSON backup to move or restore it.</CardDescription>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Button variant="outline" onClick={() => void handleExport()}>
            Export JSON
          </Button>
          <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
            Import JSON
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleImport(file);
              e.target.value = "";
            }}
          />
          <Label className="sr-only">Import backup file</Label>
        </CardContent>
      </Card>
    </div>
  );
}
