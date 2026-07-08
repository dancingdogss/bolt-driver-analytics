/** Types for the "Recomandări pentru ieșit la lucru" (work recommendations). */

/** Confidence in a recommendation, expressed in plain Romanian. */
export type ConfidenceLevel = "scazuta" | "medie" | "ridicata";

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
  averageRevenuePerActiveDay: number;
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
  /** Opportunity score, 0–100. */
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
  /** Opportunity score, 0–100. */
  score: number;
  confidence: ConfidenceLevel;
}

/** A pickup address surfaced as valuable. */
export interface PickupRecommendation {
  address: string;
  trips: number;
  revenue: number;
  averageTripValue: number;
}

/** The full recommendations payload for the current selection. */
export interface WorkRecommendations {
  /** True when there are enough trips for meaningful recommendations. */
  sufficient: boolean;
  /** Total trips the recommendations were computed from. */
  totalTrips: number;
  /** Overall confidence, derived from `totalTrips`. */
  overallConfidence: ConfidenceLevel;

  /** All weekdays that had activity, best revenue first. */
  weekdays: WeekdayStat[];
  bestWeekday: WeekdayStat | null;
  weakestActiveWeekday: WeekdayStat | null;

  /** Top 3 hours by opportunity score. */
  bestHours: HourRecommendation[];
  /** Top 5 weekday + 3-hour windows by opportunity score. */
  bestWindows: WindowRecommendation[];
  /** Up to 3 weak windows (only windows with enough data). */
  weakWindows: WindowRecommendation[];

  mostCommonPickup: PickupRecommendation | null;
  topRevenuePickup: PickupRecommendation | null;
  /** Pickups with a high average trip value, min 3 trips. */
  highValuePickups: PickupRecommendation[];
}
