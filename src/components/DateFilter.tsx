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
  { value: "month", label: "Lună" },
  { value: "custom", label: "Interval" },
];

/** Top-of-dashboard filter: all data, a specific month, or a custom range. */
export default function DateFilter({ filter, months, onChange }: DateFilterProps) {
  function selectMode(mode: FilterMode) {
    if (mode === "month") {
      // Default to the most recent month with data.
      const monthKey = filter.monthKey ?? months[months.length - 1]?.key;
      onChange({ mode: "month", monthKey });
    } else if (mode === "custom") {
      onChange({ mode: "custom", from: filter.from, to: filter.to });
    } else {
      onChange({ mode: "all" });
    }
  }

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex flex-wrap items-center gap-4">
        <div className="inline-flex rounded-lg bg-zinc-100 p-1 dark:bg-zinc-800">
          {MODES.map((m) => (
            <button
              key={m.value}
              onClick={() => selectMode(m.value)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                filter.mode === m.value
                  ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-950 dark:text-zinc-50"
                  : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
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
            className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          >
            {months.length === 0 && <option value="">Nicio lună</option>}
            {months.map((m) => (
              <option key={m.key} value={m.key}>
                {m.label}
              </option>
            ))}
          </select>
        )}

        {filter.mode === "custom" && (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <label className="flex items-center gap-1 text-zinc-500 dark:text-zinc-400">
              De la
              <input
                type="date"
                value={filter.from ?? ""}
                onChange={(e) =>
                  onChange({ ...filter, mode: "custom", from: e.target.value })
                }
                className="rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              />
            </label>
            <label className="flex items-center gap-1 text-zinc-500 dark:text-zinc-400">
              Până la
              <input
                type="date"
                value={filter.to ?? ""}
                onChange={(e) =>
                  onChange({ ...filter, mode: "custom", to: e.target.value })
                }
                className="rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              />
            </label>
          </div>
        )}
      </div>
    </div>
  );
}
