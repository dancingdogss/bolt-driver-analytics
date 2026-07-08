import type { BoltTrip } from "@/lib/types/bolt";
import type {
  ConfidenceLevel,
  HourRecommendation,
  PickupRecommendation,
  WeekdayStat,
  WindowRecommendation,
  WorkRecommendations,
} from "@/lib/types/recommendations";
import { formatHour, toDayKey } from "@/lib/utils/dates";

/**
 * Below this many total trips the recommendations are considered too weak to
 * present as guidance (the UI shows an "insufficient data" message instead).
 */
export const MIN_TRIPS_FOR_RECOMMENDATIONS = 50;

/** Only flag windows as "weak" once they carry at least this many trips. */
const MIN_TRIPS_FOR_WEAK_WINDOW = 5;

/** A pickup needs at least this many trips to count as a high-average address. */
const MIN_TRIPS_FOR_HIGH_VALUE_PICKUP = 3;

/** Romanian weekday names, indexed by JS `getDay()` (0 = Sunday). */
const WEEKDAY_NAMES = [
  "Duminică",
  "Luni",
  "Marți",
  "Miercuri",
  "Joi",
  "Vineri",
  "Sâmbătă",
] as const;

/** Highest window start hour: 21:00–00:00 is the last 3-hour window. */
const MAX_WINDOW_START = 21;

/**
 * Confidence for weekday / hour / pickup recommendations, from the number of
 * relevant trips: <10 low, 10–30 medium, >30 high.
 */
export function generalConfidence(trips: number): ConfidenceLevel {
  if (trips < 10) return "scazuta";
  if (trips <= 30) return "medie";
  return "ridicata";
}

/**
 * Confidence for a 3-hour window, which naturally holds fewer trips:
 * <5 low, 5–15 medium, >15 high.
 */
export function windowConfidence(trips: number): ConfidenceLevel {
  if (trips < 5) return "scazuta";
  if (trips <= 15) return "medie";
  return "ridicata";
}

interface Bucket {
  trips: number;
  revenue: number;
  days: Set<string>;
}

function newBucket(): Bucket {
  return { trips: 0, revenue: 0, days: new Set() };
}

/**
 * Opportunity score, 0–100, blended from four parts each normalized against the
 * best bucket in the same group:
 *   score = 0.45·revenue + 0.30·trips + 0.15·avgTripValue + 0.10·consistency
 * where consistency is the number of distinct active days. Deterministic and
 * intentionally simple — a transparent ranking, not a statistical model.
 */
function opportunityScore(
  revenue: number,
  trips: number,
  avgTripValue: number,
  activeDays: number,
  max: { revenue: number; trips: number; avg: number; days: number },
): number {
  const revenueScore = max.revenue > 0 ? revenue / max.revenue : 0;
  const tripScore = max.trips > 0 ? trips / max.trips : 0;
  const avgScore = max.avg > 0 ? avgTripValue / max.avg : 0;
  const consistencyScore = max.days > 0 ? activeDays / max.days : 0;

  const blended =
    revenueScore * 0.45 +
    tripScore * 0.3 +
    avgScore * 0.15 +
    consistencyScore * 0.1;

  return Math.round(blended * 100);
}

/** Build the weekday stats (only weekdays that had at least one trip). */
function buildWeekdays(trips: BoltTrip[]): WeekdayStat[] {
  const byWeekday = new Map<number, Bucket>();

  for (const trip of trips) {
    const date = new Date(trip.tripDate);
    if (Number.isNaN(date.getTime())) continue;
    const weekday = date.getDay();
    const bucket = byWeekday.get(weekday) ?? newBucket();
    bucket.trips += 1;
    bucket.revenue += trip.totalValue;
    bucket.days.add(toDayKey(date));
    byWeekday.set(weekday, bucket);
  }

  const rows: WeekdayStat[] = [];
  for (const [weekday, b] of byWeekday) {
    const activeDates = b.days.size;
    rows.push({
      weekday,
      label: WEEKDAY_NAMES[weekday],
      trips: b.trips,
      revenue: b.revenue,
      averageTripValue: b.trips > 0 ? b.revenue / b.trips : 0,
      activeDates,
      averageRevenuePerActiveDay: activeDates > 0 ? b.revenue / activeDates : 0,
      confidence: generalConfidence(b.trips),
    });
  }

  // Best revenue first; ties broken by trips then weekday for determinism.
  rows.sort(
    (a, b) =>
      b.revenue - a.revenue || b.trips - a.trips || a.weekday - b.weekday,
  );
  return rows;
}

