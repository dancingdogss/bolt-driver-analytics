import type { BoltTrip } from "@/lib/types/bolt";
import type {
  ConfidenceLevel,
  HourRecommendation,
  PickupRecommendation,
  WeekdayStat,
  WindowRecommendation,
  WorkRecommendations,
} from "@/lib/types/recommendations";
import { formatHour, isoWeekKey, toDayKey } from "@/lib/utils/dates";
import type { RecommendationTripScope } from "./recommendationScope";

/**
 * Below this many total trips the recommendations are considered too weak to
 * present as guidance (the UI shows an "insufficient data" message instead).
 * Applied AFTER scoping to completed historical months.
 */
export const MIN_TRIPS_FOR_RECOMMENDATIONS = 50;

/** Only flag windows as "weak" once they carry at least this many trips. */
const MIN_TRIPS_FOR_WEAK_WINDOW = 5;

/** Eligibility: a weekday/hour/window needs this many distinct dates. */
const MIN_ACTIVE_DAYS = 3;
/** Eligibility: hours/windows also need this many distinct ISO weeks. */
const MIN_DISTINCT_WEEKS = 2;
/** High confidence: at least this many distinct dates… */
const HIGH_CONFIDENCE_ACTIVE_DAYS = 6;
/** …across at least this many distinct ISO weeks. */
const HIGH_CONFIDENCE_DISTINCT_WEEKS = 3;

/** Every pickup card requires ≥3 trips on ≥2 distinct dates. */
const MIN_TRIPS_FOR_PICKUP = 3;
const MIN_ACTIVE_DAYS_FOR_PICKUP = 2;

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
 * Per-item confidence, driven by repetition rather than raw volume:
 *  - "scazuta": the pattern did not repeat enough to be recommended;
 *  - "medie": eligible (repeated) but below the high thresholds;
 *  - "ridicata": ≥6 distinct dates across ≥3 distinct weeks.
 */
export function itemConfidence(
  reliable: boolean,
  activeDays: number,
  distinctWeeks: number,
): ConfidenceLevel {
  if (!reliable) return "scazuta";
  if (
    activeDays >= HIGH_CONFIDENCE_ACTIVE_DAYS &&
    distinctWeeks >= HIGH_CONFIDENCE_DISTINCT_WEEKS
  ) {
    return "ridicata";
  }
  return "medie";
}

/**
 * Circular distance between two hours of day, so 23:00 and 00:00 count as
 * adjacent: `min(|a-b|, 24-|a-b|)`.
 */
export function circularHourDistance(a: number, b: number): number {
  const diff = Math.abs(a - b);
  return Math.min(diff, 24 - diff);
}

interface Bucket {
  trips: number;
  revenue: number;
  days: Set<string>;
  weeks: Set<string>;
}

function newBucket(): Bucket {
  return { trips: 0, revenue: 0, days: new Set(), weeks: new Set() };
}

/** Common per-bucket derived stats. */
interface BucketStats {
  trips: number;
  revenue: number;
  avg: number;
  days: number;
  weeks: number;
  revenuePerActiveDay: number;
  tripsPerActiveDay: number;
}

function bucketStats(b: Bucket): BucketStats {
  const days = b.days.size;
  return {
    trips: b.trips,
    revenue: b.revenue,
    avg: b.trips > 0 ? b.revenue / b.trips : 0,
    days,
    weeks: b.weeks.size,
    revenuePerActiveDay: days > 0 ? b.revenue / days : 0,
    tripsPerActiveDay: days > 0 ? b.trips / days : 0,
  };
}

/** Maxima taken over the ELIGIBLE candidates only, for score normalization. */
interface EligibleMaxima {
  revenuePerActiveDay: number;
  tripsPerActiveDay: number;
  avg: number;
  weeks: number;
}

function eligibleMaxima(rows: BucketStats[]): EligibleMaxima {
  return {
    revenuePerActiveDay: Math.max(0, ...rows.map((r) => r.revenuePerActiveDay)),
    tripsPerActiveDay: Math.max(0, ...rows.map((r) => r.tripsPerActiveDay)),
    avg: Math.max(0, ...rows.map((r) => r.avg)),
    weeks: Math.max(0, ...rows.map((r) => r.weeks)),
  };
}

/**
 * Opportunity score, 0–100, normalized against the best ELIGIBLE bucket in the
 * same group (an ineligible outlier never distorts the maxima):
 *   score = 0.45·revenue/activeDay + 0.25·trips/activeDay
 *         + 0.15·avgTripValue + 0.15·distinctWeeks
 * Per-active-day averages (not raw totals) reduce exposure bias — a day driven
 * often no longer wins just because it was driven often. A component whose
 * eligible-group maximum is zero contributes zero (never NaN/Infinity).
 */
