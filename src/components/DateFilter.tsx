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

const MODES: { value: FilterMode; label: string }[] = [
  { value: "all", label: "Toate datele" },
  { value: "month", label: "Alege luna" },
  { value: "custom", label: "Perioadă personalizată" },
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
          className="inline-flex flex-wrap rounded-lg bg-zinc-800 p-1"
          role="group"
          aria-label="Alege perioada afișată"
        >
          {MODES.map((m) => (
            <button
              key={m.value}
              onClick={() => selectMode(m.value)}
              aria-pressed={filter.mode === m.value}
              className={`rounded-md px-4 py-2 text-base font-medium transition-colors ${
                filter.mode === m.value
                  ? "bg-zinc-950 text-zinc-50 shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        {filter.mode === "month" && (
          <label className="flex items-center gap-2 text-base text-zinc-300">
            Luna
            <select
              value={filter.monthKey ?? ""}
              onChange={(e) => onChange({ mode: "month", monthKey: e.target.value })}
              className={inputClass}
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
          <div className="flex flex-wrap items-center gap-3 text-base text-zinc-300">
            <label className="flex items-center gap-2">
              De la
              <input
                type="date"
                value={filter.from ?? ""}
                onChange={(e) =>
                  onChange({ ...filter, mode: "custom", from: e.target.value })
                }
                className={inputClass}
              />
            </label>
            <label className="flex items-center gap-2">
              Până la
              <input
                type="date"
                value={filter.to ?? ""}
                onChange={(e) =>
                  onChange({ ...filter, mode: "custom", to: e.target.value })
                }
                className={inputClass}
              />
            </label>
          </div>
        )}
      </div>
    </div>
  );
}
