import { HabitsTabs } from "@/features/habits/HabitsTabs";
import { TodayDate } from "@/features/habits/TodayDate";

export const metadata = { title: "Habits — BidLens" };

export default function HabitsLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <main className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Habits</h1>
        <TodayDate />
      </header>
      <HabitsTabs />
      {children}
    </main>
  );
}
