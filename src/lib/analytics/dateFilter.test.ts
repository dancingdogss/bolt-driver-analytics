import { describe, it, expect } from "vitest";
import {
  filterTrips,
  getAvailableMonths,
  getMonthlyRevenue,
  type DateRangeFilter,
} from "./dateFilter";
import type { BoltTrip } from "@/lib/types/bolt";
import { parseBoltDate } from "@/lib/utils/dates";

/** Build a minimal trip whose real trip date is the given `dd.MM.yyyy HH:mm`. */
function trip(invoice: string, tripDate: string, total: number): BoltTrip {
  return {
    invoiceNumber: invoice,
    invoiceDateRaw: tripDate,
    pickupAddress: "X",
    paymentMethod: "Bolt Payment",
    tripDate: parseBoltDate(tripDate)!.toISOString(),
    valueWithoutVat: total * 0.84,
    vat: total * 0.16,
    totalValue: total,
  };
}

const TRIPS: BoltTrip[] = [
  trip("A", "30.04.2026 12:00", 10),
  trip("B", "31.05.2026 08:00", 20),
  // June boundary cases:
  trip("C", "01.06.2026 00:00", 30), // first instant of June -> in June
  trip("D", "30.06.2026 23:59", 40), // last minute of June -> in June
  trip("E", "01.07.2026 00:00", 50), // first instant of July -> NOT June
];

describe("getAvailableMonths", () => {
  it("lists distinct trip months ascending", () => {
    expect(getAvailableMonths(TRIPS).map((m) => m.key)).toEqual([
      "2026-04",
      "2026-05",
      "2026-06",
      "2026-07",
    ]);
  });
});

describe("getMonthlyRevenue", () => {
  it("groups trips and revenue by month", () => {
    const rows = getMonthlyRevenue(TRIPS);
    const june = rows.find((r) => r.key === "2026-06")!;
    expect(june.trips).toBe(2); // C + D
    expect(june.revenue).toBeCloseTo(70);
  });
});

describe("filterTrips (month)", () => {
  const june: DateRangeFilter = { mode: "month", monthKey: "2026-06" };

  it("includes the whole month and excludes adjacent boundaries", () => {
    const invoices = filterTrips(TRIPS, june).map((t) => t.invoiceNumber);
    expect(invoices).toContain("C"); // 01.06 00:00 in
    expect(invoices).toContain("D"); // 30.06 23:59 in
    expect(invoices).not.toContain("B"); // 31.05 out
    expect(invoices).not.toContain("E"); // 01.07 out
    expect(invoices).toHaveLength(2);
  });
});

describe("filterTrips (all / custom)", () => {
  it("returns everything for 'all'", () => {
    expect(filterTrips(TRIPS, { mode: "all" })).toHaveLength(TRIPS.length);
  });

  it("includes the whole 'to' day in a custom range", () => {
    const filter: DateRangeFilter = {
      mode: "custom",
      from: "2026-06-01",
      to: "2026-06-30",
    };
    const invoices = filterTrips(TRIPS, filter).map((t) => t.invoiceNumber);
    expect(invoices.sort()).toEqual(["C", "D"]);
  });
});
