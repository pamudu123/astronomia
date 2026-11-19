import { describe, expect, it } from "vitest";

import { type Placement, combinations, relation, seventhLord } from "@/lib/assistant/chartFacts";
import {
  chartExtrasContext,
  chartReadingContext,
  coupleYearsContext,
  matchReadingContext,
  sriLankaDay,
  weddingReadingContext,
} from "@/lib/assistant/pages";
import type { Upcoming } from "@/lib/changes";
import type { Hadahan, Labels } from "@/lib/hadahan";
import type { Journey } from "@/lib/journey";
import type { Porondam, Timeline } from "@/lib/porondam";
import type { Wedding } from "@/lib/wedding";

import upcomingFixture from "../e2e/fixtures/changes-personal-en.json";
import hadahan from "../e2e/fixtures/hadahan-en.json";
import labelsEn from "../e2e/fixtures/labels-en.json";
import porondamFull from "../e2e/fixtures/porondam-full-en.json";
import timelineFull from "../e2e/fixtures/timeline-full-en.json";
import timelineQuick from "../e2e/fixtures/timeline-quick-en.json";
import weddingQuick from "../e2e/fixtures/wedding-quick-en.json";
import weddingQuickSi from "../e2e/fixtures/wedding-quick-si.json";

const labels = labelsEn as unknown as Labels;
const chart = hadahan as unknown as Hadahan;

/** A chart with every planet in house 1 unless placed elsewhere. */
function placed(houses: Record<string, number>): Placement[] {
  const bodies = ["sun", "moon", "mars", "mercury", "jupiter", "venus", "saturn", "rahu", "ketu"];
  return bodies.map((body) => ({ body, sign: "mesha", house: houses[body] ?? 1 }));
}

const names = (planets: Placement[]) =>
  combinations({ planets }, labels).map((c) => (c as { name: string }).name);

describe("planet friendship", () => {
  it("follows the classical table, both ways", () => {
    expect(relation("sun", "moon")).toBe("friends");
    expect(relation("saturn", "sun")).toBe("enemies");
    expect(relation("jupiter", "saturn")).toBe("neutral");
    // The Moon counts Mercury a friend; Mercury counts the Moon an enemy.
    expect(relation("moon", "mercury")).toBe("mixed");
    expect(relation("venus", "venus")).toBe("same planet");
  });

  it("finds the ruler of the 7th house from the rising sign", () => {
    expect(seventhLord("simha")).toBe("saturn"); // Kumbha
    expect(seventhLord("mesha")).toBe("venus"); // Tula
    expect(seventhLord("nowhere")).toBeNull();
  });
});

describe("the new combinations", () => {
  it("finds the relationship pairs", () => {
    const found = names(placed({ sun: 5, venus: 5, mars: 9, saturn: 9, moon: 3, jupiter: 3 }));
    expect(found).toContain("Ravi-Sukra yoga");
    expect(found).toContain("Shani-Mangala yoga");
    expect(found).not.toContain("Kuja-Sukra yoga");
  });

  it("finds planets beside the Moon, but not the Sun, Rahu or Ketu", () => {
    expect(names(placed({ moon: 4, jupiter: 5, sun: 3 }))).toContain("Sunapha yoga");
    expect(names(placed({ moon: 4, venus: 3 }))).toContain("Anapha yoga");
    expect(names(placed({ moon: 4, venus: 3, mercury: 5 }))).toContain("Durudhara yoga");
    const lonely = placed({ moon: 4, sun: 3, rahu: 5, ketu: 11, mars: 8, mercury: 8, jupiter: 8, venus: 8, saturn: 8 });
    expect(names(lonely).some((n) => /Sunapha|Anapha|Durudhara/.test(n))).toBe(false);
  });

  it("finds hemming of the 7th house, by hard or gentle planets", () => {
    const hard = combinations({ planets: placed({ saturn: 6, mars: 8, moon: 10, jupiter: 10 }) }, labels);
    expect(hard).toContainEqual({ name: "Papa Kartari", based_on: "hard planets on both sides of the 7th house (marriage and partnership)" });
    const gentle = names(placed({ venus: 6, jupiter: 8, moon: 10 }));
    expect(gentle).toContain("Shubha Kartari");
  });
});

