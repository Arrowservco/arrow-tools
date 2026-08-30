"use client";

import dynamic from "next/dynamic";

const Game = dynamic(() => import("@/features/storage-units/Game"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-black text-xs uppercase tracking-widest text-[#6f6f6a]">
      Loading facility…
    </div>
  ),
});

export default function StorageUnitsPage() {
  return <Game />;
}
