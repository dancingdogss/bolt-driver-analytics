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
  calculateProfitScenarios,
} from "@/lib/analytics/estimateProfit";
import {
  DEFAULT_EXPENSE_SETTINGS,
  expenseSettingsSchema,
  legacyProfitSettingsSchema,
  migrateLegacySettings,
  type ExpenseSettings,
} from "@/lib/analytics/calculateExpenses";
import { calculateDriverInsights } from "@/lib/analytics/calculateDriverInsights";
import { calculateWorkRecommendations } from "@/lib/analytics/calculateWorkRecommendations";
import { calculateMonthlyDriverReport } from "@/lib/analytics/calculateMonthlyDriverReport";
import { buildReportSummary } from "@/lib/analytics/reportSummary";
import { parseBoltMonthlySummaryPdf } from "@/lib/parsers/parseBoltMonthlySummaryPdf";
import type { BoltTrip, ImportSummary } from "@/lib/types/bolt";
import {
  boltMonthlySummarySchema,
  type BoltMonthlySummary,
} from "@/lib/types/monthlySummary";
import { getMonthKey } from "@/lib/utils/dates";
import { formatNumber } from "@/lib/utils/money";
import UploadZone from "@/components/UploadZone";
import MonthlyPdfUpload, {
  type MonthlyPdfStatus,
  type PdfMatchState,
} from "@/components/MonthlyPdfUpload";
import DateFilter from "@/components/DateFilter";
import HowToUse from "@/components/HowToUse";
import RevenueByMonthTable from "@/components/RevenueByMonthTable";
import ProfitSettingsPanel from "@/components/ProfitSettingsPanel";
import EstimatedProfitCard from "@/components/EstimatedProfitCard";
import ProfitScenarios from "@/components/ProfitScenarios";
import MonthlyDriverReport from "@/components/MonthlyDriverReport";
import DriverInsights from "@/components/DriverInsights";
import WorkRecommendations from "@/components/WorkRecommendations";
import ExportSummaryButton from "@/components/ExportSummaryButton";
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

// --- Expense settings store (same SSR-safe localStorage pattern) ---
const SETTINGS_KEY = "bolt-driver-analytics:expense-settings:v1";
/** Pre-expense-settings key; migrated on first load so no values are lost. */
const LEGACY_SETTINGS_KEY = "bolt-driver-analytics:profit-settings:v1";
let settingsCache: ExpenseSettings | null = null;
const settingsListeners = new Set<() => void>();

function loadSettings(): ExpenseSettings {
  if (typeof window === "undefined") return DEFAULT_EXPENSE_SETTINGS;
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const parsed = expenseSettingsSchema.safeParse(JSON.parse(raw));
      if (parsed.success) return parsed.data;
    }
    // Migrate the old flat weekly settings, if present.
    const legacyRaw = window.localStorage.getItem(LEGACY_SETTINGS_KEY);
    if (legacyRaw) {
      const legacy = legacyProfitSettingsSchema.safeParse(JSON.parse(legacyRaw));
      if (legacy.success) return migrateLegacySettings(legacy.data);
    }
    return DEFAULT_EXPENSE_SETTINGS;
  } catch {
    return DEFAULT_EXPENSE_SETTINGS;
  }
}

function getSettingsSnapshot(): ExpenseSettings {
  if (settingsCache === null) settingsCache = loadSettings();
  return settingsCache;
}

function getServerSettingsSnapshot(): ExpenseSettings {
  return DEFAULT_EXPENSE_SETTINGS;
}

function subscribeSettings(callback: () => void): () => void {
  settingsListeners.add(callback);
  return () => settingsListeners.delete(callback);
}

function setStoredSettings(settings: ExpenseSettings) {
  settingsCache = settings;
  if (typeof window !== "undefined") {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }
  settingsListeners.forEach((l) => l());
}

