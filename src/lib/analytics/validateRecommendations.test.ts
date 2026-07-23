import { describe, it, expect } from "vitest";
import {
  splitTrainingHoldout,
  validateWorkRecommendations,
} from "./validateRecommendations";
import {
  analyzeWindows,
  calculateWorkRecommendations,
} from "./calculateWorkRecommendations";
import { scopeRecommendationTrips } from "./recommendationScope";
import type { BoltTrip } from "@/lib/types/bolt";
import { parseBoltDate } from "@/lib/utils/dates";

let seq = 0;
function trip(tripDate: string, total: number, address = "Gara"): BoltTrip {
  seq += 1;
  return {
    invoiceNumber: `INV-${seq}`,
    invoiceDateRaw: tripDate,
    pickupAddress: address,
    paymentMethod: "Bolt Payment",
    tripDate: parseBoltDate(tripDate)!.toISOString(),
    valueWithoutVat: total * 0.84,
    vat: total * 0.16,
    totalValue: total,
  };
}

const pad = (n: number) => String(n).padStart(2, "0");

/** First `count` calendar dates (1–28) of month `mm` that fall on `weekday`. */
function weekdayDates(mm: number, weekday: number, count = 4): string[] {
  const res: string[] = [];
  for (let d = 1; d <= 28 && res.length < count; d++) {
    if (new Date(2026, mm - 1, d).getDay() === weekday) res.push(pad(d));
  }
  return res;
}

/** Dense, low-revenue filler: 2 trips/day on days 1–28 → 56 trips, every
 *  weekday reliable, ≥40 eligible windows. Uniform, so peaks decide winners. */
function fillerMonth(mm: number, total = 10): BoltTrip[] {
  const out: BoltTrip[] = [];
  for (let d = 1; d <= 28; d++) {
    out.push(trip(`${pad(d)}.${pad(mm)}.2026 08:00`, total));
    out.push(trip(`${pad(d)}.${pad(mm)}.2026 14:00`, total));
  }
  return out;
}

/** A high-revenue peak on the first `nDates` occurrences of `weekday` at `hour`. */
function peak(
  mm: number,
  weekday: number,
  hour: number,
  total: number,
  nDates = 3,
): BoltTrip[] {
  return weekdayDates(mm, weekday, nDates).map((d) =>
    trip(`${d}.${pad(mm)}.2026 ${pad(hour)}:00`, total),
  );
}

/** Training month: filler + a clear Friday-18:00 peak → best weekday = Vineri. */
function trainMonth(mm: number): BoltTrip[] {
  return [...fillerMonth(mm), ...peak(mm, 5, 18, 300)];
}

/**
 * A month where each listed weekday has an exact revenue-per-active-day.
 * `revByWeekday[wd]` = rev/active-day; achieved with `tripsPerDate` trips on the
 * first `dates` occurrences of that weekday (all at 10:00).
 */
function weekdayMonth(
  mm: number,
  revByWeekday: Record<number, number>,
  { dates = 4, tripsPerDate = 2 }: { dates?: number; tripsPerDate?: number } = {},
): BoltTrip[] {
  const out: BoltTrip[] = [];
  for (const [wdStr, rev] of Object.entries(revByWeekday)) {
    const weekday = Number(wdStr);
    const perTrip = rev / tripsPerDate;
    for (const d of weekdayDates(mm, weekday, dates)) {
      for (let i = 0; i < tripsPerDate; i++) {
        out.push(trip(`${d}.${pad(mm)}.2026 10:00`, perTrip));
      }
    }
  }
  return out;
}

/**
 * A month where each listed weekday has trips at a single `hour` (default 18),
 * producing sliding windows at hour-2 … hour. `revByWeekday[wd]` = rev/active-day.
 */
function windowMonth(
  mm: number,
  revByWeekday: Record<number, number>,
  {
    hour = 18,
    dates = 4,
    tripsPerDate = 3,
  }: { hour?: number; dates?: number; tripsPerDate?: number } = {},
): BoltTrip[] {
  const out: BoltTrip[] = [];
  for (const [wdStr, rev] of Object.entries(revByWeekday)) {
    const weekday = Number(wdStr);
    const perTrip = rev / tripsPerDate;
    for (const d of weekdayDates(mm, weekday, dates)) {
      for (let i = 0; i < tripsPerDate; i++) {
        out.push(trip(`${d}.${pad(mm)}.2026 ${pad(hour)}:00`, perTrip));
      }
    }
  }
  return out;
}

