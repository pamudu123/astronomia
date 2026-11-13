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
    expect(Object.keys(si.babyNames)).toEqual(Object.keys(en.babyNames));
    for (const [key, text] of Object.entries(en.babyNames)) {
      expect(placeholders(si.babyNames[key as keyof typeof si.babyNames]), key).toEqual(placeholders(text));
    }
  });

  it("writes degrees inside a sign", () => {
    expect(degrees(0)).toBe("0°00′");
    expect(degrees(3.333333)).toBe("3°20′");
    expect(degrees(26.666667)).toBe("26°40′");
    expect(degrees(30)).toBe("30°00′");
  });
});
