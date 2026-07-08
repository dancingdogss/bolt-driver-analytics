import { describe, it, expect } from "vitest";
import { calculateDriverInsights } from "./calculateDriverInsights";
import { calculateBoltMetrics } from "./calculateBoltMetrics";
import type { BoltTrip } from "@/lib/types/bolt";
import { parseBoltDate } from "@/lib/utils/dates";

function trip(
  invoice: string,
  tripDate: string,
  total: number,
  method: string,
  address: string,
): BoltTrip {
  return {
    invoiceNumber: invoice,
    invoiceDateRaw: tripDate,
    pickupAddress: address,
    paymentMethod: method,
    tripDate: parseBoltDate(tripDate)!.toISOString(),
    valueWithoutVat: total * 0.84,
    vat: total * 0.16,
    totalValue: total,
  };
}

const TRIPS: BoltTrip[] = [
  trip("A", "01.06.2026 13:00", 100, "Numerar", "Gara"),
  trip("B", "01.06.2026 13:30", 80, "Bolt Payment", "Gara"),
  trip("C", "02.06.2026 09:00", 20, "Business", "Aeroport"),
  trip("D", "03.06.2026 22:00", 50, "Bolt Payment", "Centru"),
];
// Totals: 250 revenue, 4 trips, 3 active days.

describe("calculateDriverInsights", () => {
  const metrics = calculateBoltMetrics(TRIPS);
  // selectedDays = 30 (e.g. a full month), estimated profit = 300.
  const insights = calculateDriverInsights(TRIPS, metrics, 30, 300);

  it("finds best/worst day and best/worst active hour", () => {
    expect(insights.bestDay?.label).toBe("01 Iun 2026");
    expect(insights.bestDay?.revenue).toBeCloseTo(180);
    expect(insights.bestDay?.trips).toBe(2);
    expect(insights.worstDay?.label).toBe("02 Iun 2026");
    expect(insights.worstDay?.revenue).toBeCloseTo(20);

    expect(insights.bestHour?.label).toBe("13:00");
    expect(insights.bestHour?.revenue).toBeCloseTo(180);
    expect(insights.worstActiveHour?.label).toBe("09:00");
    expect(insights.worstActiveHour?.revenue).toBeCloseTo(20);
  });

  it("ranks pickups by trips and by revenue", () => {
    expect(insights.mostCommonPickup?.address).toBe("Gara");
    expect(insights.mostCommonPickup?.trips).toBe(2);
    expect(insights.topRevenuePickup?.address).toBe("Gara");
    expect(insights.topRevenuePickup?.revenue).toBeCloseTo(180);
  });

  it("computes payment revenue and percentages", () => {
    expect(insights.payments.boltPaymentRevenue).toBeCloseTo(130);
    expect(insights.payments.cashRevenue).toBeCloseTo(100);
    expect(insights.payments.businessRevenue).toBeCloseTo(20);
    expect(insights.payments.cashPercent).toBeCloseTo(40); // 100 / 250
    expect(insights.payments.cardPlatformPercent).toBeCloseTo(60); // 150 / 250
  });

  it("uses active days for averages and calendar days for profit", () => {
    // 3 active days, 250 revenue, 4 trips.
    expect(insights.averages.activeDays).toBe(3);
    expect(insights.averages.selectedDays).toBe(30);
    expect(insights.averages.averageRevenuePerActiveDay).toBeCloseTo(250 / 3);
    expect(insights.averages.averageTripsPerActiveDay).toBeCloseTo(4 / 3);
    expect(insights.averages.estimatedProfitPerDay).toBeCloseTo(10); // 300 / 30
    expect(insights.averages.estimatedProfitPerWeek).toBeCloseTo(70); // 10 * 7
  });
});
