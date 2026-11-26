import { describe, expect, it } from "vitest";

import { combine } from "@/components/assistant/Assistant";
import { pageKey } from "@/lib/assistant/context";
import type { Hadahan, Labels, Place } from "@/lib/hadahan";
import type { KendaraResult } from "@/lib/kendara";
import type { Avurudu, Panchanga } from "@/lib/nakath";
import type { Wedding } from "@/lib/wedding";
import {
  avuruduContext,
  chartContext,
  chartReadingContext,
  dayContext,
  kendaraContext,
  weddingContext,
  weddingSearchContext,
} from "@/lib/assistant/pages";

import hadahan from "../e2e/fixtures/hadahan-en.json";
import avurudu2027London from "../e2e/fixtures/avurudu-2027-london-en.json";
import avurudu2028 from "../e2e/fixtures/avurudu-2028-colombo-en.json";
import kendara from "../e2e/fixtures/kendara-en.json";
import labelsEn from "../e2e/fixtures/labels-en.json";
import panchanga from "../e2e/fixtures/panchanga-2027-04-14-colombo-en.json";
import wedding from "../e2e/fixtures/wedding-quick-en.json";

const labels = labelsEn as unknown as Labels;

type AvuruduSummary = {
  year: number;
  time_zone_shown: string;
  calculated: { new_year_dawn: Record<string, string> };
  official: string | { source: string | null; times: { custom: string }[] };
};

/** The official part, when the year has a list. */
const officialList = (summary: AvuruduSummary) => {
  if (typeof summary.official === "string") throw new Error("no official list");
  return summary.official;
};
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

describe("chartReadingContext", () => {
  type Reading = {
    life_period_timeline: { later_periods: { period: string; sub_periods: unknown[] }[] };
    mars_check: { present: boolean; reasons: string[]; checks: { rule: string; applies: boolean }[] };
  };
  const reading = chartReadingContext(chart, labels, "en").result as unknown as Reading;

  it("lists every later life period with its own sub-periods", () => {
    const now = chart.dasha!.current[0];
    const index = chart.dasha!.periods.findIndex((p) => p.start === now.start);
    const later = reading.life_period_timeline.later_periods;
    expect(later).toHaveLength(chart.dasha!.periods.length - index - 1);
    for (const period of later) expect(period.sub_periods).toHaveLength(9);
  });

  it("gives the Mars check's reasons and each cancelling rule by name", () => {
    expect(reading.mars_check.reasons).toEqual(chart.kuja!.reasons);
    expect(reading.mars_check.checks).toHaveLength(chart.kuja!.cancellations.length);
    for (const check of reading.mars_check.checks) expect(check.rule).not.toMatch(/^[a-z_]+$/);
  });

  it("still never shares the birth date, time or place", () => {
    const text = JSON.stringify(chartReadingContext(chart, labels, "en"));
    for (const detail of birthDetails(chart)) expect(text).not.toContain(detail);
  });

  it("fits well inside the agent's 40 KB limit for facts (agent/app/explain.py)", () => {
    const bytes = new TextEncoder().encode(JSON.stringify(chartReadingContext(chart, labels, "en"))).length;
    expect(bytes).toBeLessThan(20_000);
  });

  it("keeps the chat's summary otherwise", () => {
    const chat = chartContext(chart, labels, "en").result as Record<string, unknown>;
    const full = chartReadingContext(chart, labels, "en", true);
    expect(full.shared).toBe(true);
    expect((full.result as Record<string, unknown>).houses).toEqual(chat.houses);
  });
});