// --- Simple mode store (same SSR-safe localStorage pattern) ---
const SIMPLE_MODE_KEY = "bolt-driver-analytics:simple-mode:v1";
let simpleModeCache: boolean | null = null;
const simpleModeListeners = new Set<() => void>();

function getSimpleModeSnapshot(): boolean {
  if (simpleModeCache === null) {
    try {
      simpleModeCache = window.localStorage.getItem(SIMPLE_MODE_KEY) === "1";
    } catch {
      simpleModeCache = false;
    }
  }
  return simpleModeCache;
}

function getServerSimpleModeSnapshot(): boolean {
  return false;
}

function subscribeSimpleMode(callback: () => void): () => void {
  simpleModeListeners.add(callback);
  return () => simpleModeListeners.delete(callback);
}

function setStoredSimpleMode(enabled: boolean) {
  simpleModeCache = enabled;
  if (typeof window !== "undefined") {
    window.localStorage.setItem(SIMPLE_MODE_KEY, enabled ? "1" : "0");
  }
  simpleModeListeners.forEach((l) => l());
}

// --- Recommendations data-source toggle (defaults to ALL imported data) ---
const REC_ALL_DATA_KEY = "bolt-driver-analytics:rec-all-data:v1";
let recAllDataCache: boolean | null = null;
const recAllDataListeners = new Set<() => void>();

function getRecAllDataSnapshot(): boolean {
  if (recAllDataCache === null) {
    try {
      // Default on: only an explicit "0" turns it off.
      recAllDataCache = window.localStorage.getItem(REC_ALL_DATA_KEY) !== "0";
    } catch {
      recAllDataCache = true;
    }
  }
  return recAllDataCache;
}

function getServerRecAllDataSnapshot(): boolean {
  return true;
}

function subscribeRecAllData(callback: () => void): () => void {
  recAllDataListeners.add(callback);
  return () => recAllDataListeners.delete(callback);
}

function setStoredRecAllData(enabled: boolean) {
  recAllDataCache = enabled;
  if (typeof window !== "undefined") {
    window.localStorage.setItem(REC_ALL_DATA_KEY, enabled ? "1" : "0");
  }
  recAllDataListeners.forEach((l) => l());
}

// --- Monthly-summary PDFs store (same SSR-safe localStorage pattern) ---
const SUMMARIES_KEY = "bolt-driver-analytics:monthly-summaries:v1";
let summariesCache: BoltMonthlySummary[] | null = null;
const summariesListeners = new Set<() => void>();
const EMPTY_SUMMARIES: BoltMonthlySummary[] = [];

function loadSummaries(): BoltMonthlySummary[] {
  if (typeof window === "undefined") return EMPTY_SUMMARIES;
  try {
    const raw = window.localStorage.getItem(SUMMARIES_KEY);
    if (!raw) return EMPTY_SUMMARIES;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return EMPTY_SUMMARIES;
    return parsed.flatMap((item) => {
      const result = boltMonthlySummarySchema.safeParse(item);
      return result.success ? [result.data] : [];
    });
  } catch {
    return EMPTY_SUMMARIES;
  }
}

function getSummariesSnapshot(): BoltMonthlySummary[] {
  if (summariesCache === null) summariesCache = loadSummaries();
  return summariesCache;
}

function getServerSummariesSnapshot(): BoltMonthlySummary[] {
  return EMPTY_SUMMARIES;
}

function subscribeSummaries(callback: () => void): () => void {
  summariesListeners.add(callback);
  return () => summariesListeners.delete(callback);
}

function setStoredSummaries(summaries: BoltMonthlySummary[]) {
  summariesCache = summaries;
  if (typeof window !== "undefined") {
    window.localStorage.setItem(SUMMARIES_KEY, JSON.stringify(summaries));
  }
  summariesListeners.forEach((l) => l());
}

