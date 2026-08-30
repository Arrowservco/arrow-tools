"use client";

import { useGameStore } from "../state/store";

export function SettingsPanel() {
  const settings = useGameStore((s) => s.settings);
  const updateSettings = useGameStore((s) => s.updateSettings);

  return (
    <div className="flex w-full max-w-sm flex-col gap-4 text-left text-sm text-[#e8ead9]">
      <label className="flex flex-col gap-1">
        <span className="flex justify-between text-xs uppercase tracking-wide text-[#b9b5a8]">
          <span>Field of view</span>
          <span>{settings.fov}°</span>
        </span>
        <input
          type="range"
          min={60}
          max={100}
          value={settings.fov}
          onChange={(e) => updateSettings({ fov: Number(e.target.value) })}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="flex justify-between text-xs uppercase tracking-wide text-[#b9b5a8]">
          <span>Volume</span>
          <span>{Math.round(settings.volume * 100)}%</span>
        </span>
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(settings.volume * 100)}
          onChange={(e) => updateSettings({ volume: Number(e.target.value) / 100 })}
        />
      </label>

      <Toggle
        label="Head bob"
        checked={settings.headBob}
        onChange={(v) => updateSettings({ headBob: v })}
      />
      <Toggle
        label="Film grain"
        checked={settings.filmGrain}
        onChange={(v) => updateSettings({ filmGrain: v })}
      />
      <Toggle
        label="Flicker-reduction (fades instead of snaps)"
        checked={settings.flickerReduction}
        onChange={(v) => updateSettings({ flickerReduction: v })}
      />
      <Toggle
        label="Guided (faint draft toward the exit)"
        checked={settings.guided}
        onChange={(v) => updateSettings({ guided: v })}
      />
      <Toggle
        label="Show touch controls"
        checked={settings.touchControls}
        onChange={(v) => updateSettings({ touchControls: v })}
      />
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 rounded-md border border-[#4a4844] px-3 py-2">
      <span className="text-xs text-[#e8ead9]">{label}</span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}
