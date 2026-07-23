import { describe, it, expect } from "vitest";
import {
  calculateWorkRecommendations,
  circularHourDistance,
  itemConfidence,
  MIN_TRIPS_FOR_RECOMMENDATIONS,
} from "./calculateWorkRecommendations";
import {
  scopeRecommendationTrips,
  type RecommendationTripScope,
} from "./recommendationScope";
import type { BoltTrip } from "@/lib/types/bolt";
import { getMonthKey, parseBoltDate } from "@/lib/utils/dates";

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

/**
 * Wrap trips into a scope as if every trip came from a completed month
 * (engine-focused tests; the scoping itself is tested in
 * recommendationScope.test.ts).
 */
function scopeOf(
  trips: BoltTrip[],
  overrides: Partial<RecommendationTripScope> = {},
): RecommendationTripScope {
  const perMonth: Record<string, number> = {};
  for (const t of trips) {
    const key = getMonthKey(new Date(t.tripDate));
    perMonth[key] = (perMonth[key] ?? 0) + 1;
  }
  return {
    trips,
    completedMonthKeys: Object.keys(perMonth).sort((a, b) => a.localeCompare(b)),
    tripsPerCompletedMonth: perMonth,
    completedTripCount: trips.length,
    currentMonthTripCount: 0,
    includesCurrentMonth: false,
    ...overrides,
  };
}

/*
 * June 2026 calendar used throughout:
 *   Mon 1, Tue 2, Wed 3 … Sun 7   → ISO W23
 *   Mon 8 … Sun 14                → ISO W24
 *   Mon 15 … Sun 21               → ISO W25
 *   Mon 22 … Sun 28               → ISO W26
 * Fridays: 5, 12, 19, 26. Tuesdays: 2, 9, 16, 23.
 */

describe("itemConfidence", () => {
  it("is scazuta for anything not reliable", () => {
    expect(itemConfidence(false, 100, 100)).toBe("scazuta");
  });

  it("is medie for reliable items below the high thresholds", () => {
    expect(itemConfidence(true, 3, 2)).toBe("medie");
    expect(itemConfidence(true, 5, 3)).toBe("medie"); // days below 6
    expect(itemConfidence(true, 6, 2)).toBe("medie"); // weeks below 3
  });

  it("is ridicata at ≥6 active days across ≥3 weeks", () => {
    expect(itemConfidence(true, 6, 3)).toBe("ridicata");
    expect(itemConfidence(true, 10, 5)).toBe("ridicata");
  });
});

describe("circularHourDistance", () => {
  it("treats midnight-adjacent hours as close", () => {
    expect(circularHourDistance(23, 0)).toBe(1);
    expect(circularHourDistance(0, 23)).toBe(1);
    expect(circularHourDistance(22, 1)).toBe(3);
  });

  it("matches plain distance away from midnight", () => {
    expect(circularHourDistance(10, 12)).toBe(2);
    expect(circularHourDistance(21, 0)).toBe(3);
    expect(circularHourDistance(5, 5)).toBe(0);
  });
});

describe("calculateWorkRecommendations — sufficiency gate", () => {
  it("flags insufficient data below the threshold", () => {
    const rec = calculateWorkRecommendations(
      scopeOf([trip("01.06.2026 10:00", 30), trip("02.06.2026 11:00", 40)]),
    );
    expect(rec.sufficient).toBe(false);
    expect(rec.totalTrips).toBe(2);
  });

  it("marks the dataset sufficient at the threshold", () => {
    const trips = Array.from({ length: MIN_TRIPS_FOR_RECOMMENDATIONS }, (_, i) => {
      const day = String((i % 28) + 1).padStart(2, "0");
      return trip(`${day}.06.2026 12:00`, 25);
    });
    const rec = calculateWorkRecommendations(scopeOf(trips));
    expect(rec.sufficient).toBe(true);
    expect(rec.totalTrips).toBe(MIN_TRIPS_FOR_RECOMMENDATIONS);
  });
});

