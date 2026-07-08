import { describe, it, expect } from "vitest";
import {
  calculateWorkRecommendations,
  generalConfidence,
  windowConfidence,
  MIN_TRIPS_FOR_RECOMMENDATIONS,
} from "./calculateWorkRecommendations";
import type { BoltTrip } from "@/lib/types/bolt";
import { parseBoltDate } from "@/lib/utils/dates";

let seq = 0;
function trip(
  tripDate: string,
  total: number,
  address = "Gara",
  method = "Bolt Payment",
): BoltTrip {
  seq += 1;
  return {
    invoiceNumber: `INV-${seq}`,
    invoiceDateRaw: tripDate,
    pickupAddress: address,
    paymentMethod: method,
    tripDate: parseBoltDate(tripDate)!.toISOString(),
    valueWithoutVat: total * 0.84,
    vat: total * 0.16,
    totalValue: total,
  };
}

describe("confidence helpers", () => {
  it("maps general trip counts to confidence bands", () => {
    expect(generalConfidence(0)).toBe("scazuta");
    expect(generalConfidence(9)).toBe("scazuta");
    expect(generalConfidence(10)).toBe("medie");
    expect(generalConfidence(30)).toBe("medie");
    expect(generalConfidence(31)).toBe("ridicata");
  });

  it("maps window trip counts to (lower) confidence bands", () => {
    expect(windowConfidence(4)).toBe("scazuta");
    expect(windowConfidence(5)).toBe("medie");
    expect(windowConfidence(15)).toBe("medie");
    expect(windowConfidence(16)).toBe("ridicata");
  });
});

describe("calculateWorkRecommendations", () => {
  it("flags insufficient data below the threshold", () => {
    const trips = [trip("01.06.2026 10:00", 30), trip("02.06.2026 11:00", 40)];
    const rec = calculateWorkRecommendations(trips);
    expect(rec.sufficient).toBe(false);
    expect(rec.totalTrips).toBe(2);
  });

  it("marks the dataset sufficient at the threshold", () => {
    // 01.06.2026 is a Monday; spread trips across distinct days.
    const trips = Array.from({ length: MIN_TRIPS_FOR_RECOMMENDATIONS }, (_, i) => {
      const day = String((i % 28) + 1).padStart(2, "0");
      return trip(`${day}.06.2026 12:00`, 25);
    });
    const rec = calculateWorkRecommendations(trips);
    expect(rec.sufficient).toBe(true);
    expect(rec.totalTrips).toBe(MIN_TRIPS_FOR_RECOMMENDATIONS);
  });

  it("finds the best weekday by revenue and labels it in Romanian", () => {
    // 05.06.2026 = Friday (Vineri) with high revenue; 01.06 = Monday (Luni) low.
    const trips = [
      trip("01.06.2026 10:00", 20), // Luni
      trip("05.06.2026 18:00", 200), // Vineri
      trip("05.06.2026 19:00", 180), // Vineri
    ];
    const rec = calculateWorkRecommendations(trips);
    expect(rec.bestWeekday?.label).toBe("Vineri");
    expect(rec.bestWeekday?.revenue).toBeCloseTo(380);
    expect(rec.weakestActiveWeekday?.label).toBe("Luni");
  });

  it("builds 3-hour windows spanning the trip hour with Romanian labels", () => {
    // Friday 18:00 trip belongs to windows starting 16,17,18.
    const trips = [trip("05.06.2026 18:00", 100)];
    const rec = calculateWorkRecommendations(trips);
    const labels = rec.bestWindows.map((w) => w.label);
    expect(labels).toContain("Vineri 18:00–21:00");
    expect(labels).toContain("Vineri 16:00–19:00");
    // A single trip must never reach a reliable confidence.
    expect(rec.bestWindows.every((w) => w.confidence === "scazuta")).toBe(true);
  });

  it("renders the late-night window end as 00:00", () => {
    const trips = [trip("05.06.2026 23:00", 100)]; // Friday 23:00 → start 21
    const rec = calculateWorkRecommendations(trips);
    const labels = rec.bestWindows.map((w) => w.label);
    expect(labels).toContain("Vineri 21:00–00:00");
  });

  it("only surfaces high-value pickups with at least 3 trips", () => {
    const trips = [
      trip("05.06.2026 18:00", 500, "AeroportRar"), // 1 trip, very high avg
      trip("01.06.2026 10:00", 40, "GaraDes"),
      trip("02.06.2026 10:00", 42, "GaraDes"),
      trip("03.06.2026 10:00", 41, "GaraDes"), // 3 trips → qualifies
    ];
    const rec = calculateWorkRecommendations(trips);
    const addresses = rec.highValuePickups.map((p) => p.address);
    expect(addresses).toContain("GaraDes");
    expect(addresses).not.toContain("AeroportRar");
  });

  it("does not flag single-trip windows as weak", () => {
    const trips = [trip("05.06.2026 18:00", 100)];
    const rec = calculateWorkRecommendations(trips);
    expect(rec.weakWindows).toHaveLength(0);
  });
});