/** Build the top hour-of-day recommendations by opportunity score. */
function buildBestHours(trips: BoltTrip[]): HourRecommendation[] {
  const byHour = new Map<number, Bucket>();
  for (const trip of trips) {
    const date = new Date(trip.tripDate);
    if (Number.isNaN(date.getTime())) continue;
    const hour = date.getHours();
    const bucket = byHour.get(hour) ?? newBucket();
    bucket.trips += 1;
    bucket.revenue += trip.totalValue;
    bucket.days.add(toDayKey(date));
    byHour.set(hour, bucket);
  }

  const raw = [...byHour.entries()].map(([hour, b]) => ({
    hour,
    trips: b.trips,
    revenue: b.revenue,
    avg: b.trips > 0 ? b.revenue / b.trips : 0,
    days: b.days.size,
  }));

  const max = {
    revenue: Math.max(0, ...raw.map((r) => r.revenue)),
    trips: Math.max(0, ...raw.map((r) => r.trips)),
    avg: Math.max(0, ...raw.map((r) => r.avg)),
    days: Math.max(0, ...raw.map((r) => r.days)),
  };

  const scored: HourRecommendation[] = raw.map((r) => ({
    hour: r.hour,
    label: formatHour(r.hour),
    trips: r.trips,
    revenue: r.revenue,
    averageTripValue: r.avg,
    activeDays: r.days,
    score: opportunityScore(r.revenue, r.trips, r.avg, r.days, max),
    confidence: generalConfidence(r.trips),
  }));

  scored.sort(
    (a, b) => b.score - a.score || b.revenue - a.revenue || a.hour - b.hour,
  );
  return scored.slice(0, 3);
}

function windowLabel(weekday: number, startHour: number): string {
  const endHour = startHour + 3;
  const endLabel = endHour >= 24 ? "00:00" : formatHour(endHour);
  return `${WEEKDAY_NAMES[weekday]} ${formatHour(startHour)}–${endLabel}`;
}

/**
 * Build all weekday + 3-hour sliding windows and return them scored.
 *
 * Windows start at 00:00 … 21:00 and each spans 3 hours, so a trip at hour `h`
 * belongs to every window whose start is in `[h-2, h]` (clamped to 0…21).
 */
function buildWindows(trips: BoltTrip[]): WindowRecommendation[] {
  const byWindow = new Map<string, Bucket>();

  for (const trip of trips) {
    const date = new Date(trip.tripDate);
    if (Number.isNaN(date.getTime())) continue;
    const weekday = date.getDay();
    const hour = date.getHours();
    const dayKey = toDayKey(date);

    const first = Math.max(0, hour - 2);
    const last = Math.min(MAX_WINDOW_START, hour);
    for (let start = first; start <= last; start++) {
      const key = `${weekday}-${start}`;
      const bucket = byWindow.get(key) ?? newBucket();
      bucket.trips += 1;
      bucket.revenue += trip.totalValue;
      bucket.days.add(dayKey);
      byWindow.set(key, bucket);
    }
  }

  const raw = [...byWindow.entries()].map(([key, b]) => {
    const [weekday, startHour] = key.split("-").map(Number);
    return {
      weekday,
      startHour,
      trips: b.trips,
      revenue: b.revenue,
      avg: b.trips > 0 ? b.revenue / b.trips : 0,
      days: b.days.size,
    };
  });

  const max = {
    revenue: Math.max(0, ...raw.map((r) => r.revenue)),
    trips: Math.max(0, ...raw.map((r) => r.trips)),
    avg: Math.max(0, ...raw.map((r) => r.avg)),
    days: Math.max(0, ...raw.map((r) => r.days)),
  };

  return raw.map((r) => ({
    weekday: r.weekday,
    startHour: r.startHour,
    label: windowLabel(r.weekday, r.startHour),
    trips: r.trips,
    revenue: r.revenue,
    averageTripValue: r.avg,
    activeDays: r.days,
    score: opportunityScore(r.revenue, r.trips, r.avg, r.days, max),
    confidence: windowConfidence(r.trips),
  }));
}