/** Insert or replace a summary by monthKey (one PDF per month wins). */
function upsertSummary(
  summaries: BoltMonthlySummary[],
  next: BoltMonthlySummary,
): BoltMonthlySummary[] {
  const rest = summaries.filter((s) => s.monthKey !== next.monthKey);
  return [...rest, next].sort((a, b) => a.monthKey.localeCompare(b.monthKey));
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
  const simpleMode = useSyncExternalStore(
    subscribeSimpleMode,
    getSimpleModeSnapshot,
    getServerSimpleModeSnapshot,
  );
  const recUseAllData = useSyncExternalStore(
    subscribeRecAllData,
    getRecAllDataSnapshot,
    getServerRecAllDataSnapshot,
  );
  const monthlySummaries = useSyncExternalStore(
    subscribeSummaries,
    getSummariesSnapshot,
    getServerSummariesSnapshot,
  );
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [busy, setBusy] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfStatus, setPdfStatus] = useState<MonthlyPdfStatus | null>(null);
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

  // Distinct months (yyyy-MM) covered by the current CSV selection.
  const monthsInSelection = useMemo(() => {
    const keys = new Set<string>();
    for (const trip of filteredTrips) {
      const date = new Date(trip.tripDate);
      if (!Number.isNaN(date.getTime())) keys.add(getMonthKey(date));
    }
    return [...keys];
  }, [filteredTrips]);

  // Use the real PDF figures only when EVERY month in the selection has a
  // matching summary. Custom ranges are excluded because a monthly total cannot
  // be safely applied to a partial-month revenue slice.
  const pdfOverride = useMemo(() => {
    if (filter.mode === "custom" || monthsInSelection.length === 0) return undefined;
    const byKey = new Map(monthlySummaries.map((s) => [s.monthKey, s]));
    const matched = monthsInSelection.map((k) => byKey.get(k));
    if (matched.some((s) => !s)) return undefined;
    const found = matched as BoltMonthlySummary[];
    const boltFee = found.reduce((sum, s) => sum + s.boltFee, 0);
    const tripKilometers = found.reduce((sum, s) => sum + s.tripKilometers, 0);
    if (!(boltFee > 0)) return undefined; // need a real fee to raise precision
    return { boltFee, tripKilometers };
  }, [filter.mode, monthsInSelection, monthlySummaries]);

  const profit = useMemo(
    () =>
      calculateProfit(
        metrics.totalRevenue,
        metrics.totalTrips,
        selectedDays,
        settings,
        pdfOverride,
      ),
    [metrics.totalRevenue, metrics.totalTrips, selectedDays, settings, pdfOverride],
  );

  // What-if estimates derived from the same breakdown (no recalculation).
  const scenarios = useMemo(() => calculateProfitScenarios(profit), [profit]);

  // Monthly driver report — only when a specific month is selected. Reuses the
  // already-computed metrics/profit, so no calculation is duplicated.
  const monthlyReport = useMemo(() => {
    if (filter.mode !== "month" || !filter.monthKey) return null;
    return calculateMonthlyDriverReport({
      monthKey: filter.monthKey,
      metrics,
      profit,
    });
  }, [filter, metrics, profit]);

  // Driver insights for the selected range.
  const insights = useMemo(
    () =>
      calculateDriverInsights(
        filteredTrips,
        metrics,
        selectedDays,
        profit.estimatedProfit,
      ),
    [filteredTrips, metrics, selectedDays, profit.estimatedProfit],
  );

  // Recommendations use the full dataset by default (more data = better tipare),
  // or the filtered selection when the toggle is off.
  const recommendationTrips = recUseAllData ? trips : filteredTrips;
  const recommendations = useMemo(
    () => calculateWorkRecommendations(recommendationTrips),
    [recommendationTrips],
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

  async function handlePdf(file: File) {
    setPdfBusy(true);
    try {
      const result = await parseBoltMonthlySummaryPdf(file);
      if (result.error === "unreadable") {
        setPdfStatus({
          kind: "error",
          message:
            "PDF-ul nu a putut fi citit automat. Verifică dacă este rezumatul lunar Bolt.",
        });
        return;
      }
      if (result.error === "invalid" || !result.summary) {
        setPdfStatus({
          kind: "error",
          message:
            "PDF-ul nu a putut fi citit automat. Verifică dacă este rezumatul lunar Bolt.",
        });
        return;
      }
      const imported = result.summary;
      setStoredSummaries(upsertSummary(monthlySummaries, imported));
      // Store only the parse result; the match-to-view state is derived
      // reactively from the active filter (see pdfMatchState) so it stays
      // correct when the user changes the selected month after importing.
      setPdfStatus({
        kind: "ok",
        summary: imported,
        missingFields: result.missingFields,
      });
    } finally {
      setPdfBusy(false);
    }
  }

  function handleClear() {
    setStoredTrips([]);
    setStoredSummaries([]);
    setSummary(null);
    setPdfStatus(null);
    setFilter(ALL_FILTER);
  }

  // Reactive relationship between the imported PDF's month and the active
  // filter — compared by normalized monthKey ("2026-06"), never display label.
  const pdfMatchState: PdfMatchState | null = useMemo(() => {
    if (!pdfStatus || pdfStatus.kind !== "ok") return null;
    const pdfMonth = pdfStatus.summary.monthKey;
    if (filter.mode === "all") return "all-data";
    if (filter.mode === "month") {
      return filter.monthKey === pdfMonth ? "matched-month" : "mismatch";
    }
    return monthsInSelection.includes(pdfMonth) ? "matched-month" : "mismatch";
  }, [pdfStatus, filter, monthsInSelection]);

  const activeMonthKey = filter.mode === "month" ? filter.monthKey : undefined;
  const rangeLabel = describeFilter(filter, months);
  const hasIssues =
    !!summary && (summary.warnings.length > 0 || summary.errors.length > 0);

  function requestClear() {
    const ok = window.confirm(
      "Ștergi toate datele importate? Se elimină toate cursele salvate în acest browser și acțiunea nu poate fi anulată.",
    );
    if (ok) handleClear();
  }

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-8 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-zinc-50">
              Bolt Driver Analytics
            </h1>
            <p className="mt-2 max-w-2xl text-base text-zinc-300">
              Încarcă fișierele CSV Bolt și vezi rapid venitul, cursele și
              profitul estimat.
            </p>
          </div>
          <SimpleModeToggle enabled={simpleMode} onChange={setStoredSimpleMode} />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-900/60 bg-emerald-950/40 px-3 py-1.5 text-sm font-medium text-emerald-300">
            <span className="h-2 w-2 rounded-full bg-emerald-400" aria-hidden />
            Datele rămân doar în browserul tău
          </span>
          {trips.length > 0 && (
            <div className="ml-auto flex flex-wrap items-center gap-2">
              {!simpleMode && (
                <ExportSummaryButton
                  build={() =>
                    buildReportSummary({
                      filter,
                      rangeLabel,
                      selectedDays,
                      metrics,
                      profit,
                      settings,
                      profitScenarios: scenarios,
                      monthlyRevenue,
                      insights,
                      workRecommendationsUseAllData: recUseAllData,
                      workRecommendations: recommendations,
                      monthlySummaries,
                      monthlyDriverReport: monthlyReport,
                    })
                  }
                />
              )}
              <button
                onClick={requestClear}
                className="inline-flex items-center gap-2 rounded-lg border border-zinc-600 px-4 py-2.5 text-base text-zinc-200 transition-colors hover:bg-zinc-800"
              >
                <Trash2 className="h-5 w-5" aria-hidden />
                Șterge datele importate
              </button>
            </div>
          )}
        </div>
        {trips.length > 0 && !simpleMode && (
          <p className="text-sm text-zinc-400">
            Exportă sumar JSON: descarcă un fișier cu datele calculate pentru
            perioada selectată.
          </p>
        )}
      </header>

      {/* 3-step guide: expanded before first import, collapsible after. */}
      <div className="mb-8">
        <HowToUse collapsible={trips.length > 0} />
      </div>

      <section className="mb-8 space-y-4" aria-label="Încarcă fișiere">
        <UploadZone onFiles={handleFiles} busy={busy} />
        {summary && <ImportStats summary={summary} />}
        <MonthlyPdfUpload
          onFile={handlePdf}
          busy={pdfBusy}
          status={pdfStatus}
          matchState={pdfMatchState}
          importedCount={monthlySummaries.length}
        />
      </section>

      {trips.length === 0 ? (
        <EmptyDashboard />
      ) : (
        <div className="space-y-6">
          {/* Filter */}
          <div className="space-y-3">
            <DateFilter filter={filter} months={months} onChange={setFilter} />
            <p className="px-1 text-base text-zinc-300">
              Se afișează:{" "}
              <span className="font-semibold text-zinc-50">{rangeLabel}</span> —{" "}
              {formatNumber(filteredTrips.length)} curse
            </p>
          </div>

          {/* Overview KPIs */}
          <KpiCards metrics={metrics} simple={simpleMode} />

          {/* Cost assumptions + estimated profit */}
          <ProfitSettingsPanel settings={settings} onChange={setStoredSettings} />
          <EstimatedProfitCard breakdown={profit} rangeLabel={rangeLabel} />

          {/* What-if scenarios around the entered costs */}
          <ProfitScenarios
            scenarios={scenarios}
            usedMonthlyPdf={profit.usedMonthlyPdf}
          />

          {/* Monthly driver report (month filter only) */}
          <MonthlyDriverReport
            report={monthlyReport}
            isMonthSelected={filter.mode === "month"}
          />

          {/* Driver insights */}
          <DriverInsights insights={insights} />

          {/* Work recommendations */}
          <WorkRecommendations
            data={recommendations}
            useAllData={recUseAllData}
            onToggleUseAllData={setStoredRecAllData}
          />

          {/* Revenue by month (full dataset, click to filter) */}
          <RevenueByMonthTable
            data={monthlyRevenue}
            activeKey={activeMonthKey}
            onSelectMonth={(monthKey) => setFilter({ mode: "month", monthKey })}
          />

          {/* Advanced charts — hidden in simple mode */}
          {!simpleMode && (
            <>
              <div className="grid gap-6 lg:grid-cols-2">
                <DailyRevenueChart data={metrics.dailyRevenue} />
                <PaymentSplitChart data={metrics.paymentSplit} />
              </div>
              <HourlyRevenueChart data={metrics.hourlyRevenue} />
              <TopPickupTable data={metrics.topPickups} />
            </>
          )}

          {/* Import warnings & errors */}
          {hasIssues && <ImportIssues summary={summary} />}
        </div>
      )}
    </main>
  );
}

