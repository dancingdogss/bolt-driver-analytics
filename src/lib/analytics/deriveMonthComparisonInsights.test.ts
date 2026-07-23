import { describe, it, expect } from "vitest";
import { deriveMonthComparisonInsights } from "./deriveMonthComparisonInsights";
import type {
  MetricDelta,
  MonthComparison,
} from "./calculateMonthComparison";
import type { ProfitAccuracy } from "./estimateProfit";

/** Build a MetricDelta the same way calculateMonthComparison does. */
function md(current: number, previous: number): MetricDelta {
  const absolute = current - previous;
  const direction =
    Math.abs(absolute) < 0.005 ? "flat" : absolute > 0 ? "up" : "down";
  return {
    current,
    previous,
    absolute,
    percent: previous > 0 ? (absolute / previous) * 100 : null,
    direction,
  };
}

interface Parts {
  grossRevenue?: MetricDelta;
  tripCount?: MetricDelta;
  estimatedProfit?: MetricDelta;
  revenuePerWorkedDay?: MetricDelta;
  currentAccuracy?: ProfitAccuracy;
  previousAccuracy?: ProfitAccuracy;
}

const FLAT = md(100, 100);

function mc(parts: Parts): MonthComparison {
  return {
    currentKey: "2026-06",
    currentLabel: "Iunie 2026",
    previousKey: "2026-05",
    previousLabel: "Mai 2026",
    previousIsGap: false,
    grossRevenue: parts.grossRevenue ?? FLAT,
    tripCount: parts.tripCount ?? FLAT,
    estimatedProfit: parts.estimatedProfit ?? FLAT,
    revenuePerWorkedDay: parts.revenuePerWorkedDay ?? FLAT,
    currentAccuracy: parts.currentAccuracy ?? "medium",
    previousAccuracy: parts.previousAccuracy ?? "medium",
  };
}

