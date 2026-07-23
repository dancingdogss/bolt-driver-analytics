import { describe, it, expect } from "vitest";
import { scopeRecommendationTrips } from "./recommendationScope";
import type { BoltTrip } from "@/lib/types/bolt";
import { parseBoltDate } from "@/lib/utils/dates";

let seq = 0;
function trip(tripDate: string, total = 50): BoltTrip {
  seq += 1;
  return {
    invoiceNumber: `INV-${seq}`,
    invoiceDateRaw: tripDate,
    pickupAddress: "Gara",
    paymentMethod: "Bolt Payment",
    tripDate: parseBoltDate(tripDate)?.toISOString() ?? tripDate,
    valueWithoutVat: total * 0.84,
    vat: total * 0.16,
    totalValue: total,
  };
}

/** "Now" is mid-July 2026 → June 2026 and earlier are completed months. */
const NOW = new Date(2026, 6, 15, 12, 0);

describe("scopeRecommendationTrips", () => {
  it("keeps completed months and excludes the current month by default", () => {
    const scope = scopeRecommendationTrips(
      [trip("10.05.2026 10:00"), trip("10.06.2026 10:00"), trip("10.07.2026 10:00")],
      false,
      NOW,
    );
    expect(scope.trips).toHaveLength(2);
    expect(scope.completedMonthKeys).toEqual(["2026-05", "2026-06"]);
    expect(scope.tripsPerCompletedMonth).toEqual({ "2026-05": 1, "2026-06": 1 });
    expect(scope.completedTripCount).toBe(2);
    expect(scope.currentMonthTripCount).toBe(1);
    expect(scope.includesCurrentMonth).toBe(false);
  });

  it("includes the last day of the previous month", () => {
    const scope = scopeRecommendationTrips(
      [trip("30.06.2026 23:59")],
      false,
      NOW,
    );
    expect(scope.trips).toHaveLength(1);
    expect(scope.completedMonthKeys).toEqual(["2026-06"]);
  });

  it("excludes the first day of the current month by default", () => {
    const scope = scopeRecommendationTrips(
      [trip("01.07.2026 00:00")],
      false,
      NOW,
    );
    expect(scope.trips).toHaveLength(0);
    expect(scope.currentMonthTripCount).toBe(1);
  });

  it("adds current-month trips only when opted in", () => {
    const trips = [trip("10.06.2026 10:00"), trip("05.07.2026 10:00")];
    const scope = scopeRecommendationTrips(trips, true, NOW);
    expect(scope.trips).toHaveLength(2);
    expect(scope.includesCurrentMonth).toBe(true);
    // The current month never counts as a completed month.
    expect(scope.completedMonthKeys).toEqual(["2026-06"]);
    expect(scope.completedTripCount).toBe(1);
    expect(scope.currentMonthTripCount).toBe(1);
  });

  it("always drops future-dated trips, even with the opt-in", () => {
    const trips = [trip("10.08.2026 10:00"), trip("01.01.2027 10:00")];
    expect(scopeRecommendationTrips(trips, false, NOW).trips).toHaveLength(0);
    expect(scopeRecommendationTrips(trips, true, NOW).trips).toHaveLength(0);
  });

  it("always drops trips with an invalid date", () => {
    const broken = { ...trip("10.06.2026 10:00"), tripDate: "not-a-date" };
    const scope = scopeRecommendationTrips([broken], true, NOW);
    expect(scope.trips).toHaveLength(0);
    expect(scope.completedMonthKeys).toEqual([]);
    expect(scope.currentMonthTripCount).toBe(0);
  });

  it("reports includesCurrentMonth=false when opted in but the current month is empty", () => {
    const scope = scopeRecommendationTrips([trip("10.06.2026 10:00")], true, NOW);
    expect(scope.includesCurrentMonth).toBe(false);
    expect(scope.trips).toHaveLength(1);
  });

  it("counts only completed months that actually contain valid trips", () => {
    // Two trips in one completed month → one completed month key.
    const scope = scopeRecommendationTrips(
      [trip("01.06.2026 10:00"), trip("20.06.2026 10:00")],
      false,
      NOW,
    );
    expect(scope.completedMonthKeys).toEqual(["2026-06"]);
  });
});
