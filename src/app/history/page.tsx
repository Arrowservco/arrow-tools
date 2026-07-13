import { HistoryList } from "@/features/history/HistoryList";

export const metadata = { title: "History — BidLens" };

export default function HistoryPage() {
  return (
    <main className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">History</h1>
        <p className="text-sm text-muted-foreground">Saved evaluations (stored locally in this browser)</p>
      </header>
      <HistoryList />
    </main>
  );
}
