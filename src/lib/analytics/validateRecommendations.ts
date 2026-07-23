import type { BoltTrip } from "@/lib/types/bolt";
import type {
  RecommendationValidation,
  ValidatedWeekday,
  ValidatedWindow,
  ValidationOutcome,
} from "@/lib/types/recommendations";
import {
  analyzeWindows,
  calculateWorkRecommendations,
  MIN_TRIPS_FOR_RECOMMENDATIONS,
  windowsOverlap,
} from "./calculateWorkRecommendations";
import {
  scopeRecommendationTrips,
  type RecommendationTripScope,
} from "./recommendationScope";
import { filterTrips } from "./dateFilter";

/* Sample gates ---------------------------------------------------------- */

/** A recommended weekday needs at least this many distinct holdout dates. */
const WEEKDAY_MIN_HOLDOUT_DATES = 3;
/** The holdout must contain at least this many reliable weekdays to rank. */
const WEEKDAY_MIN_RELIABLE = 4;
/** The holdout must contain at least this many eligible windows to rank. */
const WINDOW_MIN_ELIGIBLE_POOL = 8;
/** "Materially weaker" tolerance: within 10% of the cutoff still counts. */
const TOLERANCE = 0.9;

/** First instant of a `yyyy-MM` month, local time. */
function monthStart(monthKey: string): Date {
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(year, month - 1, 1, 0, 0, 0, 0);
}

/** First instant of the month AFTER a `yyyy-MM` month, local time. */
function nextMonthStart(monthKey: string): Date {
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(year, month, 1, 0, 0, 0, 0);
}

/**
 * The chronological training/holdout split — a single, pure, testable place
 * where "which trips are training vs. holdout" is decided.
 *
 * `holdoutMonthKey` is the most recent COMPLETED month (under `now`) with at
 * least `MIN_TRIPS_FOR_RECOMMENDATIONS` valid trips, or null when none exists.
 * Training holds the completed trips STRICTLY before that month — obtained by
 * re-scoping with `now` at the holdout month's first instant, so the holdout
 * month and everything after it (sparse later completed months, the current
 * month, future/invalid dates) all drop out. Training and holdout can never
 * share a trip.
 */
export interface TrainingHoldoutSplit {
  holdoutMonthKey: string | null;
  trainingScope: RecommendationTripScope | null;
  trainingTrips: BoltTrip[];
  holdoutTrips: BoltTrip[];
}

export function splitTrainingHoldout(
  allTrips: BoltTrip[],
  now: Date = new Date(),
): TrainingHoldoutSplit {
  const base = scopeRecommendationTrips(allTrips, false, now);

  const holdoutMonthKey =
    [...base.completedMonthKeys]
      .reverse()
      .find(
        (key) =>
          (base.tripsPerCompletedMonth[key] ?? 0) >=
          MIN_TRIPS_FOR_RECOMMENDATIONS,
      ) ?? null;

  if (!holdoutMonthKey) {
    return {
      holdoutMonthKey: null,
      trainingScope: null,
      trainingTrips: [],
      holdoutTrips: [],
    };
  }

  const trainingScope = scopeRecommendationTrips(
    allTrips,
    false,
    monthStart(holdoutMonthKey),
  );
  const holdoutTrips = filterTrips(allTrips, {
    mode: "month",
    monthKey: holdoutMonthKey,
  });

  return {
    holdoutMonthKey,
    trainingScope,
    trainingTrips: trainingScope.trips,
    holdoutTrips,
  };
}

/** An unavailable validation result carrying only the reason + training/holdout meta. */
function unavailable(
  reason: RecommendationValidation["unavailableReason"],
  partial: Partial<RecommendationValidation> = {},
): RecommendationValidation {
  return {
    available: false,
    unavailableReason: reason,
    trainingFirstMonthKey: null,
    trainingLastMonthKey: null,
    trainingTripCount: 0,
    trainingEvidenceMonthCount: 0,
    holdoutMonthKey: null,
    holdoutTripCount: 0,
    limited: false,
    weekday: null,
    windowPoolSufficient: false,
    windows: [],
    ...partial,
  };
}

