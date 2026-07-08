import type { BoltTrip } from "@/lib/types/bolt";
import type { DriverInsights, PickupInsight } from "@/lib/types/analytics";
import type { BoltMetrics } from "./calculateBoltMetrics";
import { formatDayKeyLong } from "@/lib/utils/dates";

/**
 * Derive plain-text driver insights for the currently selected date range.
 *
 * Everything is computed from the already-filtered `trips`/`metrics`, keyed off
 * `Data călătoriei`. Two different day counts are used intentionally:
 *  - active-day averages divide by days that actually had trips;
 *  - profit/day and profit/week divide by the full selected calendar range,
 *    because weekly costs apply even on days with no trips.
 */
export function calculateDriverInsights(
  trips: BoltTrip[],
  metrics: BoltMetrics,
  selectedDays: number,
  estimatedProfit: number,
): DriverInsights {
  // Best / worst revenue day. `metrics.dailyRevenue` only contains days with
  // trips, so the "worst day" is automatically an active day.
  let bestDay: DriverInsights["bestDay"] = null;
  let worstDay: DriverInsights["worstDay"] = null;
  for (const d of metrics.dailyRevenue) {
    const item = {
      dayKey: d.dayKey,
      label: formatDayKeyLong(d.dayKey),
      revenue: d.revenue,
      trips: d.trips,
    };
    if (!bestDay || item.revenue > bestDay.revenue) bestDay = item;
    if (!worstDay || item.revenue < worstDay.revenue) worstDay = item;
  }

  // Best revenue hour and worst *active* revenue hour (hours with trips only).
  let bestHour: DriverInsights["bestHour"] = null;
  let worstActiveHour: DriverInsights["worstActiveHour"] = null;
  for (const h of metrics.hourlyRevenue) {
    if (h.trips === 0) continue;
    const item = { hour: h.hour, label: h.label, revenue: h.revenue, trips: h.trips };
    if (!bestHour || item.revenue > bestHour.revenue) bestHour = item;
    if (!worstActiveHour || item.revenue < worstActiveHour.revenue) {
      worstActiveHour = item;
    }
  }

  // Pickups: most common (by trip count) and highest revenue.
  const byAddress = new Map<string, PickupInsight>();
  for (const trip of trips) {
    const address = trip.pickupAddress || "(necunoscut)";
    const row = byAddress.get(address) ?? { address, trips: 0, revenue: 0 };
    row.trips += 1;
    row.revenue += trip.totalValue;
    byAddress.set(address, row);
  }
  let mostCommonPickup: PickupInsight | null = null;
  let topRevenuePickup: PickupInsight | null = null;
  for (const row of byAddress.values()) {
    if (!mostCommonPickup || row.trips > mostCommonPickup.trips) {
      mostCommonPickup = { ...row };
    }
    if (!topRevenuePickup || row.revenue > topRevenuePickup.revenue) {
      topRevenuePickup = { ...row };
    }
  }

  // Payment insights.
  const paymentTotal = (method: string) =>
    metrics.paymentSplit.find((p) => p.method === method)?.revenue ?? 0;
  const cashRevenue = paymentTotal("Numerar");
  const totalRevenue = metrics.totalRevenue;
  const cashPercent = totalRevenue > 0 ? (cashRevenue / totalRevenue) * 100 : 0;
  const cardPlatformPercent =
    totalRevenue > 0 ? ((totalRevenue - cashRevenue) / totalRevenue) * 100 : 0;

  // Averages: active-day vs. selected-calendar-day.
  const activeDays = metrics.dailyRevenue.length;
  const profitPerDay = selectedDays > 0 ? estimatedProfit / selectedDays : 0;

  return {
    bestDay,
    worstDay,
    bestHour,
    worstActiveHour,
    mostCommonPickup,
    topRevenuePickup,
    payments: {
      boltPaymentRevenue: paymentTotal("Bolt Payment"),
      cashRevenue,
      businessRevenue: paymentTotal("Business"),
      cashPercent,
      cardPlatformPercent,
    },
    averages: {
      activeDays,
      selectedDays,
      averageRevenuePerActiveDay: activeDays > 0 ? totalRevenue / activeDays : 0,
      averageTripsPerActiveDay:
        activeDays > 0 ? metrics.totalTrips / activeDays : 0,
      estimatedProfitPerDay: profitPerDay,
      estimatedProfitPerWeek: profitPerDay * 7,
    },
  };
}
