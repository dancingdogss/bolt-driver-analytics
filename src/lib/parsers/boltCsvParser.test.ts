import { describe, it, expect } from "vitest";
import { parseBoltCsvText } from "./boltCsvParser";
import { calculateBoltMetrics } from "@/lib/analytics/calculateBoltMetrics";
import { parseMoney } from "@/lib/utils/money";
import { parseBoltDate } from "@/lib/utils/dates";

const HEADER =
  "Factura numărul,Dată,Adresa de preluare,Metoda de plată,Data călătoriei,Beneficiar,Adresa beneficiarului,Numărul de înregistrare al beneficiarului,Număr TVA beneficiar,Nume companie,Adresă companie (Stradă, Număr, Cod poștal, Țară),Cod unic de inregistrare,Număr TVA companie,Valoare (fără TVA),TVA,Valoare totală";

// Well-formed row (16 columns, quoted addresses).
const ROW_OK =
  'INV-001,05.07.2026 10:30,"Str. Victoriei 10, București",Bolt Payment,05.07.2026 10:35,Ion Pop,Adresa Ben,RO123,RO123,Bolt SRL,"Str. A, 1, 010101, RO",J40/1,RO999,"10,50","1,99","12,49"';

// Cash row.
const ROW_CASH =
  'INV-002,05.07.2026 22:00,"Aeroport Otopeni",Numerar,05.07.2026 22:10,Ion,Adr,RO1,RO1,Bolt,"Str B, 2, RO",J1,RO9,"20,00","3,80","23,80"';

// Malformed: pickup address has stray commas and is unquoted -> extra columns.
// Recovered by anchoring on the "Business" payment token. Money stays quoted,
// as in real exports (only the address is broken).
const ROW_MALFORMED =
  'INV-003,06.07.2026 08:00,Bd. Unirii, bl. 5, sc. 2,Business,06.07.2026 08:20,Ion,Adr,RO1,RO1,Bolt,"Str C, RO",J1,RO9,"30,00","5,70","35,70"';

// Duplicate of INV-001 -> must be skipped.
const ROW_DUP = ROW_OK;

// VAT mismatch -> imported but warned.
const ROW_VAT_BAD =
  'INV-004,06.07.2026 09:00,"Piața Romană",Bolt Payment,06.07.2026 09:15,Ion,Adr,RO1,RO1,Bolt,"Str D, RO",J1,RO9,"10,00","1,00","99,00"';

const BOM = "﻿";

describe("parseMoney", () => {
  it("parses Romanian decimals and thousands", () => {
    expect(parseMoney("12,49")).toBeCloseTo(12.49);
    expect(parseMoney("1.234,56")).toBeCloseTo(1234.56);
    expect(parseMoney("35,70 RON")).toBeCloseTo(35.7);
    expect(parseMoney("")).toBeNaN();
  });
});

describe("parseBoltDate", () => {
  it("parses dd.MM.yyyy HH:mm", () => {
    const d = parseBoltDate("05.07.2026 10:35");
    expect(d).not.toBeNull();
    expect(d!.getFullYear()).toBe(2026);
    expect(d!.getMonth()).toBe(6); // July
    expect(d!.getDate()).toBe(5);
    expect(d!.getHours()).toBe(10);
    expect(parseBoltDate("nope")).toBeNull();
  });
});

describe("parseBoltCsvText", () => {
  it("parses, recovers, dedups and validates", () => {
    const csv = [
      BOM + HEADER,
      ROW_OK,
      ROW_CASH,
      ROW_MALFORMED,
      ROW_DUP,
      ROW_VAT_BAD,
    ].join("\n");

    const seen = new Set<string>();
    const result = parseBoltCsvText(csv, "test.csv", seen);

    // 4 unique rows imported (INV-001..004), 1 duplicate skipped.
    expect(result.trips.map((t) => t.invoiceNumber).sort()).toEqual([
      "INV-001",
      "INV-002",
      "INV-003",
      "INV-004",
    ]);
    expect(result.duplicatesSkipped).toBe(1);

    // Malformed row recovered: address joined, money from the last 3 columns.
    const malformed = result.trips.find((t) => t.invoiceNumber === "INV-003")!;
    expect(malformed.paymentMethod).toBe("Business");
    expect(malformed.pickupAddress).toBe("Bd. Unirii, bl. 5, sc. 2");
    expect(malformed.totalValue).toBeCloseTo(35.7);
    expect(malformed.valueWithoutVat).toBeCloseTo(30);

    // Recovery of the malformed row produced a warning.
    expect(result.warnings.some((w) => w.row > 0)).toBe(true);

    // VAT mismatch row is kept but warned.
    expect(result.trips.some((t) => t.invoiceNumber === "INV-004")).toBe(true);
    expect(
      result.warnings.some((w) => w.message.includes("VAT mismatch")),
    ).toBe(true);
  });

  it("computes metrics off the real trip date", () => {
    const csv = [BOM + HEADER, ROW_OK, ROW_CASH, ROW_MALFORMED].join("\n");
    const { trips } = parseBoltCsvText(csv, "t.csv", new Set());
    const m = calculateBoltMetrics(trips);

    expect(m.totalTrips).toBe(3);
    expect(m.totalRevenue).toBeCloseTo(12.49 + 23.8 + 35.7);
    expect(m.paymentSplit.map((p) => p.method).sort()).toEqual([
      "Bolt Payment",
      "Business",
      "Numerar",
    ]);
    // Two distinct trip days: 05.07 and 06.07.
    expect(m.dailyRevenue.length).toBe(2);
    // Hour buckets: 10:00, 22:00, 08:00 have trips.
    expect(m.hourlyRevenue.find((h) => h.hour === 10)!.trips).toBe(1);
    expect(m.hourlyRevenue.find((h) => h.hour === 22)!.trips).toBe(1);
  });
});