describe("calculateWorkRecommendations — eligibility and outliers", () => {
  it("prefers a repeated modest weekday over one huge single date", () => {
    const trips = [
      // Marți: 3 distinct dates, 100 RON each → reliable.
      trip("02.06.2026 10:00", 100),
      trip("09.06.2026 10:00", 100),
      trip("16.06.2026 10:00", 100),
      // Vineri: one date with 500 RON → more total revenue, but not repeated.
      trip("05.06.2026 18:00", 500),
    ];
    const rec = calculateWorkRecommendations(scopeOf(trips));
    expect(rec.bestWeekday?.label).toBe("Marți");
    expect(rec.bestWeekday?.reliable).toBe(true);
    expect(rec.bestWeekday?.averageRevenuePerActiveDay).toBeCloseTo(100);
    // The lucky Friday stays visible in the table, marked unreliable.
    const friday = rec.weekdays.find((w) => w.label === "Vineri");
    expect(friday?.reliable).toBe(false);
    expect(friday?.confidence).toBe("scazuta");
  });

  it("excludes a single 500 RON trip from bestHours and bestWindows", () => {
    const rec = calculateWorkRecommendations(
      scopeOf([trip("05.06.2026 18:00", 500)]),
    );
    expect(rec.bestHours).toHaveLength(0);
    expect(rec.bestWindows).toHaveLength(0);
    expect(rec.bestWeekday).toBeNull();
  });

  it("rejects hours seen on 3 days within a single ISO week", () => {
    // Mon/Wed/Fri of the SAME week (W23), all at 10:00.
    const trips = [
      trip("01.06.2026 10:00", 50),
      trip("03.06.2026 10:00", 50),
      trip("05.06.2026 10:00", 50),
    ];
    const rec = calculateWorkRecommendations(scopeOf(trips));
    expect(rec.bestHours).toHaveLength(0);
  });

  it("accepts hours seen on 3 days across 2 ISO weeks, at medie confidence", () => {
    // W23, W23, W24 — same 10:00 hour.
    const trips = [
      trip("01.06.2026 10:00", 50),
      trip("03.06.2026 10:00", 50),
      trip("09.06.2026 10:00", 50),
    ];
    const rec = calculateWorkRecommendations(scopeOf(trips));
    expect(rec.bestHours).toHaveLength(1);
    expect(rec.bestHours[0].hour).toBe(10);
    expect(rec.bestHours[0].activeDays).toBe(3);
    expect(rec.bestHours[0].distinctWeeks).toBe(2);
    expect(rec.bestHours[0].confidence).toBe("medie");
    expect(rec.bestHours[0].reliable).toBe(true);
  });

  it("reaches ridicata at 6 active days across 3 weeks", () => {
    // W23×2, W24×2, W25×2 — same 10:00 hour.
    const trips = [
      trip("01.06.2026 10:00", 50),
      trip("03.06.2026 10:00", 50),
      trip("08.06.2026 10:00", 50),
      trip("10.06.2026 10:00", 50),
      trip("15.06.2026 10:00", 50),
      trip("17.06.2026 10:00", 50),
    ];
    const rec = calculateWorkRecommendations(scopeOf(trips));
    expect(rec.bestHours[0]?.confidence).toBe("ridicata");
  });

  it("normalizes scores against eligible candidates only", () => {
    // Two eligible hours; hour 10 is better on every component.
    const eligible = [
      trip("01.06.2026 10:00", 60),
      trip("03.06.2026 10:00", 60),
      trip("09.06.2026 10:00", 60),
      trip("01.06.2026 14:00", 40),
      trip("03.06.2026 14:00", 40),
      trip("09.06.2026 14:00", 40),
    ];
    const withoutOutlier = calculateWorkRecommendations(scopeOf(eligible));
    // One 500 RON outlier at 18:00 (single date → ineligible).
    const withOutlier = calculateWorkRecommendations(
      scopeOf([...eligible, trip("05.06.2026 18:00", 500)]),
    );

    const scores = (r: typeof withoutOutlier) =>
      r.bestHours.map((h) => [h.hour, h.score]);
    // The ineligible outlier must not appear and must not distort the maxima.
    expect(withOutlier.bestHours.some((h) => h.hour === 18)).toBe(false);
    expect(scores(withOutlier)).toEqual(scores(withoutOutlier));
    // The best eligible hour scores 100 (it defines every maximum).
    expect(withoutOutlier.bestHours[0].hour).toBe(10);
    expect(withoutOutlier.bestHours[0].score).toBe(100);
  });

  it("emits finite scores even with zero-revenue trips", () => {
    const trips = [
      trip("01.06.2026 10:00", 0),
      trip("03.06.2026 10:00", 0),
      trip("09.06.2026 10:00", 0),
    ];
    const rec = calculateWorkRecommendations(scopeOf(trips));
    expect(rec.bestHours).toHaveLength(1);
    expect(Number.isFinite(rec.bestHours[0].score)).toBe(true);
  });
});

