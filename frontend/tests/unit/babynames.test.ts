import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { STAR_LETTERS, degrees } from "@/lib/babynames";
import { NAKSHATRA } from "@/lib/nakshatra";
import en from "@/messages/en.json";
import si from "@/messages/si.json";

const rules = readFileSync(
  join(__dirname, "..", "..", "..", "backend", "app", "data", "rules", "name_letters_si_v1.yaml"),
  "utf-8",
);

describe("baby name letters", () => {
  it("keeps the same letters as the backend table", () => {
    expect(Object.keys(STAR_LETTERS)).toEqual(NAKSHATRA.map((star) => star.key));
    for (const [star, letters] of Object.entries(STAR_LETTERS)) {
      const block = rules.split(`\n  ${star}:\n`)[1].split(/\n {2}\w/)[0];
      const found = [...block.matchAll(/letter: "([^"]+)"/g)].map((match) => match[1]);
      expect(found, star).toEqual(letters);
    }
  });

  it("has every text in both languages with the same placeholders", () => {
    const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    const flat = (value: object, prefix = ""): [string, string][] =>
      Object.entries(value).flatMap(([key, inner]) =>
        typeof inner === "object" ? flat(inner, `${prefix}${key}.`) : [[`${prefix}${key}`, String(inner)]],
      );
    const english = flat(en.babyNames);
    const sinhala = new Map(flat(si.babyNames));
    expect([...sinhala.keys()]).toEqual(english.map(([key]) => key));
    for (const [key, text] of english) expect(placeholders(sinhala.get(key) ?? ""), key).toEqual(placeholders(text));
  });

  it("writes degrees inside a sign", () => {
    expect(degrees(0)).toBe("0°00′");
    expect(degrees(3.333333)).toBe("3°20′");
    expect(degrees(26.666667)).toBe("26°40′");
    expect(degrees(30)).toBe("30°00′");
  });
});
