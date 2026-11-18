import { describe, expect, it } from "vitest";

import { type Placement, combinations, relation, seventhLord } from "@/lib/assistant/chartFacts";
import { chartExtrasContext, chartReadingContext, matchReadingContext } from "@/lib/assistant/pages";
import type { Upcoming } from "@/lib/changes";
import type { Hadahan, Labels } from "@/lib/hadahan";
import type { Journey } from "@/lib/journey";
import type { Porondam } from "@/lib/porondam";

import upcomingFixture from "../e2e/fixtures/changes-personal-en.json";
import hadahan from "../e2e/fixtures/hadahan-en.json";
import labelsEn from "../e2e/fixtures/labels-en.json";
import porondamFull from "../e2e/fixtures/porondam-full-en.json";

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
    const withTable = {
      ...chart,
      birth_table: {
        weekday: { key: "wednesday", name: "Wednesday" },
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
      weekday: "Wednesday",
      thithi: "Dark 5",
      yoga: "Siddhi",
      karana: "Taitila",
      star_groups: { gana: "Rakshasa", yoni: "deer" },
      provisional: true,
    });
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
