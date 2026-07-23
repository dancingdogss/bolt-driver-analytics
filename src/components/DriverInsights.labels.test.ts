import { describe, it, expect } from "vitest";
import { INSIGHT_LABELS, INSIGHTS_PERIOD_DISCLAIMER } from "./DriverInsights";

const ALL_LABELS = Object.values(INSIGHT_LABELS);

describe("Driver Insights labels", () => {
  it("frames day and hour maxima by total revenue, not as recommendations", () => {
    expect(INSIGHT_LABELS.bestDay).toBe("Ziua cu cel mai mare venit total");
    expect(INSIGHT_LABELS.worstDay).toBe("Ziua cu cel mai mic venit total");
    expect(INSIGHT_LABELS.bestHour).toBe("Ora cu cel mai mare venit total");
    expect(INSIGHT_LABELS.worstActiveHour).toBe(
      "Ora activă cu cel mai mic venit total",
    );
  });

  it("never labels a low-revenue day or hour as 'slabă' or recommended", () => {
    for (const label of ALL_LABELS) {
      const l = label.toLowerCase();
      expect(l).not.toContain("slabă");
      expect(l).not.toContain("cea mai bună");
      expect(l).not.toContain("recomand");
    }
  });

  it("keeps pickup labels descriptive, not recommended", () => {
    expect(INSIGHT_LABELS.mostCommonPickup).toBe(
      "Cea mai frecventă adresă de preluare",
    );
    expect(INSIGHT_LABELS.topRevenuePickup).toBe(
      "Adresa cu cel mai mare venit total",
    );
  });

  it("disclaims future advice and points to the recommendations surface", () => {
    expect(INSIGHTS_PERIOD_DISCLAIMER).toContain("perioada selectată");
    expect(INSIGHTS_PERIOD_DISCLAIMER).toContain("nu sunt recomandări");
    expect(INSIGHTS_PERIOD_DISCLAIMER).toContain(
      "Recomandări pentru ieșit la lucru",
    );
  });

  it("never turns low or missing observations into avoidance advice", () => {
    const all = [...ALL_LABELS, INSIGHTS_PERIOD_DISCLAIMER]
      .join(" ")
      .toLowerCase();
    expect(all).not.toContain("nu ieși la lucru");
    expect(all).not.toContain("evită");
  });
});
