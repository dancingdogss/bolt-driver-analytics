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
  { value: "all", label: "All data" },
  { value: "month", label: "Month" },
  { value: "custom", label: "Custom range" },
];

const inputClass =
  "rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none";

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
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-4">
        <div className="inline-flex rounded-lg bg-zinc-800 p-1">
          {MODES.map((m) => (
            <button
              key={m.value}
              onClick={() => selectMode(m.value)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
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
          <select
            value={filter.monthKey ?? ""}
            onChange={(e) => onChange({ mode: "month", monthKey: e.target.value })}
            className={inputClass}
          >
            {months.length === 0 && <option value="">No months</option>}
            {months.map((m) => (
              <option key={m.key} value={m.key}>
                {m.label}
              </option>
            ))}
          </select>
        )}

        {filter.mode === "custom" && (
          <div className="flex flex-wrap items-center gap-2 text-sm text-zinc-400">
            <label className="flex items-center gap-1.5">
              From
              <input
                type="date"
                value={filter.from ?? ""}
                onChange={(e) =>
                  onChange({ ...filter, mode: "custom", from: e.target.value })
                }
                className={inputClass}
              />
            </label>
            <label className="flex items-center gap-1.5">
              To
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