describe("calculateWorkRecommendations — windows", () => {
  /** Fridays 5/12/19 June at the given hours — 3 dates across 3 weeks. */
  function fridayTrips(hours: number[], total = 100): BoltTrip[] {
    const days = ["05", "12", "19"];
    return days.flatMap((d) =>
      hours.map((h) =>
        trip(`${d}.06.2026 ${String(h).padStart(2, "0")}:00`, total),
      ),
    );
  }

  it("keeps Romanian labels and renders the late-night window end as 00:00", () => {
    const rec = calculateWorkRecommendations(scopeOf(fridayTrips([23])));
    const labels = rec.bestWindows.map((w) => w.label);
    expect(labels).toContain("Vineri 21:00–00:00");
  });

  it("de-duplicates overlapping windows on the same weekday", () => {
    // Trips at 17,18,19 make windows 15..19 eligible — heavily overlapping.
    const rec = calculateWorkRecommendations(scopeOf(fridayTrips([17, 18, 19])));
    expect(rec.bestWindows.length).toBeGreaterThan(0);
    for (let i = 0; i < rec.bestWindows.length; i++) {
      for (let j = i + 1; j < rec.bestWindows.length; j++) {
        const a = rec.bestWindows[i];
        const b = rec.bestWindows[j];
        const overlapping =
          a.weekday === b.weekday &&
          circularHourDistance(a.startHour, b.startHour) <= 2;
        expect(overlapping).toBe(false);
      }
    }
  });

  it("keeps windows on different weekdays even at the same hour", () => {
    const tuesdays = ["02", "09", "16"].map((d) =>
      trip(`${d}.06.2026 18:00`, 90),
    );
    const rec = calculateWorkRecommendations(
      scopeOf([...fridayTrips([18]), ...tuesdays]),
    );
    const weekdaysInBest = new Set(rec.bestWindows.map((w) => w.weekday));
    expect(weekdaysInBest.has(5)).toBe(true); // Vineri
    expect(weekdaysInBest.has(2)).toBe(true); // Marți
  });

  it("never flags single-occurrence windows as weak", () => {
    const rec = calculateWorkRecommendations(
      scopeOf([trip("05.06.2026 18:00", 100)]),
    );
    expect(rec.weakWindows).toHaveLength(0);
  });
});