describe("chartReadingContext with the birth table", () => {
  it("adds the almanac at birth and the star's groups by name, with no time", () => {
    // A birth before sunrise: the Sinhala day is Tuesday, the calendar date a Wednesday.
    const withTable = {
      ...chart,
      birth_table: {
        weekday: { key: "tuesday", name: "Tuesday" },
        calendar_weekday: { key: "wednesday", name: "Wednesday" },
        thithi: { key: "krishna_5", name: "Dark 5" },
        yoga: { key: "siddhi", name: "Siddhi" },
        karana: { key: "taitila", name: "Taitila" },
        star: { gana: { key: "rakshasa", name: "Rakshasa" }, yoni: { key: "deer", name: "deer" } },
        rule_sets: ["panchanga_v1", "porondam_si_v3"],
        provisional: true,
      },
    } as unknown as Hadahan;
    const result = chartReadingContext(withTable, labels, "en").result as { birth_table: unknown };
    expect(result.birth_table).toEqual({
      weekday: "Tuesday",
      calendar_weekday: "Wednesday",
      thithi: "Dark 5",
      yoga: "Siddhi",
      karana: "Taitila",
      star_groups: { gana: "Rakshasa", yoni: "deer" },
      provisional: true,
    });
  });
});

describe("care periods", () => {
  it("names the running sub-period when its planet rules the 8th house", () => {
    // The fixture: Simha rising, so Meena is the 8th house and Jupiter rules it. The running
    // sub-period is Jupiter's; the next is Saturn's, which neither rules nor sits in the 8th.
    const result = chartReadingContext(chart, labels, "en").result as { care_periods: unknown[] };
    expect(result.care_periods).toEqual([
      {
        when: "now",
        main_period: "Sun",
        sub: "Jupiter",
        from: "2026-05-02",
        until: "2027-02-18",
        because: "rules the 8th house",
      },
    ]);
  });
});

