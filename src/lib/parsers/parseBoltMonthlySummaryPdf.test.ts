import { describe, it, expect } from "vitest";
import {
  parseBoltMonthlySummaryText,
  parseMonthlySummaryText,
  parseRomanianNumber,
  validateBoltMonthlySummary,
} from "./parseBoltMonthlySummaryPdf";
import type { BoltMonthlySummary } from "@/lib/types/monthlySummary";

describe("parseRomanianNumber", () => {
  it("parses Romanian money and kilometrage formats", () => {
    expect(parseRomanianNumber("12.637,00 lei")).toBeCloseTo(12637, 2);
    expect(parseRomanianNumber("2.708,08 lei")).toBeCloseTo(2708.08, 2);
    expect(parseRomanianNumber("130,00 lei")).toBeCloseTo(130, 2);
    expect(parseRomanianNumber("68,00 lei")).toBeCloseTo(68, 2);
    expect(parseRomanianNumber("2452.01km")).toBeCloseTo(2452.01, 2);
  });
});

const JUNE_2026: Partial<BoltMonthlySummary> = {
  platform: "bolt",
  periodStart: "2026-06-01",
  periodEnd: "2026-06-30",
  monthKey: "2026-06",
  grossFare: 12637,
  cancellationFee: 68,
  reservationFee: 30,
  totalFare: 12735,
  tips: 130,
  boltFee: 2708.08,
  tripKilometers: 2452.01,
};

/**
 * The real Bolt layout where pdf.js lists all labels of a section first, then
 * all values — so values are NOT on the same line as their labels.
 */
const SEPARATED_SAMPLE = `NU ESTE O FACTURĂ OFICIALĂ SAU UN DOCUMENT FISCAL
Rezumat lunar pentru perioada
01.06.2026 - 30.06.2026

DEFALCARE TARIF

Tarif brut
Taxă de anulare
Taxă de rezervare

TOTAL

12.637,00 lei
68,00 lei
30,00 lei

12.735,00 lei

DEFALCARE ALTE VENITURI

Bacșiș

TOTAL

130,00 lei

130,00 lei

ALTE POSIBILE DEDUCERI

Taxă Bolt
Kilometraj pe cursă

2.708,08 lei
2452.01km`;

/** The simpler layout where each label sits on one line with its value. */
const INLINE_SAMPLE = `Rezumat lunar pentru perioada 01.06.2026 - 30.06.2026
DEFALCARE TARIF
Tarif brut 12.637,00 lei
Taxă de anulare 68,00 lei
Taxă de rezervare 30,00 lei
TOTAL 12.735,00 lei
DEFALCARE ALTE VENITURI
Bacșiș 130,00 lei
TOTAL 130,00 lei
ALTE POSIBILE DEDUCERI
Taxă Bolt 2.708,08 lei
Kilometraj pe cursă 2452.01km`;

describe("parseMonthlySummaryText — separated label/value layout", () => {
  it("maps section values positionally (the real Bolt PDF)", () => {
    const { summary, missingFields, error } = parseMonthlySummaryText(
      SEPARATED_SAMPLE,
      "iunie.pdf",
    );
    expect(error).toBeUndefined();
    expect(missingFields).toEqual([]);
    expect(summary).toMatchObject({ ...JUNE_2026, sourceFileName: "iunie.pdf" });
    // The specific regression: real Bolt fee and km, not 0.
    expect(summary?.boltFee).toBeCloseTo(2708.08, 2);
    expect(summary?.tripKilometers).toBeCloseTo(2452.01, 2);
    expect(summary?.tips).toBeCloseTo(130, 2);
    // totalFare must be the tarif total (12.735), not the second TOTAL (130).
    expect(summary?.totalFare).toBeCloseTo(12735, 2);
  });

  it("handles decomposed diacritics emitted by pdf.js (NFD)", () => {
    const summary = parseBoltMonthlySummaryText(SEPARATED_SAMPLE.normalize("NFD"));
    expect(summary).toMatchObject(JUNE_2026);
  });

  it("accepts 'Taxa Bolt' without a diacritic", () => {
    const summary = parseBoltMonthlySummaryText(
      SEPARATED_SAMPLE.replace("Taxă Bolt", "Taxa Bolt"),
    );
    expect(summary?.boltFee).toBeCloseTo(2708.08, 2);
  });

  it("never assigns a DEFALCARE TARIF value (grossFare) to tips", () => {
    const { summary } = parseMonthlySummaryText(SEPARATED_SAMPLE);
    expect(summary?.tips).toBeCloseTo(130, 2);
    expect(summary?.tips).not.toBeCloseTo(summary!.grossFare, 2);
  });
});