/** Visible labeled switch for "Mod simplu". */
function SimpleModeToggle({
  enabled,
  onChange,
}: {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
}) {
  return (
    <button
      role="switch"
      aria-checked={enabled}
      onClick={() => onChange(!enabled)}
      className={`inline-flex items-center gap-3 rounded-xl border px-4 py-2.5 text-base font-medium transition-colors ${
        enabled
          ? "border-emerald-700 bg-emerald-950/40 text-emerald-200"
          : "border-zinc-600 bg-zinc-900 text-zinc-200 hover:bg-zinc-800"
      }`}
    >
      Mod simplu
      <span
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
          enabled ? "bg-emerald-500" : "bg-zinc-600"
        }`}
        aria-hidden
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${
            enabled ? "left-[22px]" : "left-0.5"
          }`}
        />
      </span>
      <span className="sr-only">
        {enabled ? "activat — se afișează doar informațiile de bază" : "dezactivat"}
      </span>
    </button>
  );
}

/** Clean empty state explaining what to upload. */
function EmptyDashboard() {
  return (
    <div className="rounded-2xl border border-dashed border-zinc-600 p-12 text-center">
      <p className="text-xl font-semibold text-zinc-100">Nu există date încă.</p>
      <p className="mx-auto mt-2 max-w-md text-base text-zinc-300">
        Încarcă fișierele CSV Bolt pentru a vedea analiza.
      </p>
    </div>
  );
}

