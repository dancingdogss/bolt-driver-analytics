"use client";

import type {
  DateRangeFilter,
  FilterMode,
  MonthOption,
} from "@/lib/analytics/dateFilter";

interface DateFilterProps {
  filter: DateRangeFilter;
  months: MonthOption[];
  onChange: (filter: DateRangeFilter) => void;
}

const MODES: { value: FilterMode; label: string; shortLabel: string }[] = [
  { value: "all", label: "Toate datele", shortLabel: "Toate" },
  { value: "month", label: "Alege luna", shortLabel: "Luna" },
  { value: "custom", label: "Perioadă personalizată", shortLabel: "Perioadă" },
];

const inputClass =
  "rounded-lg border border-zinc-600 bg-zinc-950 px-3 py-2 text-base text-zinc-100 focus:border-emerald-500 focus:outline-none";

/** Top-of-dashboard filter: all data, a specific month, or a custom range. */
export default function DateFilter({ filter, months, onChange }: DateFilterProps) {
  function selectMode(mode: FilterMode) {
    if (mode === "month") {
      const monthKey = filter.monthKey ?? months[months.length - 1]?.key;
      onChange({ mode: "month", monthKey });
    } else if (mode === "custom") {
      onChange({ mode: "custom", from: filter.from, to: filter.to });
    } else {
      onChange({ mode: "all" });
    }
  }

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-center gap-4">
        <div
          className="flex w-full rounded-lg bg-zinc-800 p-1 sm:inline-flex sm:w-auto"
          role="group"
          aria-label="Alege perioada afișată"
        >
          {MODES.map((m) => (
            <button
              key={m.value}
              onClick={() => selectMode(m.value)}
              aria-pressed={filter.mode === m.value}
              className={`flex-1 rounded-md px-3 py-2.5 text-base font-medium transition-colors sm:flex-none sm:px-4 ${
                filter.mode === m.value
                  ? "bg-zinc-950 text-zinc-50 shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {/* Short label on phones so the three options fit side by side. */}
              <span className="sm:hidden">{m.shortLabel}</span>
              <span className="hidden sm:inline">{m.label}</span>
            </button>
          ))}
        </div>

        {filter.mode === "month" && (
          <label className="flex w-full items-center gap-2 text-base text-zinc-300 sm:w-auto">
            Luna
            <select
              value={filter.monthKey ?? ""}
              onChange={(e) => onChange({ mode: "month", monthKey: e.target.value })}
              className={`${inputClass} flex-1 sm:flex-none`}
            >
              {months.length === 0 && <option value="">Nicio lună</option>}
              {months.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
        )}

        {filter.mode === "custom" && (
          <div className="flex w-full flex-col gap-3 text-base text-zinc-300 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
            <label className="flex items-center gap-2">
              <span className="w-16 shrink-0 sm:w-auto">De la</span>
              <input
                type="date"
                value={filter.from ?? ""}
                onChange={(e) =>
                  onChange({ ...filter, mode: "custom", from: e.target.value })
                }
                className={`${inputClass} flex-1 sm:flex-none`}
              />
            </label>
            <label className="flex items-center gap-2">
              <span className="w-16 shrink-0 sm:w-auto">Până la</span>
              <input
                type="date"
                value={filter.to ?? ""}
                onChange={(e) =>
                  onChange({ ...filter, mode: "custom", to: e.target.value })
                }
                className={`${inputClass} flex-1 sm:flex-none`}
              />
            </label>
          </div>
        )}
      </div>
    </div>
  );
}
