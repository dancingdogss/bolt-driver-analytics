"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { AlertTriangle, FileWarning, Trash2 } from "lucide-react";
import { parseBoltFiles } from "@/lib/parsers/boltCsvParser";
import { calculateBoltMetrics } from "@/lib/analytics/calculateBoltMetrics";
import {
  ALL_FILTER,
  countSelectedDays,
  describeFilter,
  filterTrips,
  getAvailableMonths,
  getMonthlyRevenue,
  type DateRangeFilter,
} from "@/lib/analytics/dateFilter";
import {
  calculateProfit,
  DEFAULT_PROFIT_SETTINGS,
  profitSettingsSchema,
  type ProfitSettings,
} from "@/lib/analytics/estimateProfit";
import type { BoltTrip, ImportSummary } from "@/lib/types/bolt";
import { formatNumber } from "@/lib/utils/money";
import UploadZone from "@/components/UploadZone";
import DateFilter from "@/components/DateFilter";
import RevenueByMonthTable from "@/components/RevenueByMonthTable";
import ProfitSettingsPanel from "@/components/ProfitSettingsPanel";
import EstimatedProfitCard from "@/components/EstimatedProfitCard";
import KpiCards from "@/components/KpiCards";
import PaymentSplitChart from "@/components/PaymentSplitChart";
import DailyRevenueChart from "@/components/DailyRevenueChart";
import HourlyRevenueChart from "@/components/HourlyRevenueChart";
import TopPickupTable from "@/components/TopPickupTable";

const STORAGE_KEY = "bolt-driver-analytics:trips:v1";

function loadTrips(): BoltTrip[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as BoltTrip[]) : [];
  } catch {
    return [];
  }
}

function saveTrips(trips: BoltTrip[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(trips));
}

/**
 * localStorage is an external mutable store, so we read it through
 * useSyncExternalStore. This keeps SSR/hydration consistent (server always sees
 * an empty list) and avoids setState-in-effect. The module-level `cache` gives
 * getSnapshot a stable reference between renders.
 */
const EMPTY_TRIPS: BoltTrip[] = [];
let cache: BoltTrip[] | null = null;
const listeners = new Set<() => void>();

function getTripsSnapshot(): BoltTrip[] {
  if (cache === null) cache = loadTrips();
  return cache;
}

function getServerTripsSnapshot(): BoltTrip[] {
  return EMPTY_TRIPS;
}

function subscribeTrips(callback: () => void): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function setStoredTrips(trips: BoltTrip[]) {
  cache = trips;
  saveTrips(trips);
  listeners.forEach((l) => l());
}

// --- Profit settings store (same SSR-safe localStorage pattern) ---
const SETTINGS_KEY = "bolt-driver-analytics:profit-settings:v1";
let settingsCache: ProfitSettings | null = null;
const settingsListeners = new Set<() => void>();

function loadSettings(): ProfitSettings {
  if (typeof window === "undefined") return DEFAULT_PROFIT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_PROFIT_SETTINGS;
    const parsed = profitSettingsSchema.safeParse(JSON.parse(raw));
    return parsed.success
      ? { ...DEFAULT_PROFIT_SETTINGS, ...parsed.data }
      : DEFAULT_PROFIT_SETTINGS;
  } catch {
    return DEFAULT_PROFIT_SETTINGS;
  }
}

function getSettingsSnapshot(): ProfitSettings {
  if (settingsCache === null) settingsCache = loadSettings();
  return settingsCache;
}

function getServerSettingsSnapshot(): ProfitSettings {
  return DEFAULT_PROFIT_SETTINGS;
}

function subscribeSettings(callback: () => void): () => void {
  settingsListeners.add(callback);
  return () => settingsListeners.delete(callback);
}

function setStoredSettings(settings: ProfitSettings) {
  settingsCache = settings;
  if (typeof window !== "undefined") {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }
  settingsListeners.forEach((l) => l());
}

