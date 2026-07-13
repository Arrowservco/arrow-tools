import { SettingsScreen } from "@/features/settings/SettingsScreen";

export const metadata = { title: "Settings — BidLens" };

export default function SettingsPage() {
  return (
    <main className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">Provider, keys, and sourcing profile</p>
      </header>
      <SettingsScreen />
    </main>
  );
}