function opportunityScore(r: BucketStats, max: EligibleMaxima): number {
  const norm = (value: number, maxValue: number) =>
    maxValue > 0 ? value / maxValue : 0;

  const blended =
    norm(r.revenuePerActiveDay, max.revenuePerActiveDay) * 0.45 +
    norm(r.tripsPerActiveDay, max.tripsPerActiveDay) * 0.25 +
    norm(r.avg, max.avg) * 0.15 +
    norm(r.weeks, max.weeks) * 0.15;

  return Math.round(blended * 100);
}

/** Accumulate a trip into a keyed bucket map. */
function accumulate<K>(map: Map<K, Bucket>, key: K, trip: BoltTrip, date: Date) {
  const bucket = map.get(key) ?? newBucket();
  bucket.trips += 1;
  bucket.revenue += trip.totalValue;
  bucket.days.add(toDayKey(date));
  bucket.weeks.add(isoWeekKey(date));
  map.set(key, bucket);
}

/**
 * Build the weekday stats (only weekdays that had at least one trip).
 * Reliable rows first, each group ranked by revenue per active day.
 *
 * Note: the same weekday can only occur once per calendar week, so for a
 * weekday bucket `activeDates === distinctWeeks` always holds.
 */
function buildWeekdays(trips: BoltTrip[]): WeekdayStat[] {
  const byWeekday = new Map<number, Bucket>();
  for (const trip of trips) {
    const date = new Date(trip.tripDate);
    if (Number.isNaN(date.getTime())) continue;
    accumulate(byWeekday, date.getDay(), trip, date);
  }

  const rows: WeekdayStat[] = [...byWeekday.entries()].map(([weekday, b]) => {
    const s = bucketStats(b);
    const reliable = s.days >= MIN_ACTIVE_DAYS;
    return {
      weekday,
      label: WEEKDAY_NAMES[weekday],
      trips: s.trips,
      revenue: s.revenue,
      averageTripValue: s.avg,
      activeDates: s.days,
      distinctWeeks: s.weeks,
      averageRevenuePerActiveDay: s.revenuePerActiveDay,
      tripsPerActiveDay: s.tripsPerActiveDay,
      reliable,
      confidence: itemConfidence(reliable, s.days, s.weeks),
    };
  });

  // Reliable first; then revenue/active-day desc, activeDates desc,
  // distinctWeeks desc, total revenue desc, canonical weekday order.
  rows.sort(
    (a, b) =>
      Number(b.reliable) - Number(a.reliable) ||
      b.averageRevenuePerActiveDay - a.averageRevenuePerActiveDay ||
      b.activeDates - a.activeDates ||
      b.distinctWeeks - a.distinctWeeks ||
      b.revenue - a.revenue ||
      a.weekday - b.weekday,
  );
  return rows;
}

/** Build the top hour-of-day recommendations (reliable hours only). */
function buildBestHours(trips: BoltTrip[]): HourRecommendation[] {
  const byHour = new Map<number, Bucket>();
  for (const trip of trips) {
    const date = new Date(trip.tripDate);
    if (Number.isNaN(date.getTime())) continue;
    accumulate(byHour, date.getHours(), trip, date);
  }

  const eligible = [...byHour.entries()]
    .map(([hour, b]) => ({ hour, stats: bucketStats(b) }))
    .filter(
      (r) =>
        r.stats.days >= MIN_ACTIVE_DAYS && r.stats.weeks >= MIN_DISTINCT_WEEKS,
    );

  const max = eligibleMaxima(eligible.map((r) => r.stats));

  const scored: HourRecommendation[] = eligible.map(({ hour, stats: s }) => ({
    hour,
    label: formatHour(hour),
    trips: s.trips,
    revenue: s.revenue,
    averageTripValue: s.avg,
    activeDays: s.days,
    distinctWeeks: s.weeks,
    revenuePerActiveDay: s.revenuePerActiveDay,
    tripsPerActiveDay: s.tripsPerActiveDay,
    reliable: true,
    score: opportunityScore(s, max),
    confidence: itemConfidence(true, s.days, s.weeks),
  }));

  scored.sort(
    (a, b) =>
      b.score - a.score ||
      b.revenuePerActiveDay - a.revenuePerActiveDay ||
      a.hour - b.hour,
  );
  return scored.slice(0, 3);
}