/**
 * Run the historical holdout validation over ALL imported trips.
 *
 * Chronological split (all via existing, tested helpers — no new date logic):
 *  1. `scopeRecommendationTrips(trips, false, now)` excludes the current month,
 *     future-dated and invalid-dated trips, and yields the completed months.
 *  2. Holdout = the most recent completed month with ≥50 valid trips.
 *  3. Training = completed trips STRICTLY before the holdout month, obtained by
 *     re-scoping with `now` set to the holdout month's first instant (so the
 *     holdout month and everything after it — including sparse later completed
 *     months — become "current/future" and drop out).
 *  4. Holdout trips = `filterTrips(trips, { month: holdoutKey })`.
 *
 * The `recIncludeCurrentMonth` UI toggle is never consulted here: validation
 * always scopes with `includeCurrentMonth = false`.
 */
export function validateWorkRecommendations(
  allTrips: BoltTrip[],
  now: Date = new Date(),
): RecommendationValidation {
  const split = splitTrainingHoldout(allTrips, now);
  const { holdoutMonthKey, trainingScope, trainingTrips, holdoutTrips } = split;

  if (!holdoutMonthKey || !trainingScope) return unavailable("no_holdout");

  const trainingTripCount = trainingTrips.length;
  const trainingMeta = {
    trainingFirstMonthKey: trainingScope.completedMonthKeys[0] ?? null,
    trainingLastMonthKey:
      trainingScope.completedMonthKeys[
        trainingScope.completedMonthKeys.length - 1
      ] ?? null,
    trainingTripCount,
    holdoutMonthKey,
  };

  if (trainingTripCount < MIN_TRIPS_FOR_RECOMMENDATIONS) {
    return unavailable("training_insufficient", trainingMeta);
  }

  const trainingRec = calculateWorkRecommendations(trainingScope);
  const trainingEvidenceMonthCount = trainingRec.learning.evidenceMonthCount;
  const limited = trainingEvidenceMonthCount < 2;

  if (!trainingRec.hasReliablePatterns) {
    return unavailable("no_reliable_patterns", {
      ...trainingMeta,
      trainingEvidenceMonthCount,
      limited,
    });
  }

  if (holdoutTrips.length < MIN_TRIPS_FOR_RECOMMENDATIONS) {
    return unavailable("holdout_insufficient", {
      ...trainingMeta,
      trainingEvidenceMonthCount,
      limited,
    });
  }

  const weekday = validateWeekday(trainingRec.bestWeekday, holdoutTrips, holdoutMonthKey);
  const windowResult = validateWindows(trainingRec.bestWindows, holdoutTrips);

  return {
    available: true,
    unavailableReason: null,
    ...trainingMeta,
    trainingEvidenceMonthCount,
    holdoutTripCount: holdoutTrips.length,
    limited,
    weekday,
    windowPoolSufficient: windowResult.poolSufficient,
    windows: windowResult.windows,
  };
}

/**
 * Validate the recommended best weekday against the holdout month using the
 * engine's own weekday stats (reliable-first, revenue-per-active-day order).
 */
