import type { BoltTrip } from "@/lib/types/bolt";
import { getMonthKey } from "@/lib/utils/dates";

/**
 * The trips a recommendation run is allowed to learn from, plus the metadata
 * needed to describe that learning period honestly in the UI.
 *
 * Recommendations learn from COMPLETED calendar months only (the current month
 * is incomplete and would bias the patterns). The current month can be added
 * explicitly via opt-in, but it never counts as a completed month.
 */
export interface RecommendationTripScope {
  /** The trips recommendations are computed from. */
  trips: BoltTrip[];
  /** Completed months (`yyyy-MM`, ascending) that contain at least one valid trip. */
  completedMonthKeys: string[];
  /** Valid trip count per completed month, keyed by `yyyy-MM`. */
  tripsPerCompletedMonth: Record<string, number>;
  /** Trips that belong to completed months (always part of `trips`). */
  completedTripCount: number;
  /** Valid current-month trips present in the dataset (included or not). */
  currentMonthTripCount: number;
  /** True when current-month trips are actually part of `trips`. */
  includesCurrentMonth: boolean;
}

/**
 * Scope the imported trips for the recommendation engine.
 *
 * - Trips with an invalid `tripDate` are always dropped.
 * - Trips in months after the current one (future-dated) are always dropped.
 * - Current-month trips are dropped unless `includeCurrentMonth` is true.
 * - Everything else (completed calendar months) is kept.
 *
 * `now` is injectable so the month boundary is testable.
 */
export function scopeRecommendationTrips(
  allTrips: BoltTrip[],
  includeCurrentMonth: boolean,
  now: Date = new Date(),
): RecommendationTripScope {
  const currentKey = getMonthKey(now);

  const completed: BoltTrip[] = [];
  const currentMonth: BoltTrip[] = [];
  const tripsPerCompletedMonth: Record<string, number> = {};

  for (const trip of allTrips) {
    const date = new Date(trip.tripDate);
    if (Number.isNaN(date.getTime())) continue;
    const key = getMonthKey(date);
    if (key < currentKey) {
      completed.push(trip);
      tripsPerCompletedMonth[key] = (tripsPerCompletedMonth[key] ?? 0) + 1;
    } else if (key === currentKey) {
      currentMonth.push(trip);
    }
    // key > currentKey: future-dated — never usable as history.
  }

  const includesCurrentMonth = includeCurrentMonth && currentMonth.length > 0;

  return {
    trips: includesCurrentMonth ? [...completed, ...currentMonth] : completed,
    completedMonthKeys: Object.keys(tripsPerCompletedMonth).sort((a, b) =>
      a.localeCompare(b),
    ),
    tripsPerCompletedMonth,
    completedTripCount: completed.length,
    currentMonthTripCount: currentMonth.length,
    includesCurrentMonth,
  };
}
