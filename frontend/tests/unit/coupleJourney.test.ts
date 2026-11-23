import { describe, expect, it } from "vitest";

import {
  type CoupleWords,
  ageOf,
  bothFull,
  buildCouple,
  coupleHasToday,
  coupleYear,
  mistOf,
  periodOf,
  phaseAt,
  qualityOf,
} from "@/lib/coupleJourney";
import { type Journey, stopBeside, stopNear } from "@/lib/journey";

const WORDS: CoupleWords = {
  today: { title: "Today", text: "From here, together." },
  bothMist: { title: "Erashtaka for both", text: "Until {to}.", helps: "Plan slowly." },
};

/** A road a hundred years long with one period, one Erashtaka and the same quality all the way. */
function journey(born: number, lord: string, quality: number, mist: [number, number], now = "2026-01-01T00:00:00Z") {
  const iso = (year: number) => `${year}-01-01T00:00:00Z`;
  const period = { lord, start: iso(born - 2), end: iso(born + 101), house: 4, theme: "home", tone: "good" };
  return {
    rule_set: "journey_v1",
    provisional: true,
    birth: iso(born),
    end: iso(born + 100),
    now,
    periods: [{ ...period, sub: [period] }],
    erashtaka: [{ start: iso(mist[0]), end: iso(mist[1]) }],
    guru_returns: [],
    stops: [
      { kind: "birth", at: iso(born), tone: "good", lord, title: "The road begins", text: "" },
      { kind: "erashtaka_start", at: iso(mist[0]), tone: "careful", lord: "saturn", title: "Erashtaka begins", text: "" },
      { kind: "onward", at: iso(born + 96), tone: "good", title: "The road goes on", text: "" },
    ],
    quality: { step_days: 365.25, values: Array.from({ length: 101 }, () => quality) },
  } as unknown as Journey;
}

// The groom is four years older, so a place on the shared road is his age.
const bride = journey(1996, "venus", 0.6, [2028, 2034]);
const groom = journey(1992, "rahu", -0.6, [2030, 2037]);
const couple = buildCouple(bride, groom, WORDS)!;

describe("the couple's road", () => {
  it("counts places from the elder's birth", () => {
    expect(couple.offset.groom).toBe(0);
    expect(couple.offset.bride).toBeCloseTo(4, 1);
    expect(couple.today).toBeCloseTo(34, 1);
    expect(ageOf(couple, "bride", couple.today)).toBeCloseTo(30, 1);
    expect(coupleYear(couple, 34.5)).toBe(2026);
  });

  it("runs from ten years back to the elder's last stop", () => {
    expect(couple.start).toBeCloseTo(24, 1);
    expect(couple.last).toBeCloseTo(96, 1);
    expect(couple.stops[couple.stops.length - 1]).toMatchObject({ kind: "onward", who: "both" });
  });

  it("reads each person's own road at a place", () => {
    expect(qualityOf(couple, "bride", 40)).toBeCloseTo(0.6);
    expect(qualityOf(couple, "groom", 40)).toBeCloseTo(-0.6);
    expect(periodOf(couple, "bride", 40).lord).toBe("venus");
    expect(mistOf(couple, "bride", 37)).toBe(1);
    expect(mistOf(couple, "groom", 37)).toBe(0);
    expect(phaseAt(couple, 40)).toEqual({ phase: "groom_hard", tone: "mixed" });
  });

  it("keeps each person's stops, and leaves out their births", () => {
    const kinds = couple.stops.map((stop) => `${stop.who}:${stop.kind}`);
    expect(kinds).toEqual([
      "both:today",
      "bride:erashtaka_start",
      "groom:erashtaka_start",
      "both:both_mist",
      "both:onward",
    ]);
    expect(stopNear(couple, couple.today)?.kind).toBe("today");
    expect(stopBeside(couple, couple.today, 1)?.who).toBe("bride");
  });

  it("marks where both are in Erashtaka at once", () => {
    expect(couple.bothMist).toHaveLength(1);
    expect(couple.bothMist[0][0]).toBeCloseTo(38, 1);
    expect(couple.bothMist[0][1]).toBeCloseTo(42, 1);
    const stop = couple.stops.find((item) => item.kind === "both_mist");
    expect(stop).toMatchObject({ tone: "careful", text: "Until 2034.", helps: "Plan slowly." });
  });

  it("has nothing to draw when today is past the end of the elder's road", () => {
    expect(buildCouple(bride, journey(1920, "moon", 0, [1950, 1957]), WORDS)).toBeNull();
  });

  it("has no today while one of them is still to be born, and opens where the road begins (A-06)", () => {
    const unborn = buildCouple(journey(2000, "venus", 0.6, [2040, 2047]), journey(2030, "rahu", 0, [2060, 2067]), WORDS)!;
    expect(unborn.today).toBeCloseTo(26, 1);
    expect(unborn.start).toBeCloseTo(30, 1);
    expect(unborn.open).toBe(unborn.start);
    expect(coupleHasToday(unborn)).toBe(false);
    expect(unborn.stops.map((stop) => stop.kind)).not.toContain("today");
    expect(unborn.stops.every((stop) => stop.y >= unborn.start)).toBe(true);
  });

  it("has no today when both are still to be born", () => {
    const both = buildCouple(journey(2030, "venus", 0.6, [2040, 2047]), journey(2032, "rahu", 0, [2060, 2067]), WORDS)!;
    expect(coupleHasToday(both)).toBe(false);
    expect(both.open).toBeCloseTo(2, 1);
  });

  it("has a today on the day the younger one is born", () => {
    const now = "2030-01-01T00:00:00Z";
    const born = buildCouple(journey(2000, "venus", 0.6, [2040, 2047], now), journey(2030, "rahu", 0, [2060, 2067], now), WORDS)!;
    expect(coupleHasToday(born)).toBe(true);
    expect(born.open).toBe(born.today);
    expect(born.stops[0].kind).toBe("today");
  });

  it("has nothing to draw when the two share no years", () => {
    expect(buildCouple(journey(2000, "venus", 0.6, [2040, 2047]), journey(2110, "rahu", 0, [2140, 2147]), WORDS)).toBeNull();
  });

  it("opens at today when both are born", () => {
    expect(coupleHasToday(couple)).toBe(true);
    expect(couple.open).toBe(couple.today);
  });

  it("needs a birth time for both people", () => {
    const full = { name: "", date: "1995-04-19", time: "14:35", place_id: 1 };
    const quick = { name: "", nakshatra: "rohini", pada: 1 };
    expect(bothFull({ bride: full, groom: full })).toBe(true);
    expect(bothFull({ bride: full, groom: quick })).toBe(false);
  });
});