describe("chartExtrasContext", () => {
  const base = chartReadingContext(chart, labels, "en");
  const journey = {
    now: "2026-11-18T00:00:00Z",
    provisional: true,
    erashtaka: [
      { start: "2012-01-01T00:00:00Z", end: "2019-07-01T00:00:00Z" },
      { start: "2025-03-29T00:00:00Z", end: "2032-06-01T00:00:00Z" },
      { start: "2041-01-01T00:00:00Z", end: "2048-07-01T00:00:00Z" },
    ],
    guru_returns: [{ start: "2030-05-01T00:00:00Z", end: "2031-05-01T00:00:00Z" }],
    erashtaka_lagna: [{ start: "2034-07-13T00:00:00Z", end: "2041-01-01T00:00:00Z" }],
  } as unknown as Journey;

  it("marks each Saturn period past, now or ahead, by date only", () => {
    const result = chartExtrasContext(base, { journey }).result as {
      saturn_erashtaka: { from: string; until: string; state: string }[];
      jupiter_returns: unknown[];
    };
    expect(result.saturn_erashtaka.map((s) => s.state)).toEqual(["past", "now", "ahead"]);
    expect(result.saturn_erashtaka[1]).toEqual({ from: "2025-03-29", until: "2032-06-01", state: "now" });
    expect(result.jupiter_returns).toHaveLength(1);
  });

  it("adds Saturn's periods counted from the rising sign too", () => {
    const result = chartExtrasContext(base, { journey }).result as {
      saturn_erashtaka_from_rising_sign: { from: string; state: string }[];
    };
    expect(result.saturn_erashtaka_from_rising_sign).toEqual([
      { from: "2034-07-13", until: "2041-01-01", state: "ahead" },
    ]);
  });

  it("never sends a date taken from the birth, and leaves out stays cut at the road's end", () => {
    const born = {
      ...journey,
      birth: "1995-04-19T09:05:00Z",
      end: "2095-04-19T09:05:00Z",
      // A rising-sign stay already running at birth, and a Moon one cut where the road ends.
      erashtaka_lagna: [{ start: "1995-04-19T09:05:00Z", end: "1997-06-01T00:00:00Z" }],
      erashtaka: [{ start: "2092-03-01T00:00:00Z", end: "2095-04-19T09:05:00Z" }],
    } as unknown as Journey;
    const result = chartExtrasContext(base, { journey: born });
    const facts = result.result as {
      saturn_erashtaka_from_rising_sign: { from: string; until: string }[];
      saturn_erashtaka: { from: string; until: string }[];
    };
    expect(facts.saturn_erashtaka_from_rising_sign[0]).toMatchObject({
      from: "already running at birth",
      until: "1997-06-01",
    });
    // A stay cut where the road ends is left out: naming the road's end sounds like a lifespan.
    expect(facts.saturn_erashtaka).toEqual([]);
    expect(JSON.stringify(result)).not.toContain("1995-04-19");
    expect(JSON.stringify(result)).not.toContain("2095-04-19");
  });

  it("dates the Sun's months in Sri Lanka time (review on #52)", () => {
    // 19:00 UTC on 16 November is already 17 November in Sri Lanka.
    expect(sriLankaDay("2026-11-16T19:00:00Z")).toBe("2026-11-17");
    expect(sriLankaDay("2026-11-16T18:00:00Z")).toBe("2026-11-16");
  });

  it("adds the Sun's months with their houses", () => {
    const upcoming = {
      ...(upcomingFixture as object),
      sun_months: [
        { sign: "tula", sign_name: "Tula", start: "2026-11-13T00:00:00Z", end: "2026-11-16T10:00:00Z", house_from_lagna: 3, house_from_moon: 12 },
        { sign: "vrischika", sign_name: "Vrischika", start: "2026-11-16T10:00:00Z", end: "2026-12-16T00:00:00Z", house_from_lagna: 4, house_from_moon: 1 },
      ],
    } as unknown as Upcoming;
    const result = chartExtrasContext(base, { upcoming }).result as { sun_months_ahead: unknown[] };
    expect(result.sun_months_ahead).toEqual([
      { sign: "Tula", from: "2026-11-13", until: "2026-11-16", house_from_rising_sign: 3, house_from_moon_sign: 12 },
      { sign: "Vrischika", from: "2026-11-16", until: "2026-12-16", house_from_rising_sign: 4, house_from_moon_sign: 1 },
    ]);
  });

  it("adds the planet changes ahead, counted from the rising sign and the Moon sign", () => {
    const upcoming = upcomingFixture as unknown as Upcoming;
    const result = chartExtrasContext(base, { upcoming }).result as {
      planet_changes_ahead: { change: string; from_rising_sign: { moves: unknown[] } }[];
    };
    expect(result.planet_changes_ahead).toHaveLength(upcoming.changes.length);
    expect(result.planet_changes_ahead[0].change).toBe("Rahu and Ketu change");
    expect(result.planet_changes_ahead[0].from_rising_sign.moves).toHaveLength(2);
  });

  it("keeps everything else, and never adds the birth itself", () => {
    const result = chartExtrasContext(base, { journey: { ...journey, birth: "1995-04-19T09:05:00Z" } as Journey });
    expect((result.result as Record<string, unknown>).houses).toEqual((base.result as Record<string, unknown>).houses);
    expect(JSON.stringify(result)).not.toContain("1995-04-19");
  });
});

describe("matchReadingContext", () => {
  const full = porondamFull as unknown as Porondam;

  it("gives the factors by the page's themes, with the page's counts", () => {
    const result = matchReadingContext(full, labels, "en").result as {
      factor_themes: { theme: string; agree: number; counted: number; factors: string[] }[];
    };
    const themes = labels.porondam_theme!;
    expect(result.factor_themes.map((t) => t.theme)).toEqual(Object.values(themes).map((t) => t.name));
    // The counts add up to the match's own score.
    const agree = result.factor_themes.reduce((sum, t) => sum + t.agree, 0);
    const counted = result.factor_themes.reduce((sum, t) => sum + t.counted, 0);
    expect({ agree, counted }).toEqual({ agree: full.match!.score.passed, counted: full.match!.score.total });
    expect(result.factor_themes[0].factors).toContain("Nakath");
  });

  it("gives each person's Mars check with its reasons and rules", () => {
    const result = matchReadingContext(full, labels, "en").result as {
      mars_check: { bride: { reasons: string[]; checks: { rule: string }[] }; comparison: string };
    };
    expect(result.mars_check.bride.reasons).toEqual(full.kuja!.bride.reasons);
    expect(result.mars_check.bride.checks).toHaveLength(full.kuja!.bride.cancellations.length);
    expect(result.mars_check.comparison).toBe(full.kuja!.reason);
  });

  it("says full birth details are needed when the placements are missing", () => {
    const result = matchReadingContext(full, labels, "en").result as Record<string, unknown>;
    expect(result.marriage_in_each_chart).toBe("needs full birth details for both people");
    // The rising signs alone are enough for the two 7th-house rulers.
    expect(result.seventh_lords).toMatchObject({ bride: "Saturn", groom: "Saturn", relation: "same planet" });
  });

  it("gives each chart's 7th house, Venus and combinations with full details", () => {
    const withPlacements = {
      ...full,
      bride: { ...full.bride, placements: placed({ venus: 7, sun: 7, saturn: 6, mars: 8 }) },
      groom: { ...full.groom, placements: placed({ venus: 2 }) },
    } as unknown as Porondam;
    const result = matchReadingContext(withPlacements, labels, "en").result as {
      marriage_in_each_chart: { bride: Record<string, unknown> };
    };
    const bride = result.marriage_in_each_chart.bride;
    expect(bride.seventh_house_sign).toBe("Kumbha");
    expect(bride.seventh_lord).toBe("Saturn");
    expect(bride.seventh_lord_in_house).toBe(6);
    expect(bride.planets_in_seventh).toEqual(["Sun", "Venus"]);
    expect(bride.venus).toEqual({ sign: "Mesha", house: 7 });
    const found = (bride.combinations as { name: string }[]).map((c) => c.name);
    expect(found).toContain("Ravi-Sukra yoga");
    expect(found).toContain("Papa Kartari");
  });
});

