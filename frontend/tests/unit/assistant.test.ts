import { describe, expect, it } from "vitest";

import { matchContext } from "@/lib/assistant/context";
import type { Labels } from "@/lib/hadahan";
import type { Porondam } from "@/lib/porondam";

import full from "../e2e/fixtures/porondam-full-en.json";
import quick from "../e2e/fixtures/porondam-quick-en.json";
import labelsEn from "../e2e/fixtures/labels-en.json";

const labels = labelsEn as unknown as Labels;
const fullResult = full as unknown as Porondam;
const quickResult = quick as unknown as Porondam;

type MatchSummary = {
  bride: Record<string, unknown>;
  score: { agree: number; counted: number };
  essential_checks: { id: string; name: string; passes: boolean; reason: string }[];
  factors_not_agreeing: { id: string; name: string; meaning: string; reason: string }[];
  factors_agreeing: string[];
  factors_not_counted: string[];
  quick_match: boolean;
  mars_check: unknown;
};

const summary = (result: Porondam) => matchContext(result, labels, "en").result as MatchSummary;

describe("matchContext", () => {
  it("names the page and language", () => {
    const context = matchContext(fullResult, labels, "si");
    expect(context.page).toBe("match_result");
    expect(context.language).toBe("si");
    expect(context.shared).toBeUndefined();
    expect(matchContext(fullResult, labels, "en", true).shared).toBe(true);
  });

  it("sends no names, birth dates, times or places", () => {
    const text = JSON.stringify(matchContext(fullResult, labels, "en"));
    expect(text).not.toContain(fullResult.bride!.name);
    expect(text).not.toContain(fullResult.groom!.name);
    expect(text).not.toContain("UTC+");
    expect(text).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  });

  it("summarises the people with readable names and engine ids", () => {
    const { bride } = summary(fullResult);
    expect(bride).toEqual({
      birth_star: labels.nakshatra.jyeshtha,
      birth_star_id: "jyeshtha",
      pada: 4,
      moon_sign: labels.rashi.vrischika.name,
      rising_sign: labels.rashi.simha.name,
    });
  });

  it("keeps the score and every factor, split the way the page shows them", () => {
    const s = summary(fullResult);
    const { match } = fullResult;
    expect(s.score).toEqual({ agree: match!.score.passed, counted: match!.score.total });
    const counted = match!.factors.filter((f) => f.checked);
    expect(s.factors_not_agreeing.length + s.factors_agreeing.length).toBe(counted.length);
    const gana = s.factors_not_agreeing.find((f) => f.id === "gana")!;
    expect(gana.meaning).toBe(labels.porondam_factor.gana.meaning);
    expect(gana.reason).toBe(match!.factors.find((f) => f.id === "gana")!.reason);
    expect(s.essential_checks.map((c) => c.id)).toEqual(["rajju", "vedha"]);
  });

  it("tells a quick match apart, with no Mars check", () => {
    const s = summary(quickResult);
    expect(s.quick_match).toBe(true);
    expect(s.mars_check).toBe("needs full birth details for both people");
    expect(s.factors_not_counted.length).toBeGreaterThan(0);
    expect(summary(fullResult).quick_match).toBe(false);
  });
});
