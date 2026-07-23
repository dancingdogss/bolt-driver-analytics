/** Types for the "Recomandări pentru ieșit la lucru" (work recommendations). */

/** Confidence in a recommendation, expressed in plain Romanian. */
export type ConfidenceLevel = "scazuta" | "medie" | "ridicata";

/** Describes the historical data the recommendations were learned from. */
export interface RecommendationLearning {
  /** Completed months (with valid trips) the patterns were learned from. */
  completedMonthCount: number;
  /**
   * Completed months with enough volume (≥50 trips) to count as evidence.
   * Only these drive `overallConfidence` — a completed month with a handful
   * of trips is shown in the learning period but never upgrades confidence.
   * The current (incomplete) month never qualifies.
   */
  evidenceMonthCount: number;
  /** First completed month key (`yyyy-MM`), or null when none exist. */
  firstMonthKey: string | null;
  /** Last completed month key (`yyyy-MM`), or null when none exist. */
  lastMonthKey: string | null;
  /** Trips from completed months. */
  completedTripCount: number;
  /** Valid current-month trips available in the dataset (included or not). */
  currentMonthTripCount: number;
  /** True when current-month (incomplete) trips were included via opt-in. */
  includesCurrentMonth: boolean;
}

/** Aggregated stats for one weekday (Monday–Sunday). */
export interface WeekdayStat {
  /** JS `getDay()` value: 0 = Sunday … 6 = Saturday. */
  weekday: number;
  /** Romanian day name, e.g. "Marți". */
  label: string;
  trips: number;
  revenue: number;
  averageTripValue: number;
  /** Distinct calendar dates (of this weekday) that had at least one trip. */
  activeDates: number;
  /** Distinct ISO weeks in which this weekday had at least one trip. */
  distinctWeeks: number;
  averageRevenuePerActiveDay: number;
  tripsPerActiveDay: number;
  /** True when the pattern repeated enough (≥3 distinct dates). */
  reliable: boolean;
  confidence: ConfidenceLevel;
}

/** A single hour-of-day (0–23) ranked by opportunity score. */
export interface HourRecommendation {
  hour: number;
  /** Display label, e.g. "13:00". */
  label: string;
  trips: number;
  revenue: number;
  averageTripValue: number;
  /** Distinct calendar dates that had a trip in this hour. */
  activeDays: number;
  /** Distinct ISO weeks that had a trip in this hour. */
  distinctWeeks: number;
  revenuePerActiveDay: number;
  tripsPerActiveDay: number;
  /** True when the pattern repeated enough (≥3 dates across ≥2 weeks). */
  reliable: boolean;
  /** Opportunity score, 0–100, normalized among reliable candidates. */
  score: number;
  confidence: ConfidenceLevel;
}

/** A weekday + 3-hour sliding window (e.g. Marți 17:00–20:00). */
export interface WindowRecommendation {
  weekday: number;
  /** Window start hour, 0–21. */
  startHour: number;
  /** Display label, e.g. "Marți 17:00–20:00". */
  label: string;
  trips: number;
  revenue: number;
  averageTripValue: number;
  /** Distinct calendar dates that had a trip in this window. */
  activeDays: number;
  /** Distinct ISO weeks that had a trip in this window. */
  distinctWeeks: number;
  revenuePerActiveDay: number;
  tripsPerActiveDay: number;
  /** True when the pattern repeated enough (≥3 dates across ≥2 weeks). */
  reliable: boolean;
  /** Opportunity score, 0–100, normalized among reliable candidates. */
  score: number;
  confidence: ConfidenceLevel;
}

/** A pickup address surfaced as valuable. */
export interface PickupRecommendation {
  address: string;
  trips: number;
  revenue: number;
  averageTripValue: number;
  /** Distinct calendar dates with at least one pickup at this address. */
  activeDays: number;
}

