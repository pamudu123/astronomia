import { describe, expect, it } from "vitest";

import { PANEL_MAX, PANEL_MIN, clampWidth, followUpInstructions } from "@/lib/assistant/panel";

describe("clampWidth", () => {
  it("keeps a width inside the limits on a wide screen", () => {
    expect(clampWidth(520, 1920)).toBe(520);
    expect(clampWidth(100, 1920)).toBe(PANEL_MIN);
    expect(clampWidth(5000, 1920)).toBe(PANEL_MAX);
  });

  it("leaves at least 40% of a laptop screen for the page", () => {
    expect(clampWidth(760, 1000)).toBe(600);
  });

  it("never goes below the minimum, even on a narrow window", () => {
    expect(clampWidth(700, 400)).toBe(PANEL_MIN);
  });
});

describe("followUpInstructions", () => {
  it("asks for first-person questions, never addressed to the person", () => {
    const text = followUpInstructions("en");
    expect(text).toContain("first person");
    expect(text).toContain('no "you", "your"');
  });

  it("follows the language of the last answer, then the page's", () => {
    // QA ASTRO-04: a Sinhala answer on an English page had English buttons.
    const text = followUpInstructions("en");
    expect(text).toContain("same language as Astro's last answer");
    expect(text.indexOf("last answer")).toBeLessThan(text.indexOf("write in English"));
    expect(followUpInstructions("si")).toContain("write in Sinhala, the page's language");
  });

  it("asks only for fully answerable questions, and allows none", () => {
    const text = followUpInstructions("en");
    expect(text).toContain("answer in full");
    expect(text).toContain("details they haven't entered");
    expect(text).toContain("empty list");
  });
});
