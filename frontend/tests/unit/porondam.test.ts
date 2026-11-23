import { afterEach, describe, expect, it, vi } from "vitest";

import {
  EMPTY_MATCH,
  type Factor,
  type MatchDraft,
  type SavedMatch,
  filterFactors,
  groupFactors,
  isCounted,
  keepsMatch,
  linkOf,
  loadMatchDraft,
  openingForm,
  ringOffset,
  ringSegments,
  saveMatchDraft,
  spanPercent,
  yearTicks,
} from "@/lib/porondam";

const factor = (id: string, passed: boolean): Factor => ({
  id,
  passed,
  hard: false,
  checked: true,
  facts: {},
  reason: "",
  softened_by: [],
  softened_text: [],
});

describe("filterFactors", () => {
  const all = [factor("dina", true), factor("gana", false), factor("yoni", true)];

  it("keeps everything for all", () => {
    expect(filterFactors(all, "all")).toHaveLength(3);
  });

  it("splits agreeing and not agreeing factors", () => {
    expect(filterFactors(all, "agree").map((f) => f.id)).toEqual(["dina", "yoni"]);
    expect(filterFactors(all, "disagree").map((f) => f.id)).toEqual(["gana"]);
  });

  it("shows a factor that was not counted only under all", () => {
    const withWeekday = [...all, { ...factor("weekday", false), checked: false }];
    expect(filterFactors(withWeekday, "all")).toHaveLength(4);
    expect(filterFactors(withWeekday, "agree").map((f) => f.id)).toEqual(["dina", "yoni"]);
    expect(filterFactors(withWeekday, "disagree").map((f) => f.id)).toEqual(["gana"]);
  });

  it("counts a factor from a result made before `checked` existed (QA UI-01)", () => {
    const old = all.map((f) => {
      const copy: Partial<Factor> = { ...f };
      delete copy.checked;
      return copy as Factor;
    });
    expect(old.every(isCounted)).toBe(true);
    expect(filterFactors(old, "agree").map((f) => f.id)).toEqual(["dina", "yoni"]);
    expect(filterFactors(old, "disagree").map((f) => f.id)).toEqual(["gana"]);
    expect(isCounted({ checked: false })).toBe(false);
  });
});

describe("groupFactors", () => {
  const themes = {
    health: { name: "Long life and health", factors: ["dina", "nadi"] },
    bond: { name: "Bond and temperament", factors: ["gana", "yoni"] },
    planets: { name: "Planets and birth days", factors: ["weekday", "graha"] },
  };
  const all = [
    factor("dina", true),
    factor("gana", false),
    factor("yoni", true),
    factor("nadi", false),
    { ...factor("weekday", false), checked: false },
  ];

  it("groups by theme, in the themes' order, and counts what agrees", () => {
    const groups = groupFactors(all, themes);
    expect(groups.map((g) => [g.id, g.factors.map((f) => f.id), g.agree, g.counted])).toEqual([
      ["health", ["dina", "nadi"], 1, 2],
      ["bond", ["gana", "yoni"], 1, 2],
      // Dina needs the birth dates: shown, but not counted.
      ["planets", ["weekday"], 0, 0],
    ]);
  });

  it("puts a factor no theme names in a last group, so none is dropped", () => {
    const groups = groupFactors([...all, factor("vruksha", true)], themes);
    expect(groups.at(-1)).toMatchObject({ id: "", name: "", agree: 1, counted: 1 });
    expect(groups.flatMap((g) => g.factors)).toHaveLength(6);
  });

  it("keeps every factor in one group when the labels have no themes", () => {
    const groups = groupFactors(all, undefined);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ name: "", agree: 2, counted: 4 });
  });
});

describe("ringSegments", () => {
  it("fills the ring, with wider gaps between groups", () => {
    const segments = ringSegments([2, 1], 10, 2);
    // 340 degrees left for 3 segments.
    const each = 340 / 3;
    expect(segments).toHaveLength(3);
    expect(segments[0].start).toBeCloseTo(5 + 1);
    expect(segments[0].end).toBeCloseTo(5 + each - 1);
    expect(segments[1].start).toBeCloseTo(5 + each + 1);
    expect(segments[2].start).toBeCloseTo(5 + 2 * each + 10 + 1);
    expect(segments[2].end).toBeCloseTo(355 - 1);
  });

  it("uses no group gap for a single group, and nothing for no factors", () => {
    const segments = ringSegments([4], 10, 2);
    expect(segments[0].start).toBeCloseTo(1);
    expect(segments[3].end).toBeCloseTo(359);
    expect(ringSegments([], 10, 2)).toEqual([]);
  });
});