describe("other pages", () => {
  it("shares the day's times with the place id, so the assistant can look up more", () => {
    const summary = dayContext(panchanga as unknown as Panchanga, null, "en").result as Record<string, unknown>;
    expect(summary.date).toBe("2027-04-14");
    expect(summary.place_id).toEqual(expect.any(Number));
    expect(String(summary.rahu_kalaya)).toMatch(/^\d\d:\d\d to \d\d:\d\d/);
  });

  it("says when the date never happened at the place", () => {
    const day = panchanga as unknown as Panchanga;
    const note = "This date did not happen here.";
    const skipped = { ...day, sunrise: null, sunset: null, rahu_kalaya: null, thithi: [], nakatha: [], skipped: true, skipped_note: note };
    expect(dayContext(skipped, null, "en").result).toMatchObject({ skipped_date: note, sunrise: null });
    expect(dayContext(day, null, "en").result).not.toHaveProperty("skipped_date");
  });

  it("names the day's own place and time zone, not a place picked but not loaded yet", () => {
    // QA follow-up: the picker held London while Colombo's day was still on screen.
    const day = panchanga as unknown as Panchanga;
    const london = { id: 2643743, name: "London", timezone: "Europe/London" } as Place;
    const summary = dayContext(day, london, "en").result as Record<string, unknown>;
    expect(summary).toMatchObject({ place: "Colombo", place_id: 1248991, timezone: "Asia/Colombo" });
    const colombo = { id: 1248991, name: "Colombo (picked)", timezone: "Asia/Colombo" } as Place;
    const unnamed = { ...day, place: { ...day.place, name: null } };
    expect((dayContext(unnamed, colombo, "en").result as Record<string, unknown>).place).toBe("Colombo (picked)");
  });

  it("gives the calculated new year dawn for a year without an official list", () => {
    // QA ASTRO-03: Astro said no dawn time was available for 2028.
    const summary = avuruduContext(avurudu2028 as unknown as Avurudu, "en").result as AvuruduSummary;
    expect(summary.year).toBe(2028);
    expect(summary.time_zone_shown).toBe("Asia/Colombo");
    expect(summary.calculated.new_year_dawn).toEqual({ sri_lanka: "21:44 on 2028-04-13" });
    expect(summary.official).toBe("no official list published for this year yet");
  });

  it("gives official and calculated times apart, in the zone the times were fetched in", () => {
    const data = avurudu2027London as unknown as Avurudu;
    const summary = avuruduContext(data, "en").result as AvuruduSummary;
    expect(summary.time_zone_shown).toBe("Europe/London");
    expect(summary.calculated.new_year_dawn).toEqual({
      sri_lanka: `${data.calculated.dawn.sri_lanka.clock} on ${data.calculated.dawn.sri_lanka.date}`,
      "Europe/London": `${data.calculated.dawn.local.clock} on ${data.calculated.dawn.local.date}`,
    });
    const official = officialList(summary);
    expect(official.source).toBe(data.source);
    expect(official.times).toHaveLength(data.items.length);
    expect(official.times[0].custom).toBe(data.items[0].name);
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

describe("the wedding dates search, for Astro (QA-03)", () => {
  const names = { engagement: "Engagement", poruwa: "Poruwa ceremony", homecoming: "Homecoming" };
  const kandy = { id: 1, name: "Kandy", timezone: "Asia/Colombo" } as Place;

  it("says a search is running, and for what", () => {
    const context = weddingSearchContext("running", { months: 6, ceremonies: ["engagement", "poruwa"], place: kandy }, null, "en", names);
    expect(pageKey(context.page)).toBe("wedding");
    expect(context.result).toMatchObject({
      status: expect.stringContaining("running now"),
      months_ahead: 6,
      ceremonies: ["Engagement", "Poruwa ceremony"],
      place: "Kandy",
    });
    expect(context.result).not.toHaveProperty("dates_already_on_screen");
  });

  it("says a search did not finish, with the dates still on screen", () => {
    const context = weddingSearchContext(
      "failed",
      { months: 24, ceremonies: ["poruwa"], place: null },
      wedding as unknown as Wedding,
      "en",
      names,
    );
    const result = context.result as Record<string, unknown>;
    expect(result.status).toContain("did not finish");
    expect(result.place).toContain("Colombo");
    expect(result.dates_already_on_screen).toEqual(weddingContext(wedding as unknown as Wedding, "en").result);
  });
});
