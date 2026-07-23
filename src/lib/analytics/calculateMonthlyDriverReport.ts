import type { BoltMetrics } from "./calculateBoltMetrics";
import type { ProfitAccuracy, ProfitBreakdown } from "./estimateProfit";
import { formatMonthLabel } from "@/lib/utils/dates";
import { formatNumber, formatPercent, formatRon } from "@/lib/utils/money";

/** One short label/value pair rendered as a small card in the report. */
export interface ReportKpi {
  label: string;
  value: string;
}

/**
 * The full monthly driver report: a plain-Romanian summary of the selected
 * month, built only from imported data and the user's cost assumptions.
 * Serializable so it can be included in the JSON export as-is.
 */
export interface MonthlyDriverReport {
  monthKey: string;
  monthLabel: string;
  usedMonthlyPdf: boolean;
  accuracy: ProfitAccuracy;
  /** 3–5 simple sentences answering "cum a mers luna asta?". */
  conclusion: string;
  kpis: ReportKpi[];
  /** "Ce a mers bine" bullets. */
  wentWell: string[];
  /** "Ce merită urmărit" bullets — always prudent, never alarmist. */
  watchOut: string[];
  /** "Pentru luna următoare" bullets. */
  nextMonth: string[];
  /** Plain-text version, ready to paste in WhatsApp. */
  copyText: string;
}

/** Romanian weekday names indexed by `Date.getDay()` (0 = Sunday). */
const WEEKDAYS = [
  "Duminică",
  "Luni",
  "Marți",
  "Miercuri",
  "Joi",
  "Vineri",
  "Sâmbătă",
] as const;

interface WeekdayTotal {
  name: string;
  revenue: number;
  trips: number;
}

/** Aggregate daily revenue rows into per-weekday totals (only days with data). */
function weekdayTotals(dailyRevenue: BoltMetrics["dailyRevenue"]): WeekdayTotal[] {
  const map = new Map<string, WeekdayTotal>();
  for (const row of dailyRevenue) {
    const [y, m, d] = row.dayKey.split("-").map(Number);
    const name = WEEKDAYS[new Date(y, m - 1, d).getDay()];
    const agg = map.get(name) ?? { name, revenue: 0, trips: 0 };
    agg.revenue += row.revenue;
    agg.trips += row.trips;
    map.set(name, agg);
  }
  return [...map.values()];
}

interface HourWindow {
  /** e.g. "17:00–20:00". */
  label: string;
  revenue: number;
}

/**
 * Best 3 consecutive hours by revenue (e.g. "17:00–20:00"), or `null` when the
 * month has no hourly revenue at all.
 */
function bestHourWindow(
  hourlyRevenue: BoltMetrics["hourlyRevenue"],
): HourWindow | null {
  const byHour = new Map(hourlyRevenue.map((r) => [r.hour, r.revenue]));
  let best: { start: number; revenue: number } | null = null;
  for (let start = 0; start <= 21; start++) {
    const revenue =
      (byHour.get(start) ?? 0) +
      (byHour.get(start + 1) ?? 0) +
      (byHour.get(start + 2) ?? 0);
    if (revenue > 0 && (!best || revenue > best.revenue)) {
      best = { start, revenue };
    }
  }
  if (!best) return null;
  const pad = (h: number) => `${String(h).padStart(2, "0")}:00`;
  return { label: `${pad(best.start)}–${pad(best.start + 3)}`, revenue: best.revenue };
}

/** The largest estimated cost in the breakdown, with its Romanian label. */
function biggestCost(profit: ProfitBreakdown): { label: string; value: number } {
  const costs = [
    {
      label: profit.usedMonthlyPdf ? "Taxă Bolt reală" : "Comision Bolt estimat",
      value: profit.boltCommissionCost,
    },
    // Every user-entered cost line, normalized to the period.
    ...profit.expenses.lines.map((line) => ({
      label: line.label,
      value: line.amount,
    })),
  ];
  return costs.reduce((max, c) => (c.value > max.value ? c : max));
}

