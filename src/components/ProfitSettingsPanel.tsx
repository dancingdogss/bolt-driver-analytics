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
  { key: "boltCommissionPercent", label: "Comision Bolt (estimat)", suffix: "%", max: 100 },
  { key: "fleetCommissionPercent", label: "Comision flotă", suffix: "%", max: 100 },
  { key: "weeklyCarRent", label: "Chirie mașină / săptămână", suffix: "RON" },
  { key: "weeklyFuelCost", label: "Combustibil / săptămână", suffix: "RON" },
  { key: "weeklyEmploymentCost", label: "Carte de muncă / săptămână", suffix: "RON" },
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
    <details className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <summary className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-zinc-700 dark:text-zinc-200">
        <SlidersHorizontal className="h-4 w-4" />
        Ipoteze de cost (editabile)
      </summary>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FIELDS.map((field) => (
          <label key={field.key} className="flex flex-col gap-1 text-sm">
            <span className="text-zinc-500 dark:text-zinc-400">{field.label}</span>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                max={field.max}
                step="any"
                value={settings[field.key]}
                onChange={(e) => update(field.key, e.target.value)}
                className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-zinc-800 tabular-nums dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              />
              <span className="text-xs text-zinc-400">{field.suffix}</span>
            </div>
          </label>
        ))}
      </div>

      <button
        onClick={() => onChange({ ...DEFAULT_PROFIT_SETTINGS })}
        className="mt-4 inline-flex items-center gap-2 rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-600 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
      >
        <RotateCcw className="h-4 w-4" />
        Resetează la valorile implicite
      </button>
    </details>
  );
}
