import { describe, it, expect } from "vitest";
import { calculateMonthlyDriverReport } from "./calculateMonthlyDriverReport";
import type { BoltMetrics } from "./calculateBoltMetrics";
import { calculateProfit } from "./estimateProfit";
import { DEFAULT_EXPENSE_SETTINGS } from "./calculateExpenses";

/** Minimal June-2026 metrics: Tuesday (02.06) is clearly the best day. */
function juneMetrics(): BoltMetrics {
  const hourly = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    label: `${String(hour).padStart(2, "0")}:00`,
    revenue: 0,
    trips: 0,
  }));
  hourly[17] = { hour: 17, label: "17:00", revenue: 900, trips: 12 };
  hourly[18] = { hour: 18, label: "18:00", revenue: 800, trips: 10 };
  hourly[19] = { hour: 19, label: "19:00", revenue: 700, trips: 9 };
  hourly[9] = { hour: 9, label: "09:00", revenue: 200, trips: 4 };

  return {
    totalTrips: 100,
    totalRevenue: 5000,
    revenueWithoutVat: 4600,
    vatTotal: 400,
    averageTripValue: 50,
    paymentSplit: [],
    dailyRevenue: [
      // 2026-06-01 = Luni, 2026-06-02 = Marți, 2026-06-07 = Duminică.
      { dayKey: "2026-06-01", label: "01.06.2026", revenue: 1200, trips: 25 },
      { dayKey: "2026-06-02", label: "02.06.2026", revenue: 2600, trips: 50 },
      { dayKey: "2026-06-07", label: "07.06.2026", revenue: 1200, trips: 25 },
    ],
    hourlyRevenue: hourly,
    topPickups: [{ address: "Str. Exemplu 1", trips: 12, revenue: 700 }],
  };
}

describe("calculateMonthlyDriverReport", () => {
  it("returns null for a month with no trips", () => {
    const metrics = { ...juneMetrics(), totalTrips: 0 };
    const profit = calculateProfit(0, 0, 30, DEFAULT_EXPENSE_SETTINGS);
    expect(
      calculateMonthlyDriverReport({ monthKey: "2026-06", metrics, profit }),
    ).toBeNull();
  });

  it("identifies the best day, hour window and pickup", () => {
    const metrics = juneMetrics();
    const profit = calculateProfit(5000, 100, 30, DEFAULT_EXPENSE_SETTINGS);
    const report = calculateMonthlyDriverReport({
      monthKey: "2026-06",
      metrics,
      profit,
    })!;

    expect(report.monthLabel).toBe("Iunie 2026");
    expect(report.wentWell[0]).toContain("Marți");
    expect(report.wentWell[1]).toContain("17:00–20:00");
    expect(report.wentWell[2]).toContain("Str. Exemplu 1");
  });

  it("mentions the estimated commission and medium accuracy without a PDF", () => {
    const metrics = juneMetrics();
    const profit = calculateProfit(5000, 100, 30, DEFAULT_EXPENSE_SETTINGS);
    const report = calculateMonthlyDriverReport({
      monthKey: "2026-06",
      metrics,
      profit,
    })!;

    expect(report.usedMonthlyPdf).toBe(false);
    expect(report.accuracy).toBe("medium");
    expect(report.conclusion).toContain("încarcă PDF-ul lunar Bolt");
    expect(report.copyText).toContain("Comision estimat:");
    expect(report.copyText).toContain(
      "Observație: Calcul estimativ, pe baza datelor importate.",
    );
    expect(report.copyText).not.toContain("Kilometri:");
  });

  it("uses the real Bolt fee and kilometers when a monthly PDF matched", () => {
    const metrics = juneMetrics();
    const profit = calculateProfit(5000, 100, 30, DEFAULT_EXPENSE_SETTINGS, {
      boltFee: 1100.5,
      tripKilometers: 2452.01,
    });
    const report = calculateMonthlyDriverReport({
      monthKey: "2026-06",
      metrics,
      profit,
    })!;

    expect(report.usedMonthlyPdf).toBe(true);
    expect(report.accuracy).toBe("high");
    expect(report.kpis.some((k) => k.label === "Taxă Bolt reală")).toBe(true);
    expect(report.kpis.some((k) => k.label === "Kilometri reali")).toBe(true);
    expect(report.copyText).toContain("Taxă Bolt: 1.100,50 RON");
    expect(report.copyText).toContain("Kilometri: 2.452,01 km");
    expect(report.copyText).toContain("PDF lunar Bolt importat");
  });

  it("keeps the copy text WhatsApp-friendly (one fact per line)", () => {
    const metrics = juneMetrics();
    const profit = calculateProfit(5000, 100, 30, DEFAULT_EXPENSE_SETTINGS);
    const report = calculateMonthlyDriverReport({
      monthKey: "2026-06",
      metrics,
      profit,
    })!;

    const lines = report.copyText.split("\n");
    expect(lines[0]).toBe("Raport Bolt - Iunie 2026");
    expect(lines).toContain("Curse: 100");
    expect(lines).toContain("Ziua cu cel mai mare venit: Marți");
    expect(lines).toContain("Intervalul cu cel mai mare venit: 17:00–20:00");
  });

  it("never uses forbidden aggressive or forward-looking wording", () => {
    const metrics = juneMetrics();
    // Force a low-margin month so the cautious margin bullet appears too.
    const profit = calculateProfit(5000, 100, 30, {
      ...DEFAULT_EXPENSE_SETTINGS,
      items: {
        ...DEFAULT_EXPENSE_SETTINGS.items,
        carRent: { value: 900, frequency: "perWeek" },
      },
    });
    const report = calculateMonthlyDriverReport({
      monthKey: "2026-06",
      metrics,
      profit,
    })!;

    const all = [
      report.conclusion,
      ...report.wentWell,
      ...report.watchOut,
      ...report.nextMonth,
      report.copyText,
    ]
      .join(" ")
      .toLowerCase();
    const banned = [
      // Aggressive / predictive.
      "garantat",
      "pierdut bani",
      "nu merită să lucrezi",
      "predicți",
      // Forward-looking "when to work" claims that belong only to the engine.
      "cele mai bune rezultate apar",
      "cea mai bună zi pentru lucru",
      "interval recomandat",
      // Avoidance advice the CSV cannot justify.
      "nu ieși la lucru",
      "evită acest interval",
    ];
    for (const phrase of banned) {
      expect(all).not.toContain(phrase);
    }
  });

  it("phrases the day/hour highlights as retrospective selected-period facts", () => {
    const metrics = juneMetrics();
    const profit = calculateProfit(5000, 100, 30, DEFAULT_EXPENSE_SETTINGS);
    const report = calculateMonthlyDriverReport({
      monthKey: "2026-06",
      metrics,
      profit,
    })!;

    // Conclusion is explicitly retrospective and disclaims future advice.
    expect(report.conclusion).toContain("În perioada selectată");
    expect(report.conclusion).toContain(
      "nu este o recomandare pentru viitor",
    );
    // The highlights are framed by total revenue, not as "best time to work".
    expect(report.wentWell[0]).toContain("cel mai mare venit total");
    expect(report.wentWell[1]).toContain("cel mai mare venit total");
    // The weakest-day note is descriptive, never calls the day "slabă".
    expect(report.watchOut.join(" ")).not.toContain("slabă");
    // Next-month bullets defer when-to-work advice to the recommendations card.
    expect(report.nextMonth[0]).toContain("Recomandări pentru ieșit la lucru");
    // The shareable text carries the same retrospective note.
    expect(report.copyText).toContain(
      "nu este o recomandare pentru viitor",
    );
  });
});
