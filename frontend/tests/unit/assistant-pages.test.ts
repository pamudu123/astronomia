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
