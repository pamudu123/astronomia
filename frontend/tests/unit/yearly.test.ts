import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import sitemap from "@/app/sitemap";
import { YEARS, dayOfYear, daysInYear, hasYear, yearlyPath } from "@/lib/yearly";
import en from "@/messages/en.json";
import si from "@/messages/si.json";

const fixture = <T,>(name: string) =>
  JSON.parse(readFileSync(join(__dirname, "..", "e2e", "fixtures", name), "utf-8")) as T;

type Year = { year: number; planets: { stays: { start: string; end: string }[] }[] };

describe("yearly", () => {
  it("offers the years the backend serves", () => {
    expect(YEARS).toEqual([fixture<Year>("yearly-2027-makara-en.json").year]);
    expect(hasYear("2027")).toBe(true);
    expect(hasYear("2026")).toBe(false);
    expect(hasYear("2027.0")).toBe(false);
  });

  it("keeps birth details out of the general path", () => {
    expect(yearlyPath(2027, "makara", "si")).toBe("/v1/yearly/2027/makara?lang=si");
  });

  it("fills each planet's bar with the whole year", () => {
    const year = fixture<Year>("yearly-2027-makara-en.json");
    for (const planet of year.planets) {
      const days = planet.stays.reduce(
        (sum, stay) => sum + dayOfYear(stay.end, year.year) + 1 - dayOfYear(stay.start, year.year),
        0,
      );
      // A change day belongs to both stays, so a planet that moves counts it twice.
      expect(days - (planet.stays.length - 1)).toBe(daysInYear(year.year));
    }
  });

  it("has the same text keys in both languages", () => {
    const keys = (value: object): string[] =>
      Object.entries(value).flatMap(([key, inner]) =>
        typeof inner === "object" ? keys(inner).map((k) => `${key}.${k}`) : [key],
      );
    expect(keys(si.yearly)).toEqual(keys(en.yearly));
  });

  it("is in the sitemap", () => {
    const urls = sitemap().map((entry) => entry.url);
    expect(urls).toContain("http://localhost:3000/en/forecast/2027");
    expect(urls).toContain("http://localhost:3000/si/forecast/2027/makara");
    expect(urls.filter((url) => url.includes("/forecast/2027/"))).toHaveLength(24);
  });
});