describe("coupleYearsContext", () => {
  const base = matchReadingContext(porondamFull as unknown as Porondam, labels, "en");
  type Years = {
    window: { from: string; until: string };
    bride: {
      birth_details: string;
      life_periods: { period: string; from: string; until: string; sub_periods: { from: string }[] }[];
      saturn: unknown[];
    };
    groom: { saturn: unknown[] };
    saturn_for_both: unknown[];
  };
  const years = (timeline: unknown) =>
    (coupleYearsContext(base, timeline as Timeline, labels).result as { years_ahead: Years }).years_ahead;

  it("gives each person's periods in the ten-year window, by name", () => {
    const y = years(timelineFull.timeline);
    expect(y.window).toEqual({ from: "2026-11-12", until: "2036-11-12" });
    expect(y.bride.life_periods.map((p) => p.period)).toEqual(["Sun", "Moon"]);
    expect(y.bride.life_periods[1].from).toBe("2030-04-13");
    expect(y.groom.saturn).toHaveLength(4);
  });

  it("never gives the start of a period that began before the window", () => {
    // It could be the birth date: the first life period starts at birth.
    const first = years(timelineFull.timeline).bride.life_periods[0];
    expect(first.from).toBe("before this window");
    expect(JSON.stringify(years(timelineFull.timeline))).not.toContain("2024-04-13");
    // Sub-periods are cut to the window too.
    expect(first.sub_periods.every((s) => s.from >= "2026-11-12")).toBe(true);
  });

  it("works with birth stars only: Saturn, no life periods", () => {
    const y = years(timelineQuick.timeline);
    expect(y.bride.birth_details).toBe("quick");
    expect(y.bride.life_periods).toEqual([]);
    expect(y.saturn_for_both).toHaveLength(1);
  });
});

describe("weddingReadingContext", () => {
  it("adds the dates found to the match facts", () => {
    const base = matchReadingContext(porondamFull as unknown as Porondam, labels, "en");
    const result = weddingReadingContext(base, weddingQuick as unknown as Wedding).result as {
      wedding_dates_found: { ceremonies: { ceremony: string; dates: unknown[] }[] };
      score: unknown;
    };
    expect(result.wedding_dates_found.ceremonies.map((c) => c.ceremony)).toEqual([
      "Engagement",
      "Poruwa ceremony",
      "Homecoming",
    ]);
    expect(result.wedding_dates_found.ceremonies[1].dates).toHaveLength(5);
    expect(result.score).toBeTruthy(); // the match facts stay
  });
});

describe("the wedding chapter's facts", () => {
  it("stay well inside the agent's 40 KB limit, even in Sinhala", () => {
    const porondamSi = { ...(porondamFull as unknown as Porondam) };
    const base = matchReadingContext(porondamSi, labels, "si");
    const bytes = (value: unknown) => new TextEncoder().encode(JSON.stringify(value)).length;
    const si = weddingReadingContext(base, weddingQuickSi as unknown as Wedding);
    expect(bytes(si)).toBeLessThan(25_000);
  });
});