export default function Home() {
  const trips = useSyncExternalStore(
    subscribeTrips,
    getTripsSnapshot,
    getServerTripsSnapshot,
  );
  const settings = useSyncExternalStore(
    subscribeSettings,
    getSettingsSnapshot,
    getServerSettingsSnapshot,
  );
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<DateRangeFilter>(ALL_FILTER);

  // Available months and the month-summary table come from the FULL dataset.
  const months = useMemo(() => getAvailableMonths(trips), [trips]);
  const monthlyRevenue = useMemo(() => getMonthlyRevenue(trips), [trips]);

  // Everything else reacts to the active filter (evaluated on the trip date).
  const filteredTrips = useMemo(() => filterTrips(trips, filter), [trips, filter]);
  const metrics = useMemo(
    () => calculateBoltMetrics(filteredTrips),
    [filteredTrips],
  );

  // Estimated profit for the selected range: costs scale with calendar days.
  const selectedDays = useMemo(
    () => countSelectedDays(filter, filteredTrips),
    [filter, filteredTrips],
  );
  const profit = useMemo(
    () =>
      calculateProfit(
        metrics.totalRevenue,
        metrics.totalTrips,
        selectedDays,
        settings,
      ),
    [metrics.totalRevenue, metrics.totalTrips, selectedDays, settings],
  );

  async function handleFiles(files: File[]) {
    setBusy(true);
    try {
      const existingKeys = trips.map((t) => t.invoiceNumber);
      const result = await parseBoltFiles(files, existingKeys);
      setStoredTrips([...trips, ...result.trips]);
      setSummary(result.summary);
    } finally {
      setBusy(false);
    }
  }

  function handleClear() {
    setStoredTrips([]);
    setSummary(null);
    setFilter(ALL_FILTER);
  }

  const activeMonthKey = filter.mode === "month" ? filter.monthKey : undefined;

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Bolt Driver Analytics
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Încarcă facturile CSV Bolt pentru a vedea veniturile și statisticile.
          </p>
        </div>
        {trips.length > 0 && (
          <button
            onClick={handleClear}
            className="inline-flex items-center gap-2 rounded-lg border border-zinc-300 px-3 py-1.5 text-sm text-zinc-600 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            <Trash2 className="h-4 w-4" />
            Șterge datele
          </button>
        )}
      </header>

      <section className="mb-8">
        <UploadZone onFiles={handleFiles} busy={busy} />
        {summary && <ImportSummaryPanel summary={summary} />}
      </section>

      {trips.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 p-12 text-center text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
          Niciun fișier încărcat încă. Încarcă un CSV Bolt pentru a începe.
        </div>
      ) : (
        <div className="space-y-6">
          <DateFilter filter={filter} months={months} onChange={setFilter} />

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-1">
              <RevenueByMonthTable
                data={monthlyRevenue}
                activeKey={activeMonthKey}
                onSelectMonth={(monthKey) => setFilter({ mode: "month", monthKey })}
              />
            </div>
            <div className="lg:col-span-2 space-y-6">
              <div className="flex items-baseline justify-between">
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  Se afișează:{" "}
                  <span className="font-medium text-zinc-800 dark:text-zinc-100">
                    {describeFilter(filter, months)}
                  </span>{" "}
                  · {formatNumber(filteredTrips.length)} curse
                </p>
              </div>
              <KpiCards metrics={metrics} />
            </div>
          </div>

          <ProfitSettingsPanel settings={settings} onChange={setStoredSettings} />
          <EstimatedProfitCard breakdown={profit} />

          <div className="grid gap-6 lg:grid-cols-2">
            <DailyRevenueChart data={metrics.dailyRevenue} />
            <PaymentSplitChart data={metrics.paymentSplit} />
          </div>
          <HourlyRevenueChart data={metrics.hourlyRevenue} />
          <TopPickupTable data={metrics.topPickups} />
        </div>
      )}
    </main>
  );
}

/** Summary of the most recent import: files, rows, duplicates, warnings, errors. */
function ImportSummaryPanel({ summary }: { summary: ImportSummary }) {
  const stats = [
    { label: "Fișiere încărcate", value: summary.filesUploaded },
    { label: "Rânduri importate", value: summary.rowsParsed },
    { label: "Duplicate ignorate", value: summary.duplicatesSkipped },
    { label: "Avertismente", value: summary.warnings.length },
    { label: "Erori", value: summary.errors.length },
  ];

  return (
    <div className="mt-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="mb-3 text-sm font-semibold text-zinc-700 dark:text-zinc-200">
        Rezumat import
      </h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {stats.map((s) => (
          <div key={s.label} className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-800/50">
            <p className="text-xs text-zinc-500 dark:text-zinc-400">{s.label}</p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
              {formatNumber(s.value)}
            </p>
          </div>
        ))}
      </div>

      {summary.fileNames.length > 0 && (
        <p className="mt-3 text-xs text-zinc-400">{summary.fileNames.join(", ")}</p>
      )}

      {summary.warnings.length > 0 && (
        <IssueList
          icon={<AlertTriangle className="h-4 w-4 text-amber-500" />}
          title="Avertismente"
          items={summary.warnings.map((w) => `${w.file} · rând ${w.row}: ${w.message}`)}
          tone="amber"
        />
      )}
      {summary.errors.length > 0 && (
        <IssueList
          icon={<FileWarning className="h-4 w-4 text-red-500" />}
          title="Erori"
          items={summary.errors.map((e) => `${e.file} · rând ${e.row}: ${e.message}`)}
          tone="red"
        />
      )}
    </div>
  );
}

function IssueList({
  icon,
  title,
  items,
  tone,
}: {
  icon: React.ReactNode;
  title: string;
  items: string[];
  tone: "amber" | "red";
}) {
  const toneClasses =
    tone === "amber"
      ? "border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/20"
      : "border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-950/20";

  return (
    <details className={`mt-4 rounded-lg border p-3 ${toneClasses}`}>
      <summary className="flex cursor-pointer items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-200">
        {icon}
        {title} ({items.length})
      </summary>
      <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto text-xs text-zinc-600 dark:text-zinc-300">
        {items.map((item, i) => (
          <li key={i} className="font-mono">
            {item}
          </li>
        ))}
      </ul>
    </details>
  );
}