describe("deriveMonthComparisonInsights", () => {
  it("R1: profit + revenue/day up while trips fell", () => {
    const out = deriveMonthComparisonInsights(
      mc({
        estimatedProfit: md(1100, 1000),
        revenuePerWorkedDay: md(660, 600),
        tripCount: md(180, 200),
      }),
    );
    expect(out.map((i) => i.id)).toEqual(["R1"]);
    expect(out[0]).toMatchObject({ tone: "positive", profitRelated: true });
    expect(out[0].text).toContain("curse mai eficiente");
  });

  it("R2: revenue up but estimated profit down", () => {
    const out = deriveMonthComparisonInsights(
      mc({ grossRevenue: md(11000, 10000), estimatedProfit: md(900, 1000) }),
    );
    expect(out.map((i) => i.id)).toEqual(["R2"]);
    expect(out[0]).toMatchObject({ tone: "negative", profitRelated: true });
  });

  it("R3: revenue down but estimated profit up", () => {
    const out = deriveMonthComparisonInsights(
      mc({ grossRevenue: md(9000, 10000), estimatedProfit: md(1100, 1000) }),
    );
    expect(out.map((i) => i.id)).toEqual(["R3"]);
    expect(out[0]).toMatchObject({ tone: "positive", profitRelated: true });
  });

  it("R4: trips grew faster than revenue (revenue per trip fell)", () => {
    // trips +20%, revenue +10% → 50 → 45.83 RON/trip.
    const out = deriveMonthComparisonInsights(
      mc({ tripCount: md(240, 200), grossRevenue: md(11000, 10000) }),
    );
    expect(out.map((i) => i.id)).toEqual(["R4"]);
    expect(out[0]).toMatchObject({
      tone: "neutral",
      profitRelated: false,
      qualifyProfitAccuracy: false,
    });
  });

  it("R5: revenue grew faster than trips (revenue per trip rose)", () => {
    // trips +10%, revenue +20% → 50 → 54.5 RON/trip.
    const out = deriveMonthComparisonInsights(
      mc({ tripCount: md(220, 200), grossRevenue: md(12000, 10000) }),
    );
    expect(out.map((i) => i.id)).toEqual(["R5"]);
    expect(out[0]).toMatchObject({ tone: "positive", profitRelated: false });
  });

  it("emits at most one profit-related insight (R1 wins over R3)", () => {
    // profit up + rev/day up + trips down (R1) AND revenue down + profit up (R3).
    const out = deriveMonthComparisonInsights(
      mc({
        estimatedProfit: md(1100, 1000),
        revenuePerWorkedDay: md(660, 600),
        tripCount: md(180, 200),
        grossRevenue: md(9000, 10000),
      }),
    );
    expect(out.map((i) => i.id)).toEqual(["R1"]);
    expect(out.filter((i) => i.profitRelated)).toHaveLength(1);
  });

  it("combines one profit insight with a revenue-per-trip insight", () => {
    // R2 (revenue up, profit down) + R5 (revenue per trip up), in priority order.
    const out = deriveMonthComparisonInsights(
      mc({
        grossRevenue: md(13000, 10000),
        estimatedProfit: md(900, 1000),
        tripCount: md(210, 200),
      }),
    );
    expect(out.map((i) => i.id)).toEqual(["R2", "R5"]);
    expect(out).toHaveLength(2);
  });

  it("returns nothing when movements are flat or below the 3% threshold", () => {
    expect(deriveMonthComparisonInsights(mc({}))).toEqual([]);
    // profit +2% and revenue +2% are below the relevance threshold.
    const out = deriveMonthComparisonInsights(
      mc({ grossRevenue: md(10200, 10000), estimatedProfit: md(1020, 1000) }),
    );
    expect(out).toEqual([]);
  });

  it("applies the accuracy caution only to profit-related insights", () => {
    const out = deriveMonthComparisonInsights(
      mc({
        grossRevenue: md(13000, 10000),
        estimatedProfit: md(900, 1000),
        tripCount: md(210, 200),
        currentAccuracy: "low",
      }),
    );
    const byId = Object.fromEntries(out.map((i) => [i.id, i]));
    expect(byId.R2.qualifyProfitAccuracy).toBe(true);
    expect(byId.R5.qualifyProfitAccuracy).toBe(false);
  });

  it("does not attach the accuracy caution to a lone R4", () => {
    const out = deriveMonthComparisonInsights(
      mc({
        tripCount: md(240, 200),
        grossRevenue: md(11000, 10000),
        previousAccuracy: "low",
      }),
    );
    expect(out.map((i) => i.id)).toEqual(["R4"]);
    expect(out[0].qualifyProfitAccuracy).toBe(false);
  });

  it("uses the zero-base direction fallback for MonthComparison metrics", () => {
    // Previous revenue 0 → percent null, but direction up still counts (R2).
    const out = deriveMonthComparisonInsights(
      mc({ grossRevenue: md(11000, 0), estimatedProfit: md(900, 1000) }),
    );
    expect(out.map((i) => i.id)).toEqual(["R2"]);
  });

  it("never applies a zero-base fallback to revenue per trip (skips R4/R5)", () => {
    // Trip count rises from 0 (direction up via fallback), but revenue-per-trip
    // is undefined against 0 previous trips → no R4/R5, no NaN.
    const out = deriveMonthComparisonInsights(
      mc({ tripCount: md(200, 0), grossRevenue: md(10000, 0) }),
    );
    expect(out).toEqual([]);
  });

  it("is deterministic for the same input", () => {
    const input = mc({
      grossRevenue: md(13000, 10000),
      estimatedProfit: md(900, 1000),
      tripCount: md(210, 200),
    });
    expect(deriveMonthComparisonInsights(input)).toEqual(
      deriveMonthComparisonInsights(input),
    );
  });

  it("never returns more than three insights", () => {
    // A busy comparison; the cap and the one-profit rule keep it small.
    const out = deriveMonthComparisonInsights(
      mc({
        grossRevenue: md(13000, 10000),
        estimatedProfit: md(1500, 1000),
        revenuePerWorkedDay: md(700, 600),
        tripCount: md(220, 200),
      }),
    );
    expect(out.length).toBeLessThanOrEqual(3);
  });
});