const NOW_JULY = new Date(2026, 6, 15, 12, 0);
const invoiceSet = (trips: BoltTrip[]) => new Set(trips.map((t) => t.invoiceNumber));

/* ------------------------------------------------------------------ */
/* Chronological split                                                 */
/* ------------------------------------------------------------------ */

describe("splitTrainingHoldout", () => {
  it("selects the most recent completed ≥50-trip month as holdout", () => {
    const split = splitTrainingHoldout(
      [...trainMonth(5), ...fillerMonth(6)],
      NOW_JULY,
    );
    expect(split.holdoutMonthKey).toBe("2026-06");
    expect(split.trainingScope?.completedMonthKeys).toEqual(["2026-05"]);
  });

  it("does not pick a later sparse completed month, and excludes it entirely", () => {
    // May + June are full; July is a COMPLETED sparse month (now = August).
    const july = weekdayDates(7, 1).map((d) => trip(`${d}.07.2026 09:00`, 20));
    const all = [...trainMonth(5), ...fillerMonth(6), ...july];
    const split = splitTrainingHoldout(all, new Date(2026, 7, 15, 12, 0));

    expect(split.holdoutMonthKey).toBe("2026-06");
    expect(split.trainingScope?.completedMonthKeys).toEqual(["2026-05"]);

    const julySet = invoiceSet(july);
    const inTraining = split.trainingTrips.some((t) => julySet.has(t.invoiceNumber));
    const inHoldout = split.holdoutTrips.some((t) => julySet.has(t.invoiceNumber));
    expect(inTraining).toBe(false);
    expect(inHoldout).toBe(false);
  });

  it("excludes current, future and invalid-dated trips from both sides", () => {
    const current = trip("05.07.2026 10:00", 40); // current month (now = July)
    const future = trip("10.08.2026 10:00", 40); // future
    const invalid = { ...trip("10.06.2026 10:00", 40), tripDate: "not-a-date" };
    const all = [...trainMonth(5), ...fillerMonth(6), current, future, invalid];
    const split = splitTrainingHoldout(all, NOW_JULY);

    const banned = new Set([
      current.invoiceNumber,
      future.invoiceNumber,
      invalid.invoiceNumber,
    ]);
    const leaked = [...split.trainingTrips, ...split.holdoutTrips].some((t) =>
      banned.has(t.invoiceNumber),
    );
    expect(leaked).toBe(false);
  });

  it("assigns month-boundary timestamps to the correct side", () => {
    const mayEnd = trip("31.05.2026 23:59", 40); // training (May)
    const junStart = trip("01.06.2026 00:00", 40); // holdout (June)
    const junEnd = trip("30.06.2026 23:59", 40); // holdout (June)
    const julStart = trip("01.07.2026 00:00", 40); // current → excluded
    const all = [
      ...trainMonth(5),
      ...fillerMonth(6),
      mayEnd,
      junStart,
      junEnd,
      julStart,
    ];
    const split = splitTrainingHoldout(all, NOW_JULY);
    const train = invoiceSet(split.trainingTrips);
    const hold = invoiceSet(split.holdoutTrips);

    expect(train.has(mayEnd.invoiceNumber)).toBe(true);
    expect(hold.has(junStart.invoiceNumber)).toBe(true);
    expect(hold.has(junEnd.invoiceNumber)).toBe(true);
    expect(train.has(julStart.invoiceNumber)).toBe(false);
    expect(hold.has(julStart.invoiceNumber)).toBe(false);
  });

  it("never lets training and holdout share a trip, and training has nothing after holdout", () => {
    const all = [...trainMonth(5), ...trainMonth(6)];
    const split = splitTrainingHoldout(all, NOW_JULY);
    const train = invoiceSet(split.trainingTrips);
    const hold = invoiceSet(split.holdoutTrips);

    // Disjoint.
    for (const inv of train) expect(hold.has(inv)).toBe(false);
    // Training holds only months strictly before the holdout month.
    for (const t of split.trainingTrips) {
      expect(t.tripDate < "2026-06-01").toBe(true);
    }
  });
});

/* ------------------------------------------------------------------ */
/* Availability & strength                                             */
/* ------------------------------------------------------------------ */