/** Compact stats for the most recent import, shown under the upload zone. */
function ImportStats({ summary }: { summary: ImportSummary }) {
  const stats = [
    { label: "Fișiere încărcate", value: summary.filesUploaded },
    { label: "Călătorii importate", value: summary.rowsParsed },
    { label: "Duplicate ignorate", value: summary.duplicatesSkipped },
    { label: "Avertismente", value: summary.warnings.length },
    { label: "Erori", value: summary.errors.length },
  ];

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 shadow-sm">
      <h2 className="mb-3 text-lg font-semibold text-zinc-100">Date importate</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {stats.map((s) => (
          <div key={s.label} className="rounded-lg bg-zinc-800/50 p-3">
            <p className="text-sm text-zinc-300">{s.label}</p>
            <p className="mt-1 text-xl font-semibold tabular-nums text-zinc-50">
              {formatNumber(s.value)}
            </p>
          </div>
        ))}
      </div>

      {summary.fileNames.length > 0 && (
        <p className="mt-3 text-sm text-zinc-400">
          {summary.fileNames.join(", ")}
        </p>
      )}
    </div>
  );
}

/**
 * Import warnings/errors. Plain-Romanian counts up front; the technical rows
 * live inside collapsible "Detalii tehnice" lists so they don't alarm anyone.
 */
