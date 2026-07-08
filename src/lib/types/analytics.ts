/** Shared analytics types for driver insights and reporting. */

export interface DayInsight {
  /** `yyyy-MM-dd` sort key. */
  dayKey: string;
  /** Display label, e.g. `01 Jun 2026`. */
  label: string;
  revenue: number;
  trips: number;
}

export interface HourInsight {
  /** Hour of day, 0–23. */
  hour: number;
  /** Display label, e.g. `13:00`. */
  label: string;
  revenue: number;
  trips: number;
}

export interface PickupInsight {
  address: string;
  trips: number;
  revenue: number;
}

export interface PaymentInsights {
  boltPaymentRevenue: number;
  /** `Numerar` (cash) revenue. */
  cashRevenue: number;
  businessRevenue: number;
  /** Cash share of total revenue, as a percentage (0–100). */
  cashPercent: number;
  /** Non-cash (card / platform) share of total revenue, as a percentage. */
  cardPlatformPercent: number;
}

export interface DailyPerformance {
  /** Days with at least one trip. */
  activeDays: number;
  /** Calendar days in the selected range (used for profit proration). */
  selectedDays: number;
  /** Revenue per active day (only days with trips). */
  averageRevenuePerActiveDay: number;
  /** Trips per active day (only days with trips). */
  averageTripsPerActiveDay: number;
  /** Estimated profit per calendar day (uses the full selected range). */
  estimatedProfitPerDay: number;
  /** Estimated profit per week. */
  estimatedProfitPerWeek: number;
}

export interface DriverInsights {
  bestDay: DayInsight | null;
  worstDay: DayInsight | null;
  bestHour: HourInsight | null;
  worstActiveHour: HourInsight | null;
  mostCommonPickup: PickupInsight | null;
  topRevenuePickup: PickupInsight | null;
  payments: PaymentInsights;
  averages: DailyPerformance;
}
