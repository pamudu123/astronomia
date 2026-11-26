import { describe, expect, it } from "vitest";

import {
  type Journey,
  buildRoad,
  hasToday,
  fadeAt,
  mistAt,
  periodAt,
  qualityAt,
  roadWord,
  stopBeside,
  stopNear,
  subAt,
  withToday,
  yearAt,
} from "@/lib/journey";

const period = (lord: string, start: string, end: string, tone: "good" | "mixed" | "careful") => ({
  lord,
  start,
  end,
  house: 4,
  theme: "home and peace of mind",
  tone,
  sub: [{ lord, start, end, house: 4, theme: "home and peace of mind", tone }],
});

const JOURNEY = {
  rule_set: "journey_v1",
  provisional: true,
  birth: "2000-01-01T00:00:00Z",
  end: "2100-01-01T00:00:00Z",
  now: "2026-01-01T00:00:00Z",
  periods: [
    period("moon", "1996-01-01T00:00:00Z", "2006-01-01T00:00:00Z", "good"),
    period("mars", "2006-01-01T00:00:00Z", "2013-01-01T00:00:00Z", "careful"),
    period("rahu", "2013-01-01T00:00:00Z", "2101-01-01T00:00:00Z", "mixed"),
  ],
  erashtaka: [{ start: "2020-01-01T00:00:00Z", end: "2027-07-01T00:00:00Z" }],
  guru_returns: [],
  stops: [
    { kind: "birth", at: "2000-01-01T00:00:00Z", tone: "good", lord: "moon", title: "The road begins", text: "" },
    { kind: "period", at: "2006-01-01T00:00:00Z", tone: "careful", lord: "mars", title: "Mars", text: "" },
    { kind: "onward", at: "2096-01-01T00:00:00Z", tone: "good", title: "The road goes on", text: "" },
  ],
  quality: { step_days: 365.25, values: Array.from({ length: 101 }, (_, year) => (year < 6 ? 0.8 : -0.6)) },
} as unknown as Journey;

const road = buildRoad(JOURNEY);

describe("the life road", () => {
  it("starts every period at birth or later, in years of age", () => {
    expect(road.periods[0].s).toBe(0);
    expect(road.periods[1].s).toBeCloseTo(6, 1);
    expect(periodAt(road, 3).lord).toBe("moon");
    expect(periodAt(road, 7).lord).toBe("mars");
    expect(subAt(road, 50).lord).toBe("rahu");
    expect(yearAt(road, 26.5)).toBe(2026);
  });

  it("reads the quality between its yearly values", () => {
    expect(qualityAt(road, 2)).toBeCloseTo(0.8);
    expect(qualityAt(road, 5.5)).toBeCloseTo(0.1);
    expect(roadWord(0.8)).toEqual({ word: "clear", tone: "good" });
    expect(roadWord(-0.6)).toEqual({ word: "hard", tone: "careful" });
  });

  it("is misty inside Erashtaka only", () => {
    expect(mistAt(road, 23)).toBe(1);
    expect(mistAt(road, 10)).toBe(0);
  });

  it("fades from 92 and can be travelled to the last stop only", () => {
    expect(fadeAt(80)).toBe(0);
    expect(fadeAt(100)).toBe(1);
    expect(road.last).toBeCloseTo(96, 1);
  });

  it("finds the stop at hand and the ones beside it", () => {
    expect(stopNear(road, 6.2)?.kind).toBe("period");
    expect(stopNear(road, 40)).toBeNull();
    expect(stopBeside(road, 6, 1)?.kind).toBe("onward");
    expect(stopBeside(road, 6, -1)?.kind).toBe("birth");
  });

  it("adds a stop for today", () => {
    const withNow = withToday(road, "Today", "text");
    const today = withNow.stops.find((stop) => stop.kind === "today");
    expect(today?.y).toBeCloseTo(26, 1);
    expect(today?.tone).toBe("mixed");
  });

  const at = (now: string) => buildRoad({ ...JOURNEY, now });
  const todayIn = (built: typeof road) => withToday(built, "Today", "text").stops.find((stop) => stop.kind === "today");

  it("has no today before the birth, and opens at the birth (A-06)", () => {
    const before = at("1999-06-01T00:00:00Z");
    expect(hasToday(before)).toBe(false);
    expect(todayIn(before)).toBeUndefined();
    expect(before.today).toBe(0);
    expect(stopNear(before, before.today)?.kind).toBe("birth");
  });

  it("has a today at the birth itself, and the birth stop can still be reached", () => {
    const born = at("2000-01-01T00:00:00Z");
    expect(todayIn(born)?.y).toBe(0);
    const later = withToday(at("2000-02-01T00:00:00Z"), "Today", "text");
    expect(stopNear(later, later.today)?.kind).toBe("today");
    expect(stopNear(later, 0)?.kind).toBe("birth");
    expect(stopBeside(later, 0, 1)?.kind).toBe("today");
  });

  it("has no today past the last stop, and opens there", () => {
    const after = at("2097-01-01T00:00:00Z");
    expect(hasToday(after)).toBe(false);
    expect(todayIn(after)).toBeUndefined();
    expect(after.today).toBe(after.last);
  });
});