function windowLabel(weekday: number, startHour: number): string {
  const endHour = startHour + 3;
  const endLabel = endHour >= 24 ? "00:00" : formatHour(endHour);
  return `${WEEKDAY_NAMES[weekday]} ${formatHour(startHour)}–${endLabel}`;
}

/**
 * Build all RELIABLE weekday + 3-hour sliding windows, scored.
 *
 * Windows start at 00:00 … 21:00 and each spans 3 hours, so a trip at hour `h`
 * belongs to every window whose start is in `[h-2, h]` (clamped to 0…21).
 */
function buildWindows(trips: BoltTrip[]): WindowRecommendation[] {
  const byWindow = new Map<string, Bucket>();

  for (const trip of trips) {
    const date = new Date(trip.tripDate);
    if (Number.isNaN(date.getTime())) continue;
    const hour = date.getHours();
    const first = Math.max(0, hour - 2);
    const last = Math.min(MAX_WINDOW_START, hour);
    for (let start = first; start <= last; start++) {
      accumulate(byWindow, `${date.getDay()}-${start}`, trip, date);
    }
  }

  const eligible = [...byWindow.entries()]
    .map(([key, b]) => {
      const [weekday, startHour] = key.split("-").map(Number);
      return { weekday, startHour, stats: bucketStats(b) };
    })
    .filter(
      (r) =>
        r.stats.days >= MIN_ACTIVE_DAYS && r.stats.weeks >= MIN_DISTINCT_WEEKS,
    );

  const max = eligibleMaxima(eligible.map((r) => r.stats));

  return eligible.map(({ weekday, startHour, stats: s }) => ({
    weekday,
    startHour,
    label: windowLabel(weekday, startHour),
    trips: s.trips,
    revenue: s.revenue,
    averageTripValue: s.avg,
    activeDays: s.days,
    distinctWeeks: s.weeks,
    revenuePerActiveDay: s.revenuePerActiveDay,
    tripsPerActiveDay: s.tripsPerActiveDay,
    reliable: true,
    score: opportunityScore(s, max),
    confidence: itemConfidence(true, s.days, s.weeks),
  }));
}

/** Two windows overlap when they share a weekday and (circularly) ≤2h apart. */
function windowsOverlap(a: WindowRecommendation, b: WindowRecommendation) {
  return (
    a.weekday === b.weekday &&
    circularHourDistance(a.startHour, b.startHour) <= 2
  );
}

/**
 * Pick up to `limit` windows from an already-sorted candidate list, skipping
 * any window overlapping an already-selected one (`taken` seeds the selection
 * with windows chosen elsewhere, e.g. best windows when picking weak ones).
 */
function selectNonOverlapping(
  sorted: WindowRecommendation[],
  limit: number,
  taken: WindowRecommendation[] = [],
): WindowRecommendation[] {
  const picked: WindowRecommendation[] = [];
  for (const candidate of sorted) {
    if (picked.length >= limit) break;
    const blocked = [...taken, ...picked].some((w) =>
      windowsOverlap(w, candidate),
    );
    if (!blocked) picked.push(candidate);
  }
  return picked;
}

