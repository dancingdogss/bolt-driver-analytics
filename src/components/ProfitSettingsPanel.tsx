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
  { key: "boltCommissionPercent", label: "Comision Bolt estimat (%)", suffix: "%", max: 100 },
  { key: "fleetCommissionPercent", label: "Comision flotă (%)", suffix: "%", max: 100 },
  { key: "weeklyCarRent", label: "Chirie mașină / săptămână", suffix: "RON" },
  { key: "weeklyFuelCost", label: "Combustibil / săptămână", suffix: "RON" },
  { key: "weeklyEmploymentCost", label: "Carte de muncă / săptămână", suffix: "RON" },
];

/**
 * Editable MVP cost assumptions used by the profit estimate. Always visible —
 * older users should never have to discover a collapsed panel to edit costs.
 */
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
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 shadow-sm sm:p-6">
      <h3 className="flex items-center gap-2 text-lg font-semibold text-zinc-100">
        <SlidersHorizontal className="h-5 w-5 text-zinc-400" aria-hidden />
        Costuri folosite pentru calcul
      </h3>
      <p className="mt-1 text-sm text-zinc-400">
        Poți modifica aceste valori în funcție de situația ta reală.
      </p>

      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FIELDS.map((field) => (
          <label key={field.key} className="flex flex-col gap-1.5 text-base">
            <span className="text-zinc-300">{field.label}</span>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                max={field.max}
                step="any"
                value={settings[field.key]}
                onChange={(e) => update(field.key, e.target.value)}
                className="w-full rounded-lg border border-zinc-600 bg-zinc-950 px-3 py-2.5 text-base text-zinc-100 tabular-nums focus:border-emerald-500 focus:outline-none"
              />
              <span className="text-sm text-zinc-400">{field.suffix}</span>
            </div>
          </label>
        ))}
      </div>

      <button
        onClick={() => onChange({ ...DEFAULT_PROFIT_SETTINGS })}
        className="mt-5 inline-flex items-center gap-2 rounded-lg border border-zinc-600 px-4 py-2.5 text-base text-zinc-200 transition-colors hover:bg-zinc-800"
      >
        <RotateCcw className="h-5 w-5" aria-hidden />
        Resetează valorile standard
      </button>
    </section>
  );
}
