"use client";

import { Info, RotateCcw, SlidersHorizontal } from "lucide-react";
import {
  DEFAULT_EXPENSE_SETTINGS,
  EXPENSE_KEYS,
  EXPENSE_LABELS,
  EXPENSE_PRESETS,
  FREQUENCY_LABELS,
  type ExpenseFrequency,
  type ExpenseKey,
  type ExpensePresetId,
  type ExpenseSettings,
} from "@/lib/analytics/calculateExpenses";

interface ProfitSettingsPanelProps {
  settings: ExpenseSettings;
  onChange: (settings: ExpenseSettings) => void;
}

const FREQUENCIES: ExpenseFrequency[] = [
  "perDay",
  "perWeek",
  "perMonth",
  "perKm",
  "percentOfRevenue",
];

/** Plain-language notes shown under the cost inputs. */
const EXPLANATIONS = [
  "Venitul mare nu înseamnă automat profit mare.",
  "Costurile săptămânale sunt transformate automat pentru luna selectată.",
  "Dacă încarci PDF-ul lunar, aplicația folosește Taxa Bolt reală și kilometrii reali.",
  "Dacă nu există PDF, unele valori sunt estimate.",
];

/**
 * Editable cost assumptions used by the profit estimate: one row per cost with
 * a value and a frequency, plus simple presets. Always visible — older users
 * should never have to discover a collapsed panel to edit costs.
 */
export default function ProfitSettingsPanel({
  settings,
  onChange,
}: ProfitSettingsPanelProps) {
  function updateValue(key: ExpenseKey, raw: string) {
    const value = raw === "" ? 0 : Number(raw);
    if (Number.isNaN(value) || value < 0) return;
    onChange({
      ...settings,
      items: { ...settings.items, [key]: { ...settings.items[key], value } },
    });
  }

  function updateFrequency(key: ExpenseKey, frequency: ExpenseFrequency) {
    onChange({
      ...settings,
      items: { ...settings.items, [key]: { ...settings.items[key], frequency } },
    });
  }

  function updateBoltPercent(raw: string) {
    const value = raw === "" ? 0 : Number(raw);
    if (Number.isNaN(value) || value < 0 || value > 100) return;
    onChange({ ...settings, boltCommissionPercent: value });
  }

  function applyPreset(id: ExpensePresetId) {
    const preset = EXPENSE_PRESETS.find((p) => p.id === id);
    if (!preset) return;
    // Presets change only the cost items; the Bolt % stays as configured.
    onChange({ ...settings, items: { ...preset.items } });
  }

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 shadow-sm sm:p-6">
      <h3 className="flex items-center gap-2 text-lg font-semibold text-zinc-100">
        <SlidersHorizontal className="h-5 w-5 text-zinc-400" aria-hidden />
        Costuri folosite pentru calcul
      </h3>
      <p className="mt-1 text-sm text-zinc-400">
        Alege un preset sau completează costurile tale reale. Poți modifica
        orice valoare după aplicarea presetului.
      </p>

      {/* Presets */}
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {EXPENSE_PRESETS.map((preset) => (
          <button
            key={preset.id}
            onClick={() => applyPreset(preset.id)}
            className="rounded-xl border border-zinc-700 bg-zinc-800/40 p-4 text-left transition-colors hover:border-emerald-700 hover:bg-emerald-950/20"
          >
            <p className="text-base font-semibold text-zinc-100">{preset.label}</p>
            <p className="mt-1 text-sm leading-snug text-zinc-400">
              {preset.description}
            </p>
          </button>
        ))}
      </div>

      {/* Cost rows: value + frequency */}
      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {EXPENSE_KEYS.map((key) => {
          const item = settings.items[key];
          return (
            <div key={key} className="flex flex-col gap-1.5 text-base">
              <span className="text-zinc-300">{EXPENSE_LABELS[key]}</span>
              <div className="flex items-stretch gap-2">
                <input
                  type="number"
                  min={0}
                  step="any"
                  value={item.value}
                  onChange={(e) => updateValue(key, e.target.value)}
                  aria-label={`${EXPENSE_LABELS[key]} — valoare`}
                  className="w-full min-w-0 rounded-lg border border-zinc-600 bg-zinc-950 px-3 py-2.5 text-base text-zinc-100 tabular-nums focus:border-emerald-500 focus:outline-none"
                />
                <select
                  value={item.frequency}
                  onChange={(e) =>
                    updateFrequency(key, e.target.value as ExpenseFrequency)
                  }
                  aria-label={`${EXPENSE_LABELS[key]} — frecvență`}
                  className="shrink-0 rounded-lg border border-zinc-600 bg-zinc-950 px-2 py-2.5 text-sm text-zinc-200 focus:border-emerald-500 focus:outline-none"
                >
                  {FREQUENCIES.map((f) => (
                    <option key={f} value={f}>
                      {FREQUENCY_LABELS[f]}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          );
        })}

        {/* Bolt commission estimate — replaced by the real fee when a PDF matches */}
        <div className="flex flex-col gap-1.5 text-base">
          <span className="text-zinc-300">Comision Bolt estimat (%)</span>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              max={100}
              step="any"
              value={settings.boltCommissionPercent}
              onChange={(e) => updateBoltPercent(e.target.value)}
              aria-label="Comision Bolt estimat — procent"
              className="w-full min-w-0 rounded-lg border border-zinc-600 bg-zinc-950 px-3 py-2.5 text-base text-zinc-100 tabular-nums focus:border-emerald-500 focus:outline-none"
            />
            <span className="shrink-0 text-sm text-zinc-400">%</span>
          </div>
          <span className="text-xs text-zinc-500">
            Folosit doar când nu există PDF lunar pentru luna selectată.
          </span>
        </div>
      </div>

      {/* Simple explanations */}
      <div className="mt-5 space-y-1.5 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4">
        {EXPLANATIONS.map((text) => (
          <p key={text} className="flex gap-2 text-sm text-zinc-400">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-zinc-500" aria-hidden />
            {text}
          </p>
        ))}
      </div>

      <button
        onClick={() => onChange({ ...DEFAULT_EXPENSE_SETTINGS })}
        className="mt-5 inline-flex items-center gap-2 rounded-lg border border-zinc-600 px-4 py-2.5 text-base text-zinc-200 transition-colors hover:bg-zinc-800"
      >
        <RotateCcw className="h-5 w-5" aria-hidden />
        Resetează valorile standard
      </button>
    </section>
  );
}