function validateWeekday(
  recommended: RecommendationValidationInput["bestWeekday"],
  holdoutTrips: BoltTrip[],
  holdoutMonthKey: string,
): ValidatedWeekday | null {
  if (!recommended) return null;

  // Holdout weekday stats via the public engine (no private internals).
  const holdoutScope = scopeRecommendationTrips(
    holdoutTrips,
    false,
    nextMonthStart(holdoutMonthKey),
  );
  const holdoutWeekdays = calculateWorkRecommendations(holdoutScope).weekdays;
  const reliable = holdoutWeekdays.filter((w) => w.reliable);
  const n = reliable.length;

  const hw = holdoutWeekdays.find((w) => w.weekday === recommended.weekday);

  const base: ValidatedWeekday = {
    weekday: recommended.weekday,
    label: recommended.label,
    outcome: "date_insuficiente",
    holdoutActiveDates: hw?.activeDates ?? 0,
    holdoutRevenuePerActiveDay: hw?.averageRevenuePerActiveDay ?? 0,
    rank: null,
    rankOf: null,
  };

  // Sample gates: enough dates for THIS weekday, enough reliable weekdays to rank.
  if (!hw || hw.activeDates < WEEKDAY_MIN_HOLDOUT_DATES) return base;
  if (n < WEEKDAY_MIN_RELIABLE) return base;

  const rankIndex = reliable.findIndex((w) => w.weekday === recommended.weekday);
  // hw is reliable (activeDates ≥ 3 ⇒ reliable), so it is present in `reliable`.
  // topHalfCount is a COUNT, not an index. Inside the top half means
  // rankIndex < topHalfCount; the tolerance boundary is the LAST weekday still
  // inside the top half, at zero-based index topHalfCount - 1. The n ≥ 4 gate
  // above guarantees topHalfCount ≥ 2, so that index is always valid.
  const topHalfCount = Math.floor(n / 2);
  const cutoffValue = reliable[topHalfCount - 1].averageRevenuePerActiveDay;

  let outcome: ValidationOutcome;
  if (rankIndex < topHalfCount) {
    outcome = "confirmat";
  } else if (cutoffValue > 0) {
    outcome =
      hw.averageRevenuePerActiveDay >= TOLERANCE * cutoffValue
        ? "confirmat"
        : "neconfirmat";
  } else {
    // Zero cutoff: deterministic rank only, no ratio (never NaN/Infinity).
    outcome = "neconfirmat";
  }

  return {
    ...base,
    outcome,
    rank: rankIndex + 1,
    rankOf: n,
  };
}

/**
 * Validate the recommended windows against the holdout month, reusing the
 * single shared window analysis (eligibility, scoring, de-duplication).
 */
function validateWindows(
  recommended: RecommendationValidationInput["bestWindows"],
  holdoutTrips: BoltTrip[],
): { poolSufficient: boolean; windows: ValidatedWindow[] } {
  const analysis = analyzeWindows(holdoutTrips);
  const poolSufficient = analysis.eligibleSorted.length >= WINDOW_MIN_ELIGIBLE_POOL;
  if (!poolSufficient) return { poolSufficient: false, windows: [] };

  // Lowest score among the holdout's de-duplicated top selection.
  const top = analysis.top;
  const top5CutoffScore = top.length > 0 ? top[top.length - 1].score : 0;

  const windows: ValidatedWindow[] = recommended.map((rec) => {
    const candidate = analysis.all.find(
      (c) => c.weekday === rec.weekday && c.startHour === rec.startHour,
    );

    const base: ValidatedWindow = {
      weekday: rec.weekday,
      startHour: rec.startHour,
      label: rec.label,
      outcome: "date_insuficiente",
      holdoutActiveDays: candidate?.activeDays ?? 0,
      holdoutDistinctWeeks: candidate?.distinctWeeks ?? 0,
    };

    // Exact-bucket sample gate: must itself be reliable in the holdout month.
    if (!candidate || !candidate.reliable) return base;

    const eligible = analysis.eligibleSorted.find(
      (w) => w.weekday === rec.weekday && w.startHour === rec.startHour,
    );
    const score = eligible?.score ?? 0;

    const overlapsTop = top.some((t) => windowsOverlap(t, rec));
    const withinCutoff =
      top5CutoffScore > 0 && score >= TOLERANCE * top5CutoffScore;

    return {
      ...base,
      outcome: overlapsTop || withinCutoff ? "confirmat" : "neconfirmat",
    };
  });

  return { poolSufficient: true, windows };
}

/** Narrow view of the training recommendations the validation consumes. */
interface RecommendationValidationInput {
  bestWeekday: ReturnType<typeof calculateWorkRecommendations>["bestWeekday"];
  bestWindows: ReturnType<typeof calculateWorkRecommendations>["bestWindows"];
}
