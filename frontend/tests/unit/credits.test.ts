import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  AVURUDU_BODY_EN,
  AVURUDU_SOURCES,
  CC_BY_URL,
  FONTS,
  GEONAMES_URL,
  WIKIPEDIA_NAMES_URL,
} from "@/lib/credits";
import { AVURUDU_YEARS } from "@/lib/nakath";
import en from "@/messages/en.json";
import si from "@/messages/si.json";

const repo = join(__dirname, "..", "..", "..");
const read = (...parts: string[]) => readFileSync(join(repo, ...parts), "utf-8").replace(/\r/g, "");

describe("credits page sources", () => {
  it("names the same official Avurudu lists as the backend rules", () => {
    const rules = read("backend", "app", "data", "rules", "avurudu_v1.yaml");
    const years = [...rules.matchAll(/\n {2}(\d{4}):\n {4}source: "([^"]+)"\n {4}url: "([^"]+)"/g)].map((m) => ({
      year: Number(m[1]),
      source: m[2],
      url: m[3],
    }));
    expect(AVURUDU_SOURCES.map((s) => s.year)).toEqual(years.map((y) => y.year));
    for (const [index, entry] of AVURUDU_SOURCES.entries()) {
      expect(entry.url, String(entry.year)).toBe(years[index].url);
      expect(years[index].source, String(entry.year)).toContain(AVURUDU_BODY_EN[entry.body]);
      expect(AVURUDU_YEARS).toContain(entry.year);
    }
    expect(Object.keys(en.credits.avurudu.bodies).sort()).toEqual(Object.keys(AVURUDU_BODY_EN).sort());
    for (const [key, name] of Object.entries(AVURUDU_BODY_EN)) {
      expect(en.credits.avurudu.bodies[key as keyof typeof AVURUDU_BODY_EN]).toBe(name);
    }
  });

  it("credits every font the site loads, with the copyright line from its licence", () => {
    const layout = read("frontend", "app", "[lang]", "layout.tsx");
    const imported = layout.match(/import \{([^}]+)\} from "next\/font\/google"/)?.[1] ?? "";
    const families = imported.split(",").map((name) => name.trim().replace(/_/g, " "));
    expect(FONTS.map((font) => font.family).sort()).toEqual(families.sort());

    const bundled: Record<string, string> = {
      "DM Sans": "OFL-DMSans.txt",
      Marcellus: "OFL-Marcellus.txt",
      "Noto Sans Sinhala": "OFL-NotoSansSinhala.txt",
    };
    for (const [family, file] of Object.entries(bundled)) {
      const firstLine = read("backend", "app", "reports", "fonts", file).split("\n")[0];
      // The page leaves out the web and email addresses in brackets.
      const withoutLinks = firstLine.replace(/ \((https?:|[^)]*@)[^)]*\)/g, "");
      expect(FONTS.find((font) => font.family === family)?.copyright).toBe(withoutLinks);
    }
  });

  it("links the same GeoNames licence and Wikipedia category as the data files", () => {
    const data = read("backend", "app", "data", "README.md");
    expect(data).toContain(GEONAMES_URL);
    expect(data).toContain(CC_BY_URL);
    const names = read("backend", "app", "data", "names", "names_si_v1.yaml");
    expect(names).toContain(`url: "${WIKIPEDIA_NAMES_URL}"`);
    expect(names).toContain("CC BY-SA 4.0");
  });

  it("has every text in both languages", () => {
    const keys = (value: object, prefix = ""): string[] =>
      Object.entries(value).flatMap(([key, inner]) =>
        typeof inner === "object" && !Array.isArray(inner) ? keys(inner, `${prefix}${key}.`) : [`${prefix}${key}`],
      );
    expect(keys(si.credits)).toEqual(keys(en.credits));
    expect(si.credits.places.changes).toHaveLength(en.credits.places.changes.length);
    expect(si.footer.credits).toBeTruthy();
  });

  it("names the Swiss Ephemeris but not its company or authors (licence section 9)", () => {
    for (const messages of [en, si]) {
      const text = JSON.stringify(messages.credits);
      expect(text).toContain("Swiss Ephemeris");
      expect(text).not.toMatch(/astrodienst|koch|treindl/i);
    }
    expect(read("frontend", "lib", "credits.ts")).not.toMatch(/astrodienst|koch|treindl/i);
  });
});
