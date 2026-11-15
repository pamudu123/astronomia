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

  it("asks for the page's language", () => {
    expect(followUpInstructions("si")).toContain("Write in Sinhala");
    expect(followUpInstructions("en")).toContain("Write in English");
  });
});