export interface MonthlyReportInput {
  /** Normalized month key, `yyyy-MM`. */
  monthKey: string;
  /** Metrics for the trips of that month (already filtered). */
  metrics: BoltMetrics;
  /** Profit breakdown for that month (already computed, unchanged here). */
  profit: ProfitBreakdown;
}

/** Minimum trips at one pickup address before we call it "cel mai bun punct". */
const PICKUP_MIN_TRIPS = 5;

/**
 * Build the monthly driver report from already-computed metrics and profit.
 * Pure and deterministic — no recalculation of revenue/profit happens here, so
 * the report always matches the dashboard. Returns `null` when the month has
 * no trips (the UI shows a friendly empty state instead).
 */
export function calculateMonthlyDriverReport({
  monthKey,
  metrics,
  profit,
}: MonthlyReportInput): MonthlyDriverReport | null {
  if (metrics.totalTrips === 0) return null;

  const monthLabel = formatMonthLabel(monthKey);
  const usedMonthlyPdf = profit.usedMonthlyPdf;
  const accuracy = profit.profitAccuracy;

  const weekdays = weekdayTotals(metrics.dailyRevenue);
  const bestDay =
    weekdays.length > 0
      ? weekdays.reduce((max, d) => (d.revenue > max.revenue ? d : max))
      : null;
  const weakestDay =
    weekdays.length > 1
      ? weekdays.reduce((min, d) => (d.revenue < min.revenue ? d : min))
      : null;
  const hourWindow = bestHourWindow(metrics.hourlyRevenue);
  const topPickup =
    metrics.topPickups[0] && metrics.topPickups[0].trips >= PICKUP_MIN_TRIPS
      ? metrics.topPickups[0]
      : null;
  const topCost = biggestCost(profit);

  // --- Concluzia lunii: 3–5 short sentences, plain Romanian. ---
  const sentences: string[] = [
    `În ${monthLabel} ai avut ${formatNumber(metrics.totalTrips)} curse și venit total de ${formatRon(metrics.totalRevenue)}.`,
    `După costurile introduse, profitul estimat este de ${formatRon(profit.estimatedProfit)}.`,
  ];
  if (bestDay && hourWindow) {
    sentences.push(
      `În perioada selectată, ziua cu cel mai mare venit total a fost ${bestDay.name}, iar cele mai mari venituri totale au fost în intervalul ${hourWindow.label}. Aceasta descrie perioada selectată și nu este o recomandare pentru viitor.`,
    );
  } else if (bestDay) {
    sentences.push(
      `În perioada selectată, ziua cu cel mai mare venit total a fost ${bestDay.name}. Aceasta descrie perioada selectată și nu este o recomandare pentru viitor.`,
    );
  }
  sentences.push(
    usedMonthlyPdf
      ? "Calculul este mai precis deoarece există PDF lunar Bolt pentru această lună."
      : "Pentru un calcul mai precis, încarcă PDF-ul lunar Bolt.",
  );
  const conclusion = sentences.join(" ");

  // --- Short cards. ---
  const kpis: ReportKpi[] = [
    { label: "Venit total", value: formatRon(metrics.totalRevenue) },
    { label: "Număr curse", value: formatNumber(metrics.totalTrips) },
    { label: "Valoare medie / cursă", value: formatRon(metrics.averageTripValue) },
    usedMonthlyPdf
      ? { label: "Taxă Bolt reală", value: formatRon(profit.boltCommissionCost) }
      : { label: "Comision estimat", value: formatRon(profit.boltCommissionCost) },
    ...(usedMonthlyPdf && profit.tripKilometers !== null
      ? [
          {
            label: "Kilometri reali",
            value: `${formatNumber(profit.tripKilometers, 2)} km`,
          },
        ]
      : []),
    { label: "Profit estimat", value: formatRon(profit.estimatedProfit) },
    {
      label: "Precizie calcul",
      value:
        accuracy === "high" ? "Ridicată" : accuracy === "low" ? "Scăzută" : "Medie",
    },
  ];

  // --- Ce a mers bine. ---
  const wentWell: string[] = [];
  if (bestDay) {
    wentWell.push(
      `Ziua cu cel mai mare venit total: ${bestDay.name} (${formatRon(bestDay.revenue)}).`,
    );
  }
  if (hourWindow) {
    wentWell.push(
      `Intervalul orar cu cel mai mare venit total: ${hourWindow.label} (${formatRon(hourWindow.revenue)}).`,
    );
  }
  if (topPickup) {
    wentWell.push(
      `Adresa de preluare cu cele mai multe curse: ${topPickup.address} (${formatNumber(topPickup.trips)} curse).`,
    );
  }
  if (wentWell.length === 0) {
    wentWell.push("Datele lunii sunt prea puține pentru tipare clare.");
  }

  // --- Ce merită urmărit (prudent, niciodată alarmist). ---
  const watchOut: string[] = [];
  if (weakestDay && bestDay && weakestDay.name !== bestDay.name) {
    watchOut.push(
      `Ziua cu cel mai mic venit total în perioada selectată: ${weakestDay.name} (${formatRon(weakestDay.revenue)}).`,
    );
  }
  watchOut.push(
    `Cel mai mare cost estimat: ${topCost.label} (${formatRon(topCost.value)}) — merită urmărit.`,
  );
  if (profit.profitMarginPercent < 15) {
    watchOut.push(
      `Profitul estimat pare mic raportat la venit (${formatPercent(profit.profitMarginPercent)}). Datele sugerează să compari costurile introduse cu cele reale.`,
    );
  } else {
    watchOut.push(
      "Compară profitul după costuri, nu doar venitul brut — imaginea reală apare după cheltuieli.",
    );
  }

  // --- Pentru luna următoare. ---
  const nextMonth: string[] = [
    "Pentru zile și intervale cu tipare istorice, vezi secțiunea „Recomandări pentru ieșit la lucru”.",
    "Compară profitul după costuri, nu doar venitul brut.",
    usedMonthlyPdf
      ? "Păstrează obiceiul: încarcă PDF-ul lunar Bolt și pentru luna următoare."
      : "Încarcă PDF-ul lunar Bolt pentru taxă Bolt reală și kilometri reali.",
  ];

  // --- Plain text, WhatsApp-friendly. ---
  const copyLines: string[] = [
    `Raport Bolt - ${monthLabel}`,
    `Venit total: ${formatRon(metrics.totalRevenue)}`,
    `Curse: ${formatNumber(metrics.totalTrips)}`,
    `Profit estimat: ${formatRon(profit.estimatedProfit)}`,
    usedMonthlyPdf
      ? `Taxă Bolt: ${formatRon(profit.boltCommissionCost)}`
      : `Comision estimat: ${formatRon(profit.boltCommissionCost)}`,
  ];
  if (usedMonthlyPdf && profit.tripKilometers !== null) {
    copyLines.push(`Kilometri: ${formatNumber(profit.tripKilometers, 2)} km`);
  }
  if (bestDay) copyLines.push(`Ziua cu cel mai mare venit: ${bestDay.name}`);
  if (hourWindow) {
    copyLines.push(`Intervalul cu cel mai mare venit: ${hourWindow.label}`);
  }
  if (bestDay || hourWindow) {
    copyLines.push(
      "Notă: descrie perioada selectată, nu este o recomandare pentru viitor.",
    );
  }
  copyLines.push(
    usedMonthlyPdf
      ? "Observație: Calcul mai precis — PDF lunar Bolt importat."
      : "Observație: Calcul estimativ, pe baza datelor importate.",
  );

  return {
    monthKey,
    monthLabel,
    usedMonthlyPdf,
    accuracy,
    conclusion,
    kpis,
    wentWell,
    watchOut,
    nextMonth,
    copyText: copyLines.join("\n"),
  };
}