describe("ringOffset", () => {
  it("fills the ring in proportion", () => {
    expect(ringOffset(0, 9, 100)).toBe(100);
    expect(ringOffset(9, 9, 100)).toBe(0);
    expect(ringOffset(3, 6, 100)).toBe(50);
  });

  it("never overflows", () => {
    expect(ringOffset(12, 9, 100)).toBe(0);
    expect(ringOffset(1, 0, 100)).toBe(100);
  });
});

describe("spanPercent", () => {
  const window = ["2026-01-01", "2036-01-01"] as const;

  it("places a span inside the window", () => {
    const at = spanPercent("2031-01-01", "2036-01-01", ...window)!;
    expect(at.left).toBeCloseTo(50, 0);
    expect(at.width).toBeCloseTo(50, 0);
  });

  it("cuts off what lies outside the window", () => {
    expect(spanPercent("2020-01-01", "2040-01-01", ...window)).toEqual({ left: 0, width: 100 });
    expect(spanPercent("2020-01-01", "2031-01-01", ...window)!.left).toBe(0);
  });

  it("gives nothing for a span outside the window", () => {
    expect(spanPercent("2020-01-01", "2025-01-01", ...window)).toBeNull();
    expect(spanPercent("2036-01-01", "2040-01-01", ...window)).toBeNull();
  });
});

describe("yearTicks", () => {
  it("marks each 1 January after the start", () => {
    const ticks = yearTicks("2026-11-12", "2036-11-12");
    expect(ticks.map((tick) => tick.year)).toEqual([2027, 2028, 2029, 2030, 2031, 2032, 2033, 2034, 2035, 2036]);
    expect(ticks[0].left).toBeGreaterThan(0);
    expect(ticks[0].left).toBeLessThan(2);
    expect(ticks.at(-1)!.left).toBeLessThan(100);
  });
});

describe("the match form's draft", () => {
  const star = (nakshatra: string) => ({ name: "", nakshatra, pada: 1 });
  const draft: MatchDraft = {
    ...EMPTY_MATCH,
    quick: { bride: { ...star("rohini"), name: "Nimali" }, groom: star("hasta") },
    link: "",
  };
  afterEach(() => vi.unstubAllGlobals());

  it("is kept in the tab's storage, and an unusable one is ignored", () => {
    const kept = new Map<string, string>();
    vi.stubGlobal("sessionStorage", {
      getItem: (key: string) => kept.get(key) ?? null,
      setItem: (key: string, value: string) => kept.set(key, value),
      removeItem: (key: string) => kept.delete(key),
    });
    saveMatchDraft(draft);
    expect(loadMatchDraft()).toEqual(draft);
    for (const key of kept.keys()) kept.set(key, '{"mode":"full"}');
    expect(loadMatchDraft()).toBeNull();
    saveMatchDraft(null);
    expect(kept.size).toBe(0);
  });

  it("opens as it was, and empty without one", () => {
    expect(openingForm(draft, "", null)).toMatchObject({ mode: "full", quick: draft.quick });
    expect(openingForm(null, "", null)).toEqual(EMPTY_MATCH);
  });

  it("puts a new link's stars on top, and keeps edits made under the same link", () => {
    const linked = { bride: { nakshatra: "krittika", pada: 2 } };
    const link = linkOf(linked, false);
    expect(link).toBe("bride=krittika.2");
    const opened = openingForm(draft, link, linked);
    expect(opened.mode).toBe("quick");
    expect(opened.quick.bride).toEqual({ name: "", nakshatra: "krittika", pada: 2 });
    expect(opened.quick.groom).toEqual(draft.quick.groom);
    expect(openingForm({ ...draft, link }, link, linked).quick.bride.nakshatra).toBe("rohini");
    expect(linkOf(null, true)).toBe("mode=stars");
    expect(openingForm(draft, "mode=stars", null).mode).toBe("quick");
  });

  it("brings a match back unless another link asks for a new one", () => {
    const saved = { link: "bride=krittika.2" } as SavedMatch;
    expect(keepsMatch(saved, "bride=krittika.2")).toBe(true);
    expect(keepsMatch(saved, "")).toBe(true);
    expect(keepsMatch(saved, "bride=hasta.1")).toBe(false);
    expect(keepsMatch({} as SavedMatch, "bride=hasta.1")).toBe(false);
  });
});