describe("calculateWorkRecommendations — pickups", () => {
  it("rejects single-trip addresses from every pickup card", () => {
    // "Aeroport" has the single highest-revenue trip — but only one trip.
    const trips = [
      trip("05.06.2026 18:00", 500, "Aeroport"),
      trip("01.06.2026 10:00", 40, "Centru"),
      trip("03.06.2026 10:00", 40, "Centru"),
      trip("09.06.2026 10:00", 40, "Centru"),
    ];
    const rec = calculateWorkRecommendations(scopeOf(trips));
    expect(rec.mostCommonPickup?.address).toBe("Centru");
    expect(rec.topRevenuePickup?.address).toBe("Centru");
    expect(rec.highValuePickups.map((p) => p.address)).toEqual(["Centru"]);
  });

  it("rejects 3 trips that all happened on a single date", () => {
    const trips = [
      trip("05.06.2026 10:00", 40, "GaraDes"),
      trip("05.06.2026 12:00", 40, "GaraDes"),
      trip("05.06.2026 14:00", 40, "GaraDes"),
    ];
    const rec = calculateWorkRecommendations(scopeOf(trips));
    expect(rec.mostCommonPickup).toBeNull();
    expect(rec.topRevenuePickup).toBeNull();
    expect(rec.highValuePickups).toHaveLength(0);
  });

  it("accepts 3 trips across 2 distinct dates and reports activeDays", () => {
    const trips = [
      trip("05.06.2026 10:00", 40, "Centru"),
      trip("05.06.2026 12:00", 40, "Centru"),
      trip("12.06.2026 10:00", 40, "Centru"),
    ];
    const rec = calculateWorkRecommendations(scopeOf(trips));
    expect(rec.mostCommonPickup?.address).toBe("Centru");
    expect(rec.mostCommonPickup?.activeDays).toBe(2);
  });
});

describe("calculateWorkRecommendations — honest empty state", () => {
  it("reports no reliable patterns when 50+ trips never repeated across dates", () => {
    // 50 trips, all on one single date: sufficient, but nothing repeated.
    const trips = Array.from({ length: 50 }, (_, i) =>
      trip(`05.06.2026 ${String(8 + (i % 12)).padStart(2, "0")}:00`, 30),
    );
    const rec = calculateWorkRecommendations(scopeOf(trips));
    expect(rec.sufficient).toBe(true);
    expect(rec.hasReliablePatterns).toBe(false);
    expect(rec.bestWeekday).toBeNull();
    expect(rec.bestHours).toHaveLength(0);
    expect(rec.bestWindows).toHaveLength(0);
    expect(rec.overallConfidence).toBe("scazuta");
    // The unreliable weekday stays in the informational table.
    expect(rec.weekdays).toHaveLength(1);
    expect(rec.weekdays[0].reliable).toBe(false);
  });
});

