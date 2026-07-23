import { describe, it, expect } from "vitest";
import { limitedTrainingNote } from "./WorkRecommendations";

describe("limitedTrainingNote", () => {
  it("warns strongly when NO training month has ≥50 trips", () => {
    const note = limitedTrainingNote(0);
    expect(note).toBe(
      "Rezultatul este foarte limitat: deși există suficiente curse cumulat, " +
        "nicio lună de antrenare nu are individual minimum 50 de curse.",
    );
  });

  it("says 'o singură lună' for exactly one evidence month, without naming it", () => {
    const note = limitedTrainingNote(1);
    expect(note).toBe(
      "Rezultatul este orientativ: antrenarea are o singură lună cu minimum " +
        "50 de curse.",
    );
    // Must not guess/name a month (the sparse last month is not the evidence month).
    expect(note).not.toMatch(/\b(Ianuarie|Februarie|Martie|Aprilie|Mai|Iunie|Iulie|August|Septembrie|Octombrie|Noiembrie|Decembrie)\b/);
  });

  it("shows no caution once there are two or more evidence months", () => {
    expect(limitedTrainingNote(2)).toBeNull();
    expect(limitedTrainingNote(3)).toBeNull();
  });
});
