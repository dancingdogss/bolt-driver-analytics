"use client";

import { RotateCcw, SlidersHorizontal } from "lucide-react";
import {
  DEFAULT_PROFIT_SETTINGS,
  type ProfitSettings,
} from "@/lib/analytics/estimateProfit";

interface ProfitSettingsPanelProps {
  settings: ProfitSettings;
  onChange: (settings: ProfitSettings) => void;
}

interface Field {
  key: keyof ProfitSettings;
  label: string;
  suffix: string;
  max?: number;
}

const FIELDS: Field[] = [
  { key: "boltCommissionPercent", label: "Bolt commission (estimate)", suffix: "%", max: 100 },
  { key: "fleetCommissionPercent", label: "Fleet commission", suffix: "%", max: 100 },
  { key: "weeklyCarRent", label: "Car rent / week", suffix: "RON" },
  { key: "weeklyFuelCost", label: "Fuel cost / week", suffix: "RON" },
  { key: "weeklyEmploymentCost", label: "Employment (carte de muncă) / week", suffix: "RON" },
];

/** Editable MVP cost assumptions used by the profit estimate. */
export default function ProfitSettingsPanel({
  settings,
  onChange,
}: ProfitSettingsPanelProps) {
  function update(key: keyof ProfitSettings, raw: string) {
    const value = raw === "" ? 0 : Number(raw);
    if (Number.isNaN(value) || value < 0) return;
    onChange({ ...settings, [key]: value });
  }

  return (
    <details className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4 shadow-sm">
      <summary className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-zinc-200">
        <SlidersHorizontal className="h-4 w-4" />
        Cost assumptions (editable)
      </summary>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FIELDS.map((field) => (
          <label key={field.key} className="flex flex-col gap-1 text-sm">
            <span className="text-zinc-400">{field.label}</span>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                max={field.max}
                step="any"
                value={settings[field.key]}
                onChange={(e) => update(field.key, e.target.value)}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-zinc-100 tabular-nums focus:border-emerald-500 focus:outline-none"
              />
              <span className="text-xs text-zinc-500">{field.suffix}</span>
            </div>
          </label>
        ))}
      </div>

      <button
        onClick={() => onChange({ ...DEFAULT_PROFIT_SETTINGS })}
        className="mt-4 inline-flex items-center gap-2 rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 transition-colors hover:bg-zinc-800"
      >
        <RotateCcw className="h-4 w-4" />
        Reset defaults
      </button>
    </details>
  );
}