function ImportIssues({ summary }: { summary: ImportSummary }) {
  const w = summary.warnings.length;
  const e = summary.errors.length;

  // Plain-language summary: auto-repaired rows are reassuring, not alarming.
  const repairedMsg =
    w === 1
      ? "Am găsit 1 rând cu format diferit în CSV, dar aplicația l-a reparat automat."
      : `Am găsit ${formatNumber(w)} rânduri cu format diferit în CSV, dar aplicația le-a reparat automat.`;
  const errorMsg =
    e === 1
      ? "1 rând nu a putut fi importat și a fost ignorat."
      : `${formatNumber(e)} rânduri nu au putut fi importate și au fost ignorate.`;

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 shadow-sm">
      <h3 className="mb-2 text-lg font-semibold text-zinc-100">
        Note despre importul CSV
      </h3>
      {w > 0 && <p className="mb-2 text-base text-zinc-200">{repairedMsg}</p>}
      {e > 0 && <p className="mb-2 text-base text-zinc-200">{errorMsg}</p>}
      <p className="mb-3 text-sm text-zinc-400">
        Restul datelor au fost importate normal.
      </p>
      {summary.warnings.length > 0 && (
        <IssueList
          icon={<AlertTriangle className="h-5 w-5 text-amber-400" aria-hidden />}
          title="Rânduri reparate automat"
          tone="amber"
          items={summary.warnings.map(
            (w) => `${w.file} · rând ${w.row}: ${w.message}`,
          )}
        />
      )}
      {summary.errors.length > 0 && (
        <IssueList
          icon={<FileWarning className="h-5 w-5 text-red-400" aria-hidden />}
          title="Erori"
          tone="red"
          items={summary.errors.map(
            (e) => `${e.file} · rând ${e.row}: ${e.message}`,
          )}
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
      ? "border-amber-900/50 bg-amber-950/20"
      : "border-red-900/50 bg-red-950/20";

  return (
    <div className={`mt-3 rounded-lg border p-3 first:mt-0 ${toneClasses}`}>
      <p className="flex items-center gap-2 text-base font-medium text-zinc-100">
        {icon}
        {title} ({items.length})
      </p>
      <details className="mt-2">
        <summary className="cursor-pointer text-sm text-zinc-300 underline underline-offset-2">
          Detalii tehnice
        </summary>
        <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto text-sm text-zinc-300">
          {items.map((item, i) => (
            <li key={i} className="font-mono text-xs">
              {item}
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
