import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { CEREMONIES, MONTHS } from "@/lib/wedding";
import en from "@/messages/en.json";
import si from "@/messages/si.json";

const rules = readFileSync(join(__dirname, "..", "..", "..", "backend", "app", "data", "rules", "wedding_si_v1.yaml"), "utf-8");

describe("wedding finder", () => {
  it("offers the ceremonies and ranges the backend rules allow", () => {
    for (const ceremony of CEREMONIES) expect(rules).toContain(`  ${ceremony}:`);
    expect(rules).toContain(`search_months: [${MONTHS.join(", ")}]`);
  });

  it("has every text in both languages", () => {
    const keys = (value: object): string[] =>
      Object.entries(value).flatMap(([key, inner]) =>
        typeof inner === "object" ? keys(inner).map((k) => `${key}.${k}`) : [key],
      );
    expect(keys(si.porondam.wedding)).toEqual(keys(en.porondam.wedding));
    expect(Object.keys(en.porondam.wedding.ceremony)).toEqual(CEREMONIES);
    expect(Object.keys(en.porondam.wedding.months)).toEqual(MONTHS.map(String));
  });
});
