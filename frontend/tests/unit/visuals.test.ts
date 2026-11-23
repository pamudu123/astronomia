import { existsSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { CHART_READING, CHART_TOPICS, MATCH_READING } from "@/lib/assistant/explain";
import { CHAPTER_ART, chapterPicture } from "@/lib/assistant/chapterArt";
import { CHAPTER_VISUAL, barLayout, spread, wheelLayout } from "@/lib/assistant/visuals";
import { RASHI } from "@/lib/rashi";

const gapOf = (a: number, b: number) => Math.min(((a - b) % 360 + 360) % 360, ((b - a) % 360 + 360) % 360);

describe("spread", () => {
  it("leaves planets that are far apart where they are", () => {
    expect(spread([10, 100, 200], 15)).toEqual([10, 100, 200]);
  });

  it("fans out crowded planets around where they are, keeping their order", () => {
    const shown = spread([55, 60.5, 62.2, 200], 15);
    expect(shown[0]).toBeLessThan(shown[1]);
    expect(shown[1]).toBeLessThan(shown[2]);
    expect(gapOf(shown[0], shown[1])).toBeCloseTo(15);
    expect(gapOf(shown[1], shown[2])).toBeCloseTo(15);
    expect(shown[1]).toBeCloseTo(59.23, 1); // the middle of the three moves least
    expect(shown[3]).toBe(200);
  });

  it("works across 0 degrees and shares the circle when it is too full", () => {
    const shown = spread([350, 355, 2], 15);
    expect(gapOf(shown[0], shown[1])).toBeCloseTo(15);
    expect(gapOf(shown[1], shown[2])).toBeCloseTo(15);
    const full = spread(Array.from({ length: 30 }, () => 90), 15);
    const sorted = [...full].sort((a, b) => a - b);
    sorted.slice(1).forEach((angle, i) => expect(angle - sorted[i]).toBeCloseTo(12));
  });
});

describe("wheelLayout", () => {
  it("puts the lagna on the left and counts houses from its sign", () => {
    const layout = wheelLayout(130, [{ key: "sun", label: "Su", longitude: 130 }]);
    expect(layout.planets[0].angle).toBe(180);
    expect(layout.signs[4].house).toBe(1); // Simha holds the lagna
    expect(layout.signs[3].house).toBe(12);
    expect(layout.signs[4].image).toBe("/images/glyphs/rashi-05-simha.svg");
  });
});

describe("barLayout", () => {
  it("starts at birth, marks today and the ages", () => {
    const layout = barLayout(
      "2000-01-01",
      [
        { label: "Ketu", start: "1995-01-01", end: "2005-01-01" },
        { label: "Venus", start: "2005-01-01", end: "2025-01-01", now: true },
        { label: "Sun", start: "2025-01-01", end: "2030-01-01" },
      ],
      new Date("2020-01-01"),
    );
    expect(layout.segments[0].left).toBe(0);
    expect(layout.segments[0].width).toBeCloseTo(16.67, 1);
    expect(layout.segments.at(-1)!.left + layout.segments.at(-1)!.width).toBeCloseTo(100);
    expect(layout.today).toBeCloseTo(66.67, 1);
    expect(layout.ages.map((a) => a.age)).toEqual([10, 20, 30]);
    expect(barLayout("2000-01-01", [{ label: "A", start: "2000-01-01", end: "2010-01-01" }], new Date("2030-01-01")).today).toBeNull();
  });
});

describe("CHAPTER_VISUAL", () => {
  it("names only chapters of the readings", () => {
    const known = new Set([...CHART_READING, ...CHART_TOPICS, ...MATCH_READING]);
    for (const id of Object.keys(CHAPTER_VISUAL)) expect(known.has(id as never)).toBe(true);
  });
});

describe("pictures", () => {
  const web = join(__dirname, "../../../design/assets/web");

  it("has one for every chapter of the readings, on disk", () => {
    for (const id of new Set([...CHART_READING, ...CHART_TOPICS, ...MATCH_READING])) {
      expect(existsSync(join(web, "chapters", `${CHAPTER_ART[id]}.webp`)), id).toBe(true);
    }
    expect(chapterPicture("nakath.day")).toBeNull();
  });

  it("has artwork for all twelve signs", () => {
    for (const rashi of RASHI) {
      expect(rashi.image).toMatch(/\.webp$/);
      expect(existsSync(join(web, rashi.image.replace("/images/", ""))), rashi.key).toBe(true);
    }
  });
});
