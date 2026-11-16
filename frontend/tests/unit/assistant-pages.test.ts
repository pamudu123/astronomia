import { describe, expect, it } from "vitest";

import { combine } from "@/components/assistant/Assistant";
import { pageKey } from "@/lib/assistant/context";
import type { BabyLetters } from "@/lib/babynames";
import type { Hadahan, Labels, Place } from "@/lib/hadahan";
import type { KendaraResult } from "@/lib/kendara";
import type { Avurudu, Panchanga } from "@/lib/nakath";
import type { Wedding } from "@/lib/wedding";
import {
  avuruduContext,
  babyLettersContext,
  chartContext,
  dayContext,
  kendaraContext,
  weddingContext,
} from "@/lib/assistant/pages";

import baby from "../e2e/fixtures/baby-birth-en.json";
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

describe("other pages", () => {
  it("shares the day's times with the place id, so the assistant can look up more", () => {
    const summary = dayContext(panchanga as unknown as Panchanga, null, "en").result as Record<string, unknown>;
    expect(summary.date).toBe("2027-04-14");
    expect(summary.place_id).toEqual(expect.any(Number));
    expect(String(summary.rahu_kalaya)).toMatch(/^\d\d:\d\d to \d\d:\d\d/);
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
