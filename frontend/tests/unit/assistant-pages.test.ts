import { describe, expect, it } from "vitest";

import { combine } from "@/components/assistant/Assistant";
import { pageKey } from "@/lib/assistant/context";
import type { BabyLetters } from "@/lib/babynames";
import type { Hadahan, Labels } from "@/lib/hadahan";
import type { KendaraResult } from "@/lib/kendara";
import type { Panchanga } from "@/lib/nakath";
import type { Wedding } from "@/lib/wedding";
import {
  babyLettersContext,
  chartContext,
  dayContext,
  kendaraContext,
  weddingContext,
} from "@/lib/assistant/pages";

import baby from "../e2e/fixtures/baby-birth-en.json";
import hadahan from "../e2e/fixtures/hadahan-en.json";
import kendara from "../e2e/fixtures/kendara-en.json";
import labelsEn from "../e2e/fixtures/labels-en.json";
import panchanga from "../e2e/fixtures/panchanga-2027-04-14-colombo-en.json";
import wedding from "../e2e/fixtures/wedding-quick-en.json";

const labels = labelsEn as unknown as Labels;
const chart = hadahan as unknown as Hadahan;

/** Every birth date, time and place in a result, as they could appear in a summary. */
function birthDetails(result: Hadahan): string[] {
  const resolved = result.time as unknown as Record<string, unknown>;
  const local = String(resolved.local ?? "");
  return [
    result.chart!.utc,
    local,
    local.slice(0, 10),
    String(result.chart!.latitude),
    String(result.chart!.longitude),
    result.dasha!.periods[0].start,
  ].filter((value) => value.length > 4);
}

describe("chartContext", () => {
  it("shares the signs, planets and current life period", () => {
    const context = chartContext(chart, labels, "en");
    const summary = context.result as Record<string, unknown>;
    expect(context.page).toBe("chart_result");
    expect(summary.rising_sign).toBe(labels.rashi[chart.chart!.lagna.sign].name);
    expect((summary.planets as unknown[]).length).toBe(chart.chart!.planets.length);
    expect(summary.life_period).toMatchObject({ now: expect.any(String), until: expect.any(String) });
  });

  it("never shares the birth date, time or place", () => {
    const text = JSON.stringify(chartContext(chart, labels, "en"));
    for (const detail of birthDetails(chart)) expect(text).not.toContain(detail);
  });

  it("names the next life period, and none when the current one can't be matched", () => {
    const summary = chartContext(chart, labels, "en").result as { life_period: Record<string, unknown> };
    expect(summary.life_period.next).toEqual(expect.any(String));

    const odd = structuredClone(chart);
    odd.dasha!.current[0] = { ...odd.dasha!.current[0], start: "1900-01-01T00:00:00Z" };
    const oddSummary = chartContext(odd, labels, "en").result as { life_period: Record<string, unknown> };
    expect(oddSummary.life_period.next).toBeUndefined();
  });

  it("marks someone else's shared chart", () => {
    expect(chartContext(chart, labels, "en", true).shared).toBe(true);
  });
});

