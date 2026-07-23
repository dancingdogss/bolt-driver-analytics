import type {
  ChangeDirection,
  MetricDelta,
  MonthComparison,
} from "./calculateMonthComparison";

/**
 * A single plain-Romanian, cautious observation derived from a month-over-month
 * comparison. These explain *relationships* between the compared metrics (e.g.
 * profit rose while trips fell); they never restate the four displayed numbers
 * and never claim causation. Deterministic and local — no API, no randomness.
 */
export interface ComparisonInsight {
  /** Stable identifier (rule id), used as a React key and in tests. */
  id: "R1" | "R2" | "R3" | "R4" | "R5";
  text: string;
  tone: "positive" | "negative" | "neutral";
  /** True for insights that talk about estimated profit. */
  profitRelated: boolean;
  /**
   * True when a profit-related insight must be shown with a prominent accuracy
   * caution (either compared month has "low" profit accuracy). Only ever set on
   * profit-related insights — never on the revenue-per-trip rules.
   */
  qualifyProfitAccuracy: boolean;
}

/** A metric must move at least this many percent to feed an insight. */
const MIN_RELEVANT_PERCENT = 3;

/** At most this many insights are ever returned. */
const MAX_INSIGHTS = 3;

/**
 * A directional move is "relevant" when it is not flat AND — when a percentage
 * is defined — its magnitude clears the threshold. When the percentage is null
 * (previous value was 0) the direction alone is meaningful (0 → positive), so
 * we fall back to it. This zero-base fallback applies to the existing
 * MonthComparison metrics only, never to a derived revenue-per-trip ratio.
 */
function isRelevant(delta: MetricDelta): boolean {
  if (delta.direction === "flat") return false;
  if (delta.percent === null) return true; // zero-base fallback
  return Math.abs(delta.percent) >= MIN_RELEVANT_PERCENT;
}

function movedUp(delta: MetricDelta): boolean {
  return delta.direction === "up" && isRelevant(delta);
}

function movedDown(delta: MetricDelta): boolean {
  return delta.direction === "down" && isRelevant(delta);
}

/**
 * Direction of revenue per trip (gross revenue ÷ trip count) across the two
 * months, but only when it can be computed safely: both months must have a
 * positive trip count and every derived value must be finite. Returns `null`
 * when the ratio is undefined — R4/R5 are then skipped, never producing NaN or
 * Infinity. No zero-base fallback is applied to this derived ratio.
 */
function revenuePerTripDirection(c: MonthComparison): ChangeDirection | null {
  const curTrips = c.tripCount.current;
  const prevTrips = c.tripCount.previous;
  if (!(curTrips > 0) || !(prevTrips > 0)) return null;

  const curRpt = c.grossRevenue.current / curTrips;
  const prevRpt = c.grossRevenue.previous / prevTrips;
  if (!Number.isFinite(curRpt) || !Number.isFinite(prevRpt) || prevRpt <= 0) {
    return null;
  }

  const percent = ((curRpt - prevRpt) / prevRpt) * 100;
  if (!Number.isFinite(percent) || Math.abs(percent) < MIN_RELEVANT_PERCENT) {
    return null; // below the relevance threshold → no insight
  }
  return percent > 0 ? "up" : "down";
}

/**
 * Turn a month-over-month comparison into at most three cautious insights.
 *
 * Rules are evaluated in the fixed priority order R1 → R2 → R3 → R4 → R5.
 * At most one profit-related insight is emitted (R1–R3 are profit-related); the
 * revenue-per-trip rules (R4/R5) add efficiency context. The result may be
 * empty, one, two, or three insights — no filler is added to reach three.
 */
export function deriveMonthComparisonInsights(
  c: MonthComparison,
): ComparisonInsight[] {
  const lowProfitAccuracy =
    c.currentAccuracy === "low" || c.previousAccuracy === "low";

  const insights: ComparisonInsight[] = [];
  let profitEmitted = false;

  const pushProfit = (
    id: ComparisonInsight["id"],
    tone: ComparisonInsight["tone"],
    text: string,
  ) => {
    if (profitEmitted) return;
    insights.push({
      id,
      text,
      tone,
      profitRelated: true,
      qualifyProfitAccuracy: lowProfitAccuracy,
    });
    profitEmitted = true;
  };

  // R1: profit ↑ and revenue/worked-day ↑ while trips ↓ — more efficient trips.
  if (
    movedUp(c.estimatedProfit) &&
    movedUp(c.revenuePerWorkedDay) &&
    movedDown(c.tripCount)
  ) {
    pushProfit(
      "R1",
      "positive",
      "Profitul estimat și venitul pe zi lucrată au crescut, deși numărul de curse a scăzut — datele sugerează curse mai eficiente. Merită verificat ce a fost diferit.",
    );
  }

  // R2: revenue ↑ but estimated profit ↓ — possible cost pressure.
  if (movedUp(c.grossRevenue) && movedDown(c.estimatedProfit)) {
    pushProfit(
      "R2",
      "negative",
      "Venitul brut a crescut, dar profitul estimat a scăzut, ceea ce poate indica o presiune mai mare a costurilor. Merită verificat comisionul și cheltuielile configurate.",
    );
  }

  // R3: revenue ↓ but estimated profit ↑ — relatively lower costs / better trips.
  if (movedDown(c.grossRevenue) && movedUp(c.estimatedProfit)) {
    pushProfit(
      "R3",
      "positive",
      "Venitul brut a scăzut, dar profitul estimat a crescut — datele sugerează costuri relativ mai mici sau curse mai eficiente.",
    );
  }

  // R4/R5: revenue-per-trip efficiency, only when the ratio is safely defined
  // and the trip count itself rose meaningfully.
  const rptDirection = revenuePerTripDirection(c);
  if (rptDirection && movedUp(c.tripCount)) {
    if (rptDirection === "down") {
      insights.push({
        id: "R4",
        text: "Numărul de curse a crescut mai repede decât venitul, ceea ce poate indica un venit mediu pe cursă mai mic. Merită verificat tipul curselor.",
        tone: "neutral",
        profitRelated: false,
        qualifyProfitAccuracy: false,
      });
    } else {
      insights.push({
        id: "R5",
        text: "Venitul a crescut mai repede decât numărul de curse — datele sugerează un venit mediu pe cursă mai bun.",
        tone: "positive",
        profitRelated: false,
        qualifyProfitAccuracy: false,
      });
    }
  }

  return insights.slice(0, MAX_INSIGHTS);
}
