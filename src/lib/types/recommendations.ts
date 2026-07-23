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
