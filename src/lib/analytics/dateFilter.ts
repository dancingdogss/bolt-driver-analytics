import type { BoltTrip } from "@/lib/types/bolt";
import { formatMonthLabel, getMonthKey } from "@/lib/utils/dates";

export type FilterMode = "all" | "month" | "custom";

/**
 * The active dashboard filter. All ranges are evaluated against
 * `Data călătoriei` (the real trip date) — never the upload file name.
 */
export interface DateRangeFilter {
  mode: FilterMode;
  /** `yyyy-MM`, used when mode is "month". */
  monthKey?: string;
  /** `yyyy-MM-dd` inclusive start, used when mode is "custom". */
  from?: string;
  /** `yyyy-MM-dd` inclusive end (whole day), used when mode is "custom". */
  to?: string;
}

export const ALL_FILTER: DateRangeFilter = { mode: "all" };

export interface MonthOption {
  key: string;
  label: string;
}

export interface MonthlyRevenueRow {
  key: string;
  label: string;
  trips: number;
  revenue: number;
}

/** Distinct months present in the data, ascending, from the real trip date. */
export function getAvailableMonths(trips: BoltTrip[]): MonthOption[] {
  const keys = new Set<string>();
  for (const trip of trips) {
    const date = new Date(trip.tripDate);
    if (!Number.isNaN(date.getTime())) keys.add(getMonthKey(date));
  }
  return [...keys]
    .sort((a, b) => a.localeCompare(b))
    .map((key) => ({ key, label: formatMonthLabel(key) }));
}

/** Trips + revenue grouped by month (ascending), for the verification table. */
export function getMonthlyRevenue(trips: BoltTrip[]): MonthlyRevenueRow[] {
  const map = new Map<string, MonthlyRevenueRow>();
  for (const trip of trips) {
    const date = new Date(trip.tripDate);
    if (Number.isNaN(date.getTime())) continue;
    const key = getMonthKey(date);
    const row =
      map.get(key) ?? { key, label: formatMonthLabel(key), trips: 0, revenue: 0 };
    row.trips += 1;
    row.revenue += trip.totalValue;
    map.set(key, row);
  }
  return [...map.values()].sort((a, b) => a.key.localeCompare(b.key));
}

interface ResolvedRange {
  /** Inclusive lower bound, or null for open. */
  start: Date | null;
  /** Exclusive upper bound, or null for open. */
  endExclusive: Date | null;
}

/**
 * Turn a filter into a concrete `[start, endExclusive)` range in local time.
 * A month resolves to `[first day 00:00, first day of next month 00:00)`, so
 * June 2026 covers 01.06.2026 00:00 through 30.06.2026 23:59:59.999 inclusive.
 */
export function resolveRange(filter: DateRangeFilter): ResolvedRange {
  if (filter.mode === "month" && filter.monthKey) {
    const [year, month] = filter.monthKey.split("-").map(Number);
    return {
      start: new Date(year, month - 1, 1, 0, 0, 0, 0),
      endExclusive: new Date(year, month, 1, 0, 0, 0, 0),
    };
  }

  if (filter.mode === "custom") {
    let start: Date | null = null;
    let endExclusive: Date | null = null;
    if (filter.from) {
      const [y, m, d] = filter.from.split("-").map(Number);
      start = new Date(y, m - 1, d, 0, 0, 0, 0);
    }
    if (filter.to) {
      const [y, m, d] = filter.to.split("-").map(Number);
      // +1 day so the whole `to` day is included.
      endExclusive = new Date(y, m - 1, d + 1, 0, 0, 0, 0);
    }
    return { start, endExclusive };
  }

  return { start: null, endExclusive: null };
}

/** Filter trips to those whose real trip date falls inside the filter range. */
export function filterTrips(
  trips: BoltTrip[],
  filter: DateRangeFilter,
): BoltTrip[] {
  const { start, endExclusive } = resolveRange(filter);
  if (!start && !endExclusive) return trips;

  const startTime = start?.getTime() ?? -Infinity;
  const endTime = endExclusive?.getTime() ?? Infinity;

  return trips.filter((trip) => {
    const time = new Date(trip.tripDate).getTime();
    if (Number.isNaN(time)) return false;
    return time >= startTime && time < endTime;
  });
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Local start-of-day timestamp for an arbitrary instant. */
function startOfDayMs(time: number): number {
  const d = new Date(time);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/**
 * Count the calendar days in the active filter range.
 *
 * - A bounded range (month, or custom with both ends) uses the range itself:
 *   June 2026 is always 30 days regardless of how many days had trips.
 * - Open-ended sides ("all data", or a half-open custom range) fall back to the
 *   span of `tripsInRange` — first trip day through last trip day, inclusive.
 *
 * `Math.round` on the day division absorbs any DST hour offset.
 */
export function countSelectedDays(
  filter: DateRangeFilter,
  tripsInRange: BoltTrip[],
): number {
  const { start, endExclusive } = resolveRange(filter);

  let minTime = Infinity;
  let maxTime = -Infinity;
  for (const trip of tripsInRange) {
    const time = new Date(trip.tripDate).getTime();
    if (Number.isNaN(time)) continue;
    if (time < minTime) minTime = time;
    if (time > maxTime) maxTime = time;
  }
  const hasData = minTime !== Infinity;

  let startTime: number;
  if (start) startTime = start.getTime();
  else if (hasData) startTime = startOfDayMs(minTime);
  else return 0;

  let endExclusiveTime: number;
  if (endExclusive) endExclusiveTime = endExclusive.getTime();
  else if (hasData) endExclusiveTime = startOfDayMs(maxTime) + DAY_MS;
  else return 0;

  const days = Math.round((endExclusiveTime - startTime) / DAY_MS);
  return Math.max(days, 0);
}

/** Short human description of the active filter, for display. */
export function describeFilter(
  filter: DateRangeFilter,
  months: MonthOption[],
): string {
  if (filter.mode === "month" && filter.monthKey) {
    return months.find((m) => m.key === filter.monthKey)?.label ?? "Lună";
  }
  if (filter.mode === "custom") {
    if (filter.from && filter.to) return `${filter.from} → ${filter.to}`;
    if (filter.from) return `de la ${filter.from}`;
    if (filter.to) return `până la ${filter.to}`;
    return "Interval personalizat";
  }
  return "Toate datele";
}