/** The full recommendations payload. */
export interface WorkRecommendations {
  /** True when there are enough trips for meaningful recommendations. */
  sufficient: boolean;
  /** Total trips the recommendations were computed from. */
  totalTrips: number;
  /**
   * Overall confidence: "scazuta" without reliable patterns or evidence
   * months, "medie" for 1–2 evidence months, "ridicata" for 3+. Evidence
   * months are completed months with ≥50 trips (see `learning`).
   */
  overallConfidence: ConfidenceLevel;
  /** What historical data the patterns were learned from. */
  learning: RecommendationLearning;
  /** True when at least one weekday/hour/window pattern repeated enough. */
  hasReliablePatterns: boolean;

  /** All weekdays that had activity (reliable first, best first). */
  weekdays: WeekdayStat[];
  /** Best RELIABLE weekday by revenue per active day, or null. */
  bestWeekday: WeekdayStat | null;
  /** Weakest RELIABLE weekday (needs ≥2 reliable weekdays), or null. */
  weakestActiveWeekday: WeekdayStat | null;

  /** Top 3 reliable hours by opportunity score. */
  bestHours: HourRecommendation[];
  /** Top 5 reliable weekday + 3-hour windows (overlaps de-duplicated). */
  bestWindows: WindowRecommendation[];
  /** Up to 3 reliable weak windows (only windows with enough data). */
  weakWindows: WindowRecommendation[];

  /** All pickup cards require ≥3 trips on ≥2 distinct dates. */
  mostCommonPickup: PickupRecommendation | null;
  topRevenuePickup: PickupRecommendation | null;
  highValuePickups: PickupRecommendation[];
}

/* --- Historical holdout validation ("Verificare istorică a metodei") --- */

/**
 * Outcome of validating one recommendation against the holdout month:
 *  - "confirmat": enough holdout observations and the pattern held up;
 *  - "neconfirmat": enough observations, but the pattern was materially weaker;
 *  - "date_insuficiente": too few holdout observations to judge — this is NOT a
 *    failure, only a lack of evidence (the driver may not have worked then).
 */
export type ValidationOutcome = "confirmat" | "neconfirmat" | "date_insuficiente";

/** Why the historical validation could not run at all. */
export type ValidationUnavailableReason =
  | "no_holdout"
  | "training_insufficient"
  | "no_reliable_patterns"
  | "holdout_insufficient";

/** Validation result for the recommended best weekday. */
export interface ValidatedWeekday {
  weekday: number;
  label: string;
  outcome: ValidationOutcome;
  /** Distinct dates of this weekday observed in the holdout month. */
  holdoutActiveDates: number;
  /** Revenue per active date for this weekday in the holdout month. */
  holdoutRevenuePerActiveDay: number;
  /** 1-based rank among reliable holdout weekdays (null when unjudged). */
  rank: number | null;
  /** Count of reliable holdout weekdays it was ranked against (null if unjudged). */
  rankOf: number | null;
}

/** Validation result for one recommended 3-hour window. */
export interface ValidatedWindow {
  weekday: number;
  startHour: number;
  label: string;
  outcome: ValidationOutcome;
  /** Distinct dates this window was observed in the holdout month. */
  holdoutActiveDays: number;
  /** Distinct ISO weeks this window was observed in the holdout month. */
  holdoutDistinctWeeks: number;
}

/**
 * A small, honest check of the recommendation METHOD: learn from the completed
 * months strictly before the most recent qualifying completed month, then see
 * whether those patterns held up in that held-out month. Training and holdout
 * never share a trip, and the current (incomplete) month is fully excluded.
 * Display-only — it never feeds back into live ranking or confidence.
 */
export interface RecommendationValidation {
  available: boolean;
  unavailableReason: ValidationUnavailableReason | null;

  /** Training period (completed months strictly before the holdout month). */
  trainingFirstMonthKey: string | null;
  trainingLastMonthKey: string | null;
  trainingTripCount: number;
  /** Completed training months with ≥50 trips (existing evidence rule). */
  trainingEvidenceMonthCount: number;

  /** The independent holdout month. */
  holdoutMonthKey: string | null;
  holdoutTripCount: number;

  /** True when only one training month has enough volume — result is indicative. */
  limited: boolean;

  weekday: ValidatedWeekday | null;
  /** False when the holdout has too few eligible windows to rank (<8). */
  windowPoolSufficient: boolean;
  windows: ValidatedWindow[];
}
