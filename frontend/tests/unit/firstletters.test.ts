import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { MONTHS } from "@/lib/firstletters";
import en from "@/messages/en.json";
import si from "@/messages/si.json";

const rules = readFileSync(
  join(__dirname, "..", "..", "..", "backend", "app", "data", "rules", "first_letters_si_v1.yaml"),
  "utf-8",
);

describe("first letters finder", () => {
  it("offers the ranges the backend rules allow", () => {
    expect(rules).toContain(`search_months: [${MONTHS.join(", ")}]`);
    expect(Object.keys(en.firstLetters.months)).toEqual(MONTHS.map(String));
  });

  it("has every text in both languages with the same placeholders", () => {
    const flat = (value: object, prefix = ""): [string, string][] =>
      Object.entries(value).flatMap(([key, inner]) =>
        typeof inner === "object" ? flat(inner, `${prefix}${key}.`) : [[`${prefix}${key}`, String(inner)]],
      );
    const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    const english = flat(en.firstLetters);
    const sinhala = new Map(flat(si.firstLetters));
    expect([...sinhala.keys()]).toEqual(english.map(([key]) => key));
    for (const [key, text] of english) expect(placeholders(sinhala.get(key) ?? ""), key).toEqual(placeholders(text));
  });
});