describe("validateWorkRecommendations — availability", () => {
  it("no_holdout when no completed month has ≥50 trips", () => {
    const april = weekdayDates(4, 1).slice(0, 3).map((d) => trip(`${d}.04.2026 10:00`, 20));
    const may = weekdayDates(5, 1).slice(0, 3).map((d) => trip(`${d}.05.2026 10:00`, 20));
    const rec = validateWorkRecommendations([...april, ...may], NOW_JULY);
    expect(rec.available).toBe(false);
    expect(rec.unavailableReason).toBe("no_holdout");
  });

  it("training_insufficient when nothing precedes the holdout month", () => {
    const rec = validateWorkRecommendations([...fillerMonth(6)], NOW_JULY);
    expect(rec.available).toBe(false);
    expect(rec.unavailableReason).toBe("training_insufficient");
    expect(rec.holdoutMonthKey).toBe("2026-06");
  });

  it("no_reliable_patterns when training has volume but no repetition", () => {
    // 50 May trips all on ONE date → sufficient, but nothing repeats.
    const oneDay = Array.from({ length: 50 }, (_, i) =>
      trip(`15.05.2026 ${pad(8 + (i % 12))}:00`, 30),
    );
    const rec = validateWorkRecommendations([...oneDay, ...fillerMonth(6)], NOW_JULY);
    expect(rec.available).toBe(false);
    expect(rec.unavailableReason).toBe("no_reliable_patterns");
    expect(rec.trainingTripCount).toBe(50);
  });

  it("is available for a healthy May→June split and reports meta", () => {
    const rec = validateWorkRecommendations(
      [...trainMonth(5), ...trainMonth(6)],
      NOW_JULY,
    );
    expect(rec.available).toBe(true);
    expect(rec.unavailableReason).toBeNull();
    expect(rec.holdoutMonthKey).toBe("2026-06");
    expect(rec.trainingLastMonthKey).toBe("2026-05");
  });

  it("marks limited=true with a single evidence training month", () => {
    const rec = validateWorkRecommendations(
      [...trainMonth(5), ...trainMonth(6)],
      NOW_JULY,
    );
    expect(rec.trainingEvidenceMonthCount).toBe(1);
    expect(rec.limited).toBe(true);
  });

  it("marks limited=false with two evidence training months", () => {
    const rec = validateWorkRecommendations(
      [...trainMonth(4), ...trainMonth(5), ...trainMonth(6)],
      NOW_JULY,
    );
    expect(rec.trainingEvidenceMonthCount).toBe(2);
    expect(rec.limited).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/* Real April–June shape                                               */
/* ------------------------------------------------------------------ */

describe("validateWorkRecommendations — real April–June shape", () => {
  it("trains on April+May (only May is evidence), holds out June, excludes July", () => {
    const april = weekdayDates(4, 1, 3).map((d) => trip(`${d}.04.2026 09:00`, 20)); // 3 sparse
    const may = trainMonth(5); // 59 trips, evidence
    const june = trainMonth(6); // 59 trips, holdout
    const july = weekdayDates(7, 1, 2).map((d) => trip(`${d}.07.2026 09:00`, 20)); // current
    const rec = validateWorkRecommendations(
      [...april, ...may, ...june, ...july],
      NOW_JULY,
    );

    expect(rec.available).toBe(true);
    expect(rec.trainingFirstMonthKey).toBe("2026-04");
    expect(rec.trainingLastMonthKey).toBe("2026-05");
    expect(rec.trainingTripCount).toBe(april.length + may.length);
    expect(rec.trainingEvidenceMonthCount).toBe(1); // April's 3 don't count
    expect(rec.limited).toBe(true);
    expect(rec.holdoutMonthKey).toBe("2026-06");
    expect(rec.holdoutTripCount).toBe(june.length);
  });
});

/* ------------------------------------------------------------------ */
/* Current-month independence & determinism                            */
/* ------------------------------------------------------------------ */

describe("validateWorkRecommendations — independence & determinism", () => {
  it("is unaffected by current-month trips (the opt-in cannot leak in)", () => {
    const core = [...trainMonth(5), ...trainMonth(6)];
    const withCurrent = [...core, ...fillerMonth(7)]; // July = current
    const a = validateWorkRecommendations(core, NOW_JULY);
    const b = validateWorkRecommendations(withCurrent, NOW_JULY);
    expect(b).toEqual(a);
  });

  it("produces identical output for identical input", () => {
    const all = [...trainMonth(5), ...trainMonth(6)];
    const a = validateWorkRecommendations(all, NOW_JULY);
    const b = validateWorkRecommendations(all, NOW_JULY);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

/* ------------------------------------------------------------------ */
/* Weekday validation                                                  */
/* ------------------------------------------------------------------ */

describe("validateWorkRecommendations — weekday", () => {
  const training = trainMonth(5); // best weekday = Vineri (5)

  it("confirmat when the recommended weekday ranks in the holdout top half", () => {
    const june = weekdayMonth(6, {
      1: 100, 2: 110, 3: 120, 4: 130, 5: 300, 6: 90, 0: 80,
    });
    const rec = validateWorkRecommendations([...training, ...june], NOW_JULY);
    expect(rec.weekday?.weekday).toBe(5);
    expect(rec.weekday?.outcome).toBe("confirmat");
    expect(rec.weekday?.rank).toBe(1);
    expect(rec.weekday?.rankOf).toBe(7);
  });

  it("confirmat by the 90% tolerance just below the rank cutoff", () => {
    const june = weekdayMonth(6, {
      1: 300, 2: 290, 3: 280, 4: 270, 5: 260, 6: 200, 0: 100,
    });
    // n=7, topHalfLimit=3, cutoff (index 3) = 270; Vineri = 260 ≥ 243.
    const rec = validateWorkRecommendations([...training, ...june], NOW_JULY);
    expect(rec.weekday?.outcome).toBe("confirmat");
    expect(rec.weekday?.rank).toBe(5);
  });

  it("neconfirmat only when outside the top half AND below tolerance", () => {
    const june = weekdayMonth(6, {
      1: 300, 2: 290, 3: 280, 4: 270, 5: 200, 6: 180, 0: 100,
    });
    // cutoff = 270; Vineri = 200 < 243 → neconfirmat.
    const rec = validateWorkRecommendations([...training, ...june], NOW_JULY);
    expect(rec.weekday?.outcome).toBe("neconfirmat");
  });

  it("date_insuficiente when the recommended weekday has <3 holdout dates", () => {
    const june = weekdayMonth(6, { 1: 300, 2: 290, 3: 280, 4: 270, 6: 200, 0: 100 });
    const fridayThin = weekdayDates(6, 5, 2).map((d) => trip(`${d}.06.2026 10:00`, 200));
    const rec = validateWorkRecommendations(
      [...training, ...june, ...fridayThin],
      NOW_JULY,
    );
    expect(rec.weekday?.outcome).toBe("date_insuficiente");
    expect(rec.weekday?.holdoutActiveDates).toBe(2);
  });

  it("date_insuficiente when the holdout has <4 reliable weekdays", () => {
    // Only Mon/Wed/Fri present, each dense.
    const june = weekdayMonth(6, { 1: 200, 3: 200, 5: 200 }, { tripsPerDate: 5 });
    const rec = validateWorkRecommendations([...training, ...june], NOW_JULY);
    expect(rec.holdoutTripCount).toBeGreaterThanOrEqual(50);
    expect(rec.weekday?.outcome).toBe("date_insuficiente");
  });

  it("handles a zero cutoff with rank-only, never NaN/Infinity", () => {
    const june = weekdayMonth(6, { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 });
    const rec = validateWorkRecommendations([...training, ...june], NOW_JULY);
    expect(rec.weekday?.holdoutRevenuePerActiveDay).toBe(0);
    expect(Number.isFinite(rec.weekday?.rank ?? NaN)).toBe(true);
    expect(rec.weekday?.outcome).toBe("neconfirmat"); // Vineri sorts to index 5
  });
});

/* ------------------------------------------------------------------ */
/* Weekday top-half boundary (off-by-one guard)                        */
/* ------------------------------------------------------------------ */

describe("validateWorkRecommendations — weekday top-half boundary", () => {
  const training = trainMonth(5); // recommended weekday = Vineri (5)
  const dense = { tripsPerDate: 4 }; // 4 weekdays × 4 dates × 4 = 64 trips ≥ 50

  it("confirms by rank the LAST weekday still inside the top half (n=4, rank 2)", () => {
    // sorted: Mon 300, Vineri 250, Wed 200, Thu 100 → topHalfCount = 2.
    // Vineri at index 1 (rank 2) is the last inside → confirmed by rank.
    const june = weekdayMonth(6, { 1: 300, 5: 250, 3: 200, 4: 100 }, dense);
    const rec = validateWorkRecommendations([...training, ...june], NOW_JULY);
    expect(rec.weekday?.rankOf).toBe(4);
    expect(rec.weekday?.rank).toBe(2);
    expect(rec.weekday?.outcome).toBe("confirmat");
  });

  it("does NOT confirm by rank the FIRST weekday outside the top half (n=4, rank 3)", () => {
    // sorted: Mon 300, Tue 290, Vineri 200, Thu 180 → cutoff = reliable[1] = 290.
    // 0.9 × 290 = 261; Vineri 200 < 261 → neconfirmat (rank alone must not confirm).
    const june = weekdayMonth(6, { 1: 300, 2: 290, 5: 200, 4: 180 }, dense);
    const rec = validateWorkRecommendations([...training, ...june], NOW_JULY);
    expect(rec.weekday?.rank).toBe(3);
    expect(rec.weekday?.outcome).toBe("neconfirmat");
  });

  it("confirms the first outside rank ONLY through the 90% tolerance (n=4, rank 3)", () => {
    // sorted: Mon 300, Tue 290, Vineri 270, Thu 100 → cutoff = reliable[1] = 290.
    // 0.9 × 290 = 261; Vineri 270 ≥ 261 → confirmat via tolerance, not rank.
    const june = weekdayMonth(6, { 1: 300, 2: 290, 5: 270, 4: 100 }, dense);
    const rec = validateWorkRecommendations([...training, ...june], NOW_JULY);
    expect(rec.weekday?.rank).toBe(3);
    expect(rec.weekday?.outcome).toBe("confirmat");
  });

  it("keeps rank 3 outside the top half for n=5 (tolerance-only region)", () => {
    // n=5 → topHalfCount = 2; ranks 1 and 2 are top-half, rank 3 is outside.
    // sorted: Mon 300, Tue 290, Vineri 270, Thu 100, Wed 90 → cutoff = reliable[1] = 290.
    const june = weekdayMonth(
      6,
      { 1: 300, 2: 290, 5: 270, 4: 100, 3: 90 },
      dense,
    );
    const rec = validateWorkRecommendations([...training, ...june], NOW_JULY);
    expect(rec.weekday?.rankOf).toBe(5);
    expect(rec.weekday?.rank).toBe(3); // one-based display for index 2
    expect(rec.weekday?.outcome).toBe("confirmat"); // via tolerance only
  });
});

/* ------------------------------------------------------------------ */
/* Evidence-month count drives the limited wording                     */
/* ------------------------------------------------------------------ */

describe("validateWorkRecommendations — evidence-month count", () => {
  /** ~27 trips: a reliable Friday-18:00 peak plus low filler; each month < 50. */
  function sparseMonth(mm: number): BoltTrip[] {
    const out = [...peak(mm, 5, 18, 300, 3)];
    for (let d = 1; d <= 24; d++) out.push(trip(`${pad(d)}.${pad(mm)}.2026 09:00`, 20));
    return out;
  }

  it("is available with ZERO evidence months when volume is spread over sparse months", () => {
    // April 27 + May 27 = 54 training trips, but neither month reaches 50.
    const all = [...sparseMonth(4), ...sparseMonth(5), ...trainMonth(6)];
    const rec = validateWorkRecommendations(all, NOW_JULY);
    expect(rec.available).toBe(true);
    expect(rec.trainingTripCount).toBeGreaterThanOrEqual(50);
    expect(rec.trainingEvidenceMonthCount).toBe(0);
    expect(rec.limited).toBe(true);
  });

  it("keeps evidenceCount 1 when a sparse month follows the evidence month (no naming it)", () => {
    // April is the evidence month (≥50); May is sparse and is the LAST month.
    const all = [...trainMonth(4), ...sparseMonth(5), ...trainMonth(6)];
    const rec = validateWorkRecommendations(all, NOW_JULY);
    expect(rec.trainingEvidenceMonthCount).toBe(1);
    expect(rec.trainingLastMonthKey).toBe("2026-05"); // the SPARSE month
    expect(rec.limited).toBe(true);
  });

  it("reports one evidence month for the real April–May training shape", () => {
    const april = weekdayDates(4, 1, 3).map((d) => trip(`${d}.04.2026 09:00`, 20));
    const all = [...april, ...trainMonth(5), ...trainMonth(6)];
    const rec = validateWorkRecommendations(all, NOW_JULY);
    expect(rec.trainingEvidenceMonthCount).toBe(1);
    expect(rec.limited).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/* Window validation                                                   */
/* ------------------------------------------------------------------ */

describe("validateWorkRecommendations — windows", () => {
  const training = trainMonth(5); // best window ≈ Vineri (5) around 18:00

  function fridayWindow(rec: ReturnType<typeof validateWorkRecommendations>) {
    return rec.windows.find((w) => w.weekday === 5) ?? null;
  }

  it("confirmat when the recommended window overlaps the holdout top-5", () => {
    const june = [...fillerMonth(6), ...peak(6, 5, 18, 300)]; // strong Friday evening
    const rec = validateWorkRecommendations([...training, ...june], NOW_JULY);
    expect(rec.windowPoolSufficient).toBe(true);
    expect(fridayWindow(rec)?.outcome).toBe("confirmat");
  });

  it("confirmat by the 90% score tolerance without overlap", () => {
    // Six equal-strength weekdays at 18:00 → all score 100; top-5 keeps five,
    // Vineri (weekday 5) is edged out but ties the cutoff → tolerance confirmat.
    const june = windowMonth(6, { 0: 300, 1: 300, 2: 300, 3: 300, 4: 300, 5: 300 });
    const rec = validateWorkRecommendations([...training, ...june], NOW_JULY);
    expect(rec.windowPoolSufficient).toBe(true);
    expect(fridayWindow(rec)?.outcome).toBe("confirmat");
  });

  it("neconfirmat when eligible but materially below the cutoff", () => {
    // Five strong weekdays plus a much weaker Friday window.
    const june = windowMonth(6, { 0: 300, 1: 300, 2: 300, 3: 300, 4: 300, 5: 50 });
    const rec = validateWorkRecommendations([...training, ...june], NOW_JULY);
    expect(rec.windowPoolSufficient).toBe(true);
    expect(fridayWindow(rec)?.outcome).toBe("neconfirmat");
  });

  it("date_insuficiente (never neconfirmat) when the exact bucket is under-observed", () => {
    // Strong on 5 weekdays; Friday appears at 18:00 on only 2 dates.
    const strong = windowMonth(6, { 0: 300, 1: 300, 2: 300, 3: 300, 4: 300 });
    const fridayThin = weekdayDates(6, 5, 2).flatMap((d) => [
      trip(`${d}.06.2026 18:00`, 300),
      trip(`${d}.06.2026 18:00`, 300),
    ]);
    const rec = validateWorkRecommendations(
      [...training, ...strong, ...fridayThin],
      NOW_JULY,
    );
    expect(rec.windowPoolSufficient).toBe(true);
    const fw = fridayWindow(rec);
    expect(fw?.outcome).toBe("date_insuficiente");
    expect(fw?.outcome).not.toBe("neconfirmat");
  });

  it("marks the window category insufficient with fewer than 8 eligible windows", () => {
    // Two weekdays at one hour → 2×3 = 6 eligible windows (<8).
    const june = windowMonth(6, { 0: 200, 3: 200 }, { hour: 10, dates: 4, tripsPerDate: 7 });
    const rec = validateWorkRecommendations([...training, ...june], NOW_JULY);
    expect(rec.holdoutTripCount).toBeGreaterThanOrEqual(50);
    expect(rec.windowPoolSufficient).toBe(false);
    expect(rec.windows).toEqual([]);
  });
});

/* ------------------------------------------------------------------ */
/* Single shared window pipeline (no duplicated scoring)               */
/* ------------------------------------------------------------------ */

describe("shared window analysis", () => {
  it("the engine's bestWindows are exactly analyzeWindows(...).top", () => {
    const scope = scopeRecommendationTrips(trainMonth(5), false, new Date(2026, 5, 1));
    const rec = calculateWorkRecommendations(scope);
    const analysis = analyzeWindows(scope.trips);
    expect(rec.bestWindows).toEqual(analysis.top);
  });
});
