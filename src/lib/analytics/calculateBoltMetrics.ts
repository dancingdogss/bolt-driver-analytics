import type { BoltTrip } from "@/lib/types/bolt";
import { formatDay, formatHour, getHour, toDayKey } from "@/lib/utils/dates";

export interface PaymentSplitRow {
  method: string;
  trips: number;
  revenue: number;
  /** Share of total revenue, 0–1. */
  share: number;
}

export interface DailyRevenueRow {
  /** `yyyy-MM-dd` sort key. */
  dayKey: string;
  /** `dd.MM.yyyy` display label. */
  label: string;
  revenue: number;
  trips: number;
}

export interface HourlyRevenueRow {
  hour: number;
  /** `HH:00` display label. */
  label: string;
  revenue: number;
  trips: number;
}

export interface TopPickupRow {
  address: string;
  trips: number;
  revenue: number;
}

export interface BoltMetrics {
  totalTrips: number;
  totalRevenue: number;
  revenueWithoutVat: number;
  vatTotal: number;
  averageTripValue: number;
  paymentSplit: PaymentSplitRow[];
  dailyRevenue: DailyRevenueRow[];
  hourlyRevenue: HourlyRevenueRow[];
  topPickups: TopPickupRow[];
}

const EMPTY_METRICS: BoltMetrics = {
  totalTrips: 0,
  totalRevenue: 0,
  revenueWithoutVat: 0,
  vatTotal: 0,
  averageTripValue: 0,
  paymentSplit: [],
  dailyRevenue: [],
  hourlyRevenue: [],
  topPickups: [],
};

/**
 * Compute all dashboard metrics from parsed trips.
 *
 * Analytics are keyed off `Data călătoriei` (the real trip date) — never the
 * invoice date or file name.
 */
export function calculateBoltMetrics(
  trips: BoltTrip[],
  topPickupsLimit = 10,
): BoltMetrics {
  if (trips.length === 0) return EMPTY_METRICS;

  let totalRevenue = 0;
  let revenueWithoutVat = 0;
  let vatTotal = 0;

  const byPayment = new Map<string, { trips: number; revenue: number }>();
  const byDay = new Map<string, DailyRevenueRow>();
  const byHour = new Map<number, HourlyRevenueRow>();
  const byPickup = new Map<string, TopPickupRow>();

  for (let hour = 0; hour < 24; hour++) {
    byHour.set(hour, { hour, label: formatHour(hour), revenue: 0, trips: 0 });
  }

  for (const trip of trips) {
    totalRevenue += trip.totalValue;
    revenueWithoutVat += trip.valueWithoutVat;
    vatTotal += trip.vat;

    const pay = byPayment.get(trip.paymentMethod) ?? { trips: 0, revenue: 0 };
    pay.trips += 1;
    pay.revenue += trip.totalValue;
    byPayment.set(trip.paymentMethod, pay);

    const address = trip.pickupAddress || "(necunoscut)";
    const pickup = byPickup.get(address) ?? { address, trips: 0, revenue: 0 };
    pickup.trips += 1;
    pickup.revenue += trip.totalValue;
    byPickup.set(address, pickup);

    const date = new Date(trip.tripDate);
    if (!Number.isNaN(date.getTime())) {
      const dayKey = toDayKey(date);
      const day =
        byDay.get(dayKey) ?? { dayKey, label: formatDay(date), revenue: 0, trips: 0 };
      day.revenue += trip.totalValue;
      day.trips += 1;
      byDay.set(dayKey, day);

      const hourRow = byHour.get(getHour(date))!;
      hourRow.revenue += trip.totalValue;
      hourRow.trips += 1;
    }
  }

  const totalTrips = trips.length;

  const paymentSplit: PaymentSplitRow[] = [...byPayment.entries()]
    .map(([method, v]) => ({
      method,
      trips: v.trips,
      revenue: v.revenue,
      share: totalRevenue > 0 ? v.revenue / totalRevenue : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue);

  const dailyRevenue = [...byDay.values()].sort((a, b) =>
    a.dayKey.localeCompare(b.dayKey),
  );

  const hourlyRevenue = [...byHour.values()].sort((a, b) => a.hour - b.hour);

  const topPickups = [...byPickup.values()]
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, topPickupsLimit);

  return {
    totalTrips,
    totalRevenue,
    revenueWithoutVat,
    vatTotal,
    averageTripValue: totalTrips > 0 ? totalRevenue / totalTrips : 0,
    paymentSplit,
    dailyRevenue,
    hourlyRevenue,
    topPickups,
  };
}