describe("parseMonthlySummaryText — tips isolation", () => {
  it("marks tips missing rather than borrowing grossFare when Bacșiș has no value", () => {
    // ALTE VENITURI section present but with no money for Bacșiș.
    const noTip = `Rezumat lunar pentru perioada 01.06.2026 - 30.06.2026
DEFALCARE TARIF
Tarif brut 12.637,00 lei
TOTAL 12.735,00 lei
DEFALCARE ALTE VENITURI
Bacșiș
ALTE POSIBILE DEDUCERI
Taxă Bolt 2.708,08 lei`;
    const { summary, missingFields } = parseMonthlySummaryText(noTip);
    expect(missingFields).toContain("Bacșiș");
    expect(summary?.tips).toBe(0); // reported missing, not 12637
    expect(summary?.grossFare).toBeCloseTo(12637, 2);
  });

  it("finds tips from the ALTE VENITURI region even if value precedes the label", () => {
    // pdf.js sometimes emits the value column before the label column; the tip
    // still sits inside the DEFALCARE ALTE VENITURI section.
    const valueFirst = `Rezumat lunar pentru perioada 01.06.2026 - 30.06.2026
DEFALCARE TARIF
Tarif brut 12.637,00 lei
TOTAL 12.735,00 lei
DEFALCARE ALTE VENITURI
130,00 lei
130,00 lei
Bacșiș
TOTAL
ALTE POSIBILE DEDUCERI
Taxă Bolt 2.708,08 lei`;
    const { summary, missingFields } = parseMonthlySummaryText(valueFirst);
    expect(missingFields).not.toContain("Bacșiș");
    expect(summary?.tips).toBeCloseTo(130, 2);
  });

  it("skips a leaked 'Taxă de anulare' (68) in the region and returns 130", () => {
    // The cancellation fee bleeds into the DEFALCARE ALTE VENITURI region;
    // tips must skip it (68 == cancellationFee) and take the real 130.
    const leaked = `Rezumat lunar pentru perioada 01.06.2026 - 30.06.2026
DEFALCARE TARIF
Tarif brut 12.637,00 lei
Taxă de anulare 68,00 lei
Taxă de rezervare 30,00 lei
TOTAL 12.735,00 lei
DEFALCARE ALTE VENITURI
68,00 lei
Bacșiș 130,00 lei
TOTAL 130,00 lei
ALTE POSIBILE DEDUCERI
Taxă Bolt 2.708,08 lei
Kilometraj pe cursă 2452.01km`;
    const { summary, missingFields } = parseMonthlySummaryText(leaked);
    expect(missingFields).not.toContain("Bacșiș");
    expect(summary?.cancellationFee).toBeCloseTo(68, 2);
    expect(summary?.tips).toBeCloseTo(130, 2);
    expect(summary?.tips).not.toBeCloseTo(68, 2);
  });

  it("rejects a tip that equals grossFare as suspicious", () => {
    // Bacșiș pathologically shows the gross fare — must be treated as missing.
    const suspicious = `Rezumat lunar pentru perioada 01.06.2026 - 30.06.2026
DEFALCARE TARIF
Tarif brut 12.637,00 lei
TOTAL 12.735,00 lei
DEFALCARE ALTE VENITURI
Bacșiș 12.637,00 lei
ALTE POSIBILE DEDUCERI
Taxă Bolt 2.708,08 lei`;
    const { summary, missingFields } = parseMonthlySummaryText(suspicious);
    expect(missingFields).toContain("Bacșiș");
    expect(summary?.tips).toBe(0);
  });
});

describe("parseMonthlySummaryText — inline label/value layout", () => {
  it("parses the same values when label and value share a line", () => {
    const { summary, missingFields } = parseMonthlySummaryText(INLINE_SAMPLE);
    expect(missingFields).toEqual([]);
    expect(summary).toMatchObject(JUNE_2026);
  });
});

describe("parseMonthlySummaryText — resilience", () => {
  it("reports missing fields without failing when a section is absent", () => {
    const partial =
      "Rezumat lunar pentru perioada 01.06.2026 - 30.06.2026\n" +
      "ALTE POSIBILE DEDUCERI\nTaxă Bolt 2.708,08 lei";
    const { summary, missingFields, error } = parseMonthlySummaryText(partial);
    expect(error).toBeUndefined();
    expect(summary?.boltFee).toBeCloseTo(2708.08, 2);
    expect(missingFields).toContain("Tarif brut");
    expect(missingFields).not.toContain("Taxă Bolt");
  });

  it("returns an invalid error when the period line is missing", () => {
    const { summary, error } = parseMonthlySummaryText("Nothing useful here");
    expect(summary).toBeNull();
    expect(error).toBe("invalid");
  });
});

describe("validateBoltMonthlySummary", () => {
  it("flags no missing fields for a fully parsed summary", () => {
    const summary = parseBoltMonthlySummaryText(SEPARATED_SAMPLE)!;
    expect(validateBoltMonthlySummary(summary)).toEqual([]);
  });

  it("flags Taxă Bolt when it is zero", () => {
    const summary = parseBoltMonthlySummaryText(SEPARATED_SAMPLE)!;
    expect(validateBoltMonthlySummary({ ...summary, boltFee: 0 })).toContain(
      "Taxă Bolt",
    );
  });
});
