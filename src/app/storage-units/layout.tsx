import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "The Storage Units",
  description:
    "A walkthrough-only liminal-space exploration game: an endless indoor self-storage facility.",
};

export default function StorageUnitsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