/** Build the pickup recommendations. */
function buildPickups(trips: BoltTrip[]): {
  mostCommonPickup: PickupRecommendation | null;
  topRevenuePickup: PickupRecommendation | null;
  highValuePickups: PickupRecommendation[];
} {
  const byAddress = new Map<string, { trips: number; revenue: number }>();
  for (const trip of trips) {
    const address = trip.pickupAddress || "(necunoscut)";
    const row = byAddress.get(address) ?? { trips: 0, revenue: 0 };
    row.trips += 1;
    row.revenue += trip.totalValue;
    byAddress.set(address, row);
  }

  const rows: PickupRecommendation[] = [...byAddress.entries()].map(
    ([address, r]) => ({
      address,
      trips: r.trips,
      revenue: r.revenue,
      averageTripValue: r.trips > 0 ? r.revenue / r.trips : 0,
    }),
  );

  let mostCommonPickup: PickupRecommendation | null = null;
  let topRevenuePickup: PickupRecommendation | null = null;
  for (const row of rows) {
    if (
      !mostCommonPickup ||
      row.trips > mostCommonPickup.trips ||
      (row.trips === mostCommonPickup.trips &&
        row.revenue > mostCommonPickup.revenue)
    ) {
      mostCommonPickup = row;
    }
    if (!topRevenuePickup || row.revenue > topRevenuePickup.revenue) {
      topRevenuePickup = row;
    }
  }

  const highValuePickups = rows
    .filter((r) => r.trips >= MIN_TRIPS_FOR_HIGH_VALUE_PICKUP)
    .sort(
      (a, b) =>
        b.averageTripValue - a.averageTripValue ||
        b.trips - a.trips ||
        a.address.localeCompare(b.address),
    )
    .slice(0, 5);

  return { mostCommonPickup, topRevenuePickup, highValuePickups };
}

/**
 * Compute all "ieșit la lucru" recommendations from a set of trips.
 *
 * The trips passed in are already scoped by the caller (either the filtered
 * dashboard selection or the full dataset, depending on the UI toggle). All
 * grouping is keyed off `Data călătoriei` (the real trip date/time).
 */
export function calculateWorkRecommendations(
  trips: BoltTrip[],
): WorkRecommendations {
  const totalTrips = trips.length;
  const weekdays = buildWeekdays(trips);
  const bestHours = buildBestHours(trips);
  const windows = buildWindows(trips);
  const { mostCommonPickup, topRevenuePickup, highValuePickups } =
    buildPickups(trips);

  // Best windows: highest score first.
  const bestWindows = [...windows]
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.revenue - a.revenue ||
        a.weekday - b.weekday ||
        a.startHour - b.startHour,
    )
    .slice(0, 5);

  // Weak windows: lowest score first, but only windows that carry enough data
  // so a single lucky/unlucky trip is never labelled "slab".
  const weakWindows = [...windows]
    .filter((w) => w.trips >= MIN_TRIPS_FOR_WEAK_WINDOW)
    .sort(
      (a, b) =>
        a.score - b.score ||
        a.revenue - b.revenue ||
        a.weekday - b.weekday ||
        a.startHour - b.startHour,
    )
    .slice(0, 3);

  return {
    sufficient: totalTrips >= MIN_TRIPS_FOR_RECOMMENDATIONS,
    totalTrips,
    overallConfidence: generalConfidence(totalTrips),
    weekdays,
    bestWeekday: weekdays[0] ?? null,
    weakestActiveWeekday: weekdays.length > 0 ? weekdays[weekdays.length - 1] : null,
    bestHours,
    bestWindows,
    weakWindows,
    mostCommonPickup,
    topRevenuePickup,
    highValuePickups,
  };
}