// The fixture chart: Simha rising. Sun and Mercury in 9 (Mesha), Moon and Jupiter in 4
// (Vrischika), Mars in 12 (Kataka), Venus in 8 (Meena), Saturn in 7 (Kumbha).
describe("chart facts for readings", () => {
  type House = { house: number; sign: string; lord: string; lord_in_house: number; planets?: string[]; aspected_by?: string[] };
  type PlanetFact = { planet: string; strength?: string; rules_houses?: number[] };
  const summary = chartContext(chart, labels, "en").result as {
    houses: House[];
    planets: PlanetFact[];
    combinations: { name: string; based_on: string }[];
    life_period_timeline: { sub_periods?: { sub: string; from: string; until: string }[]; later_periods: unknown[] };
  };
  const house = (n: number) => summary.houses.find((h) => h.house === n)!;
  const planetFact = (name: string) => summary.planets.find((p) => p.planet === name)!;

  it("names each house's sign, its ruler, and where the ruler sits", () => {
    expect(summary.houses).toHaveLength(12);
    expect(house(1)).toMatchObject({ sign: "Simha", lord: "Sun", lord_in_house: 9 });
    expect(house(10)).toMatchObject({ sign: "Vrishabha", lord: "Venus", lord_in_house: 8 });
    expect(house(7)).toMatchObject({ sign: "Kumbha", lord: "Saturn", lord_in_house: 7, planets: ["Saturn"] });
  });

  it("lists the classical aspects on each house", () => {
    // Saturn in 7 looks at 9, 1 and 4; Jupiter in 4 at 8, 10 and 12; Mars in 12 at 3, 6 and 7.
    expect(house(1).aspected_by).toContain("Saturn");
    expect(house(10).aspected_by).toEqual(expect.arrayContaining(["Jupiter", "Moon"]));
    expect(house(7).aspected_by).toContain("Mars");
    expect(house(2).aspected_by).toEqual(["Venus"]); // Venus in 8 looks at the 7th from it
    expect(house(5).aspected_by).toBeUndefined();
  });

  it("gives each planet's strength and the houses it rules", () => {
    expect(planetFact("Saturn")).toMatchObject({ strength: "own sign", rules_houses: [6, 7] });
    expect(planetFact("Venus")).toMatchObject({ strength: "exalted", rules_houses: [3, 10] });
    expect(planetFact("Mars").strength).toBe("debilitated");
    expect(planetFact("Moon").strength).toBe("debilitated");
    expect(planetFact("Rahu").strength).toBeUndefined();
  });

  it("finds the well-known combinations, with the placements behind them", () => {
    const names = summary.combinations.map((c) => c.name);
    expect(names).toEqual(expect.arrayContaining(["Gajakesari yoga", "Budhaditya yoga", "Shasha yoga"]));
    expect(names).not.toContain("Malavya yoga"); // Venus is exalted, but in house 8, not an angle
    expect(names).not.toContain("Chandra-Mangala yoga");
  });

  it("lays out the running period's sub-periods and the periods after it", () => {
    const timeline = summary.life_period_timeline;
    expect(timeline.sub_periods).toHaveLength(9);
    expect(timeline.sub_periods![0]).toMatchObject({ sub: "Sun", from: "2024-04-13" });
    expect(timeline.later_periods).toHaveLength(2);
  });
});

describe("other pages", () => {
  it("shares the day's times with the place id, so the assistant can look up more", () => {
    const summary = dayContext(panchanga as unknown as Panchanga, null, "en").result as Record<string, unknown>;
    expect(summary.date).toBe("2027-04-14");
    expect(summary.place_id).toEqual(expect.any(Number));
    expect(String(summary.rahu_kalaya)).toMatch(/^\d\d:\d\d to \d\d:\d\d/);
  });

  it("shares a baby's star and letter but no birth details", () => {
    const result = baby as unknown as BabyLetters;
    const context = babyLettersContext(result, "en");
    const text = JSON.stringify(context);
    expect(context.page).toBe("baby_names_result");
    expect(text).toContain(result.letter!.letter);
    expect(text).not.toContain(String((result.time as unknown as Record<string, unknown>).local).slice(0, 10));
  });

  it("shares only how many old-horoscope birth times fit, not the times", () => {
    const result = kendara as unknown as KendaraResult;
    const text = JSON.stringify(kendaraContext(result, "en"));
    expect(text).toContain(`"possible_birth_times_found":${result.matches.length}`);
    for (const match of result.matches) expect(text).not.toContain(match.start.local);
  });
});

describe("pageKey", () => {
  it("names the tool for a result page or an address", () => {
    expect(pageKey("match_result")).toBe("porondam");
    expect(pageKey("chart_result")).toBe("hadahan");
    expect(pageKey("porondam/stars/rohini")).toBe("stars");
    expect(pageKey("changes/saturn-2027-06/mesha")).toBe("changes");
    expect(pageKey("litha/2026-12")).toBe("litha");
    expect(pageKey("home")).toBe("home");
  });

  it("has no tool for policy pages and share links", () => {
    expect(pageKey("privacy")).toBeNull();
    expect(pageKey("s/abc123")).toBeNull();
  });
});

describe("combine", () => {
  const match = { page: "match_result", language: "en" as const, result: { score: 1 } };
  const dates = weddingContext(wedding as unknown as Wedding, "en");

  it("adds a part of the page to the page's summary", () => {
    const combined = combine({ main: match, wedding: dates });
    expect(combined?.page).toBe("match_result");
    expect(combined?.also_on_page?.wedding).toEqual(dates.result);
  });

  it("uses the page alone when nothing else is open", () => {
    expect(combine({ main: match })).toBe(match);
    expect(combine({})).toBeNull();
  });
});
