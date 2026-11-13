import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { NAKSHATRA, padaRange, starSigns } from "@/lib/nakshatra";
import { parseStarParam, quickMatchHref, starMatchesPath } from "@/lib/starmatch";

const labels = (lang: "en" | "si") =>
  JSON.parse(
    readFileSync(join(__dirname, "..", "e2e", "fixtures", `labels-${lang}.json`), "utf-8"),
  ) as { nakshatra: Record<string, string> };

describe("NAKSHATRA", () => {
  it.each(["en", "si"] as const)("has the backend's 27 names in order (%s)", (lang) => {
    const backend = labels(lang).nakshatra;
    expect(NAKSHATRA.map((star) => star.key)).toEqual(Object.keys(backend));
    expect(Object.fromEntries(NAKSHATRA.map((star) => [star.key, star[lang]]))).toEqual(backend);
  });
});

describe("starSigns", () => {
  it("gives one sign for a star inside a sign", () => {
    expect(starSigns("rohini")).toEqual([{ rashi: "vrishabha", padas: [1, 2, 3, 4] }]);
    expect(starSigns("revati")).toEqual([{ rashi: "meena", padas: [1, 2, 3, 4] }]);
  });

  it("gives two signs for a star across a sign boundary", () => {
    expect(starSigns("krittika")).toEqual([
      { rashi: "mesha", padas: [1] },
      { rashi: "vrishabha", padas: [2, 3, 4] },
    ]);
    expect(starSigns("mrigashira")).toEqual([
      { rashi: "vrishabha", padas: [1, 2] },
      { rashi: "mithuna", padas: [3, 4] },
    ]);
    expect(NAKSHATRA.filter((star) => starSigns(star.key).length === 2)).toHaveLength(9);
  });

  it("gives nothing for an unknown star", () => {
    expect(starSigns("polaris")).toEqual([]);
  });
});

describe("padaRange", () => {
  it("shows one pada or a range", () => {
    expect(padaRange([1])).toBe("1");
    expect(padaRange([2, 3, 4])).toBe("2–4");
  });
});

describe("star match links", () => {
  const keys = NAKSHATRA.map((star) => star.key);

  it("builds the endpoint path", () => {
    expect(starMatchesPath("rohini", 2, "groom", "si")).toBe(
      "/v1/porondam/stars/rohini?pada=2&role=groom&lang=si",
    );
  });

  it("puts the chosen star on the side of its role", () => {
    const own = { star: "anuradha", pada: 2 };
    const partner = { star: "rohini", pada: 1 };
    expect(quickMatchHref("en", own, partner, "bride")).toBe(
      "/en/porondam?bride=anuradha.2&groom=rohini.1",
    );
    expect(quickMatchHref("si", own, partner, "groom")).toBe(
      "/si/porondam?bride=rohini.1&groom=anuradha.2",
    );
  });

  it("reads a star and pada, and refuses anything else", () => {
    expect(parseStarParam("rohini.2", keys)).toEqual({ nakshatra: "rohini", pada: 2 });
    expect(parseStarParam("rohini", keys)).toEqual({ nakshatra: "rohini", pada: 1 });
    expect(parseStarParam("polaris.1", keys)).toBeNull();
    expect(parseStarParam("rohini.5", keys)).toBeNull();
    expect(parseStarParam("rohini.x", keys)).toBeNull();
    expect(parseStarParam(null, keys)).toBeNull();
  });
});