describe("calculateWorkRecommendations — overall confidence & learning", () => {
  const NOW = new Date(2026, 6, 15, 12, 0); // mid-July 2026

  /**
   * A month with `count` trips spread over days 1–10 (≥2 ISO weeks) and hours
   * 8–13, so it produces reliable patterns; with count ≥ 50 it also qualifies
   * as an evidence month.
   */
  function month(mm: string, count: number): BoltTrip[] {
    return Array.from({ length: count }, (_, i) => {
      const day = String((i % 10) + 1).padStart(2, "0");
      const hour = String(8 + (Math.floor(i / 10) % 6)).padStart(2, "0");
      return trip(`${day}.${mm}.2026 ${hour}:00`, 50);
    });
  }

  it("gives medie with 1–2 evidence months of eligible patterns", () => {
    const one = calculateWorkRecommendations(
      scopeRecommendationTrips(month("06", 60), false, NOW),
    );
    expect(one.learning.completedMonthCount).toBe(1);
    expect(one.learning.evidenceMonthCount).toBe(1);
    expect(one.overallConfidence).toBe("medie");

    const two = calculateWorkRecommendations(
      scopeRecommendationTrips([...month("05", 60), ...month("06", 60)], false, NOW),
    );
    expect(two.learning.evidenceMonthCount).toBe(2);
    expect(two.overallConfidence).toBe("medie");
  });

  it("gives ridicata with 3 completed months of ≥50 trips each", () => {
    const rec = calculateWorkRecommendations(
      scopeRecommendationTrips(
        [...month("04", 55), ...month("05", 60), ...month("06", 70)],
        false,
        NOW,
      ),
    );
    expect(rec.learning.completedMonthCount).toBe(3);
    expect(rec.learning.evidenceMonthCount).toBe(3);
    expect(rec.overallConfidence).toBe("ridicata");
  });

  it("keeps medie for the real April–June shape (6 / 485 / 426 trips)", () => {
    const rec = calculateWorkRecommendations(
      scopeRecommendationTrips(
        [...month("04", 6), ...month("05", 485), ...month("06", 426)],
        false,
        NOW,
      ),
    );
    // April shows in the learning period but is not evidence.
    expect(rec.learning.completedMonthCount).toBe(3);
    expect(rec.learning.evidenceMonthCount).toBe(2);
    expect(rec.hasReliablePatterns).toBe(true);
    expect(rec.overallConfidence).toBe("medie");
  });

  it("gives scazuta when only current-month data exists, even via opt-in", () => {
    const rec = calculateWorkRecommendations(
      scopeRecommendationTrips(month("07", 60), true, NOW),
    );
    expect(rec.learning.completedMonthCount).toBe(0);
    expect(rec.learning.evidenceMonthCount).toBe(0);
    expect(rec.overallConfidence).toBe("scazuta");
  });

  it("never counts the opted-in current month as an evidence month", () => {
    const rec = calculateWorkRecommendations(
      scopeRecommendationTrips(
        // Two evidence months + a full-volume current month, opted in.
        [...month("05", 60), ...month("06", 60), ...month("07", 60)],
        true,
        NOW,
      ),
    );
    expect(rec.learning.completedMonthCount).toBe(2);
    expect(rec.learning.evidenceMonthCount).toBe(2);
    expect(rec.learning.includesCurrentMonth).toBe(true);
    expect(rec.learning.currentMonthTripCount).toBe(60);
    expect(rec.overallConfidence).toBe("medie"); // not ridicata
  });

  it("keeps scazuta when no pattern is reliable, despite evidence months", () => {
    // 60 trips but all on ONE date → evidence month, yet nothing repeated.
    const oneDay = Array.from({ length: 60 }, (_, i) =>
      trip(`05.06.2026 ${String(8 + (i % 12)).padStart(2, "0")}:00`, 30),
    );
    const rec = calculateWorkRecommendations(
      scopeRecommendationTrips(oneDay, false, NOW),
    );
    expect(rec.learning.evidenceMonthCount).toBe(1);
    expect(rec.hasReliablePatterns).toBe(false);
    expect(rec.overallConfidence).toBe("scazuta");
  });

  it("exposes the learning period metadata", () => {
    const rec = calculateWorkRecommendations(
      scopeRecommendationTrips([...month("04", 6), ...month("06", 60)], false, NOW),
    );
    expect(rec.learning.firstMonthKey).toBe("2026-04");
    expect(rec.learning.lastMonthKey).toBe("2026-06");
    expect(rec.learning.completedTripCount).toBe(66);
  });
});

describe("calculateWorkRecommendations — determinism", () => {
  it("produces identical output and ordering for identical input", () => {
    const trips = [
      trip("02.06.2026 10:00", 100),
      trip("09.06.2026 10:00", 100),
      trip("16.06.2026 10:00", 100),
      trip("05.06.2026 18:00", 80, "Centru"),
      trip("12.06.2026 18:00", 80, "Centru"),
      trip("19.06.2026 18:00", 80, "Centru"),
      trip("05.06.2026 23:00", 60),
      trip("12.06.2026 23:00", 60),
      trip("19.06.2026 23:00", 60),
    ];
    const a = calculateWorkRecommendations(scopeOf([...trips]));
    const b = calculateWorkRecommendations(scopeOf([...trips]));
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