/** Build the pickup recommendations (each card needs ≥3 trips on ≥2 dates). */
function buildPickups(trips: BoltTrip[]): {
  mostCommonPickup: PickupRecommendation | null;
  topRevenuePickup: PickupRecommendation | null;
  highValuePickups: PickupRecommendation[];
} {
  const byAddress = new Map<string, Bucket>();
  for (const trip of trips) {
    const date = new Date(trip.tripDate);
    if (Number.isNaN(date.getTime())) continue;
    accumulate(byAddress, trip.pickupAddress || "(necunoscut)", trip, date);
  }

  const eligible: PickupRecommendation[] = [...byAddress.entries()]
    .map(([address, b]) => {
      const s = bucketStats(b);
      return {
        address,
        trips: s.trips,
        revenue: s.revenue,
        averageTripValue: s.avg,
        activeDays: s.days,
      };
    })
    .filter(
      (r) =>
        r.trips >= MIN_TRIPS_FOR_PICKUP &&
        r.activeDays >= MIN_ACTIVE_DAYS_FOR_PICKUP,
    );

  let mostCommonPickup: PickupRecommendation | null = null;
  let topRevenuePickup: PickupRecommendation | null = null;
  for (const row of eligible) {
    if (
      !mostCommonPickup ||
      row.trips > mostCommonPickup.trips ||
      (row.trips === mostCommonPickup.trips &&
        (row.revenue > mostCommonPickup.revenue ||
          (row.revenue === mostCommonPickup.revenue &&
            row.address.localeCompare(mostCommonPickup.address) < 0)))
    ) {
      mostCommonPickup = row;
    }
    if (
      !topRevenuePickup ||
      row.revenue > topRevenuePickup.revenue ||
      (row.revenue === topRevenuePickup.revenue &&
        (row.trips > topRevenuePickup.trips ||
          (row.trips === topRevenuePickup.trips &&
            row.address.localeCompare(topRevenuePickup.address) < 0)))
    ) {
      topRevenuePickup = row;
    }
  }

  const highValuePickups = [...eligible]
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
 * Compute all "ieșit la lucru" recommendations from a scoped set of trips.
 *
 * The scope (see `scopeRecommendationTrips`) holds trips from COMPLETED
 * calendar months — optionally plus the current month via opt-in — never the
 * dashboard filter. All grouping is keyed off `Data călătoriei`.
 *
 * A weekday/hour/window is only RECOMMENDED when it repeated across enough
 * distinct dates (and weeks, for hours/windows). Buckets that did not repeat
 * remain visible in the informational weekday table, flagged `reliable: false`.
 * These are historical gross-revenue patterns — never profit, never guarantees.
 */
export function calculateWorkRecommendations(
  scope: RecommendationTripScope,
): WorkRecommendations {
  const trips = scope.trips;
  const totalTrips = trips.length;

  const weekdays = buildWeekdays(trips);
  const bestHours = buildBestHours(trips);
  const windows = buildWindows(trips);
  const { mostCommonPickup, topRevenuePickup, highValuePickups } =
    buildPickups(trips);

  const reliableWeekdays = weekdays.filter((w) => w.reliable);
  const bestWeekday = reliableWeekdays[0] ?? null;
  const weakestActiveWeekday =
    reliableWeekdays.length > 1
      ? reliableWeekdays[reliableWeekdays.length - 1]
      : null;

  // Best windows: highest score first, overlapping windows de-duplicated.
  const sortedBest = [...windows].sort(
    (a, b) =>
      b.score - a.score ||
      b.revenuePerActiveDay - a.revenuePerActiveDay ||
      a.weekday - b.weekday ||
      a.startHour - b.startHour,
  );
  const bestWindows = selectNonOverlapping(sortedBest, 5);

  // Weak windows: lowest score first, still only RELIABLE windows carrying
  // enough trips — a pattern must repeat before it can honestly be called
  // weak. Windows overlapping a selected best window are skipped, so the card
  // never contradicts itself.
  const sortedWeak = windows
    .filter((w) => w.trips >= MIN_TRIPS_FOR_WEAK_WINDOW)
    .sort(
      (a, b) =>
        a.score - b.score ||
        a.revenuePerActiveDay - b.revenuePerActiveDay ||
        a.weekday - b.weekday ||
        a.startHour - b.startHour,
    );
  const weakWindows = selectNonOverlapping(sortedWeak, 3, bestWindows);

  const hasReliablePatterns =
    bestWeekday !== null || bestHours.length > 0 || bestWindows.length > 0;

  const completedMonthCount = scope.completedMonthKeys.length;
  // Evidence months: completed months with enough volume to actually support
  // the confidence claim. A completed month with a handful of trips still
  // shows in the learning period, but never upgrades confidence. The current
  // (incomplete) month is not in `tripsPerCompletedMonth`, so opting it in
  // can never add an evidence month.
  const evidenceMonthCount = scope.completedMonthKeys.filter(
    (key) =>
      (scope.tripsPerCompletedMonth[key] ?? 0) >= MIN_TRIPS_FOR_RECOMMENDATIONS,
  ).length;
  const overallConfidence: ConfidenceLevel =
    evidenceMonthCount === 0 || !hasReliablePatterns
      ? "scazuta"
      : evidenceMonthCount >= 3
        ? "ridicata"
        : "medie";

  return {
    sufficient: totalTrips >= MIN_TRIPS_FOR_RECOMMENDATIONS,
    totalTrips,
    overallConfidence,
    learning: {
      completedMonthCount,
      evidenceMonthCount,
      firstMonthKey: scope.completedMonthKeys[0] ?? null,
      lastMonthKey: scope.completedMonthKeys[completedMonthCount - 1] ?? null,
      completedTripCount: scope.completedTripCount,
      currentMonthTripCount: scope.currentMonthTripCount,
      includesCurrentMonth: scope.includesCurrentMonth,
    },
    hasReliablePatterns,
    weekdays,
    bestWeekday,
    weakestActiveWeekday,
    bestHours,
    bestWindows,
    weakWindows,
    mostCommonPickup,
    topRevenuePickup,
    highValuePickups,
  };
}
