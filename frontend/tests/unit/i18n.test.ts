import { describe, expect, it } from "vitest";

import { hasLocale, pickLocale, switchLocalePath } from "@/lib/i18n";
import en from "@/messages/en.json";
import si from "@/messages/si.json";

describe("switchLocalePath", () => {
  it("swaps the language of a page", () => {
    expect(switchLocalePath("/en/hadahan", "si")).toBe("/si/hadahan");
    expect(switchLocalePath("/si", "en")).toBe("/en");
  });

  it("adds a language when the path has none", () => {
    expect(switchLocalePath("/", "si")).toBe("/si");
    expect(switchLocalePath("/porondam", "en")).toBe("/en/porondam");
  });
});

describe("pickLocale", () => {
  it("defaults to English", () => {
    expect(pickLocale(null)).toBe("en");
    expect(pickLocale("fr-FR,fr;q=0.9")).toBe("en");
  });

  it("chooses Sinhala when the browser prefers it", () => {
    expect(pickLocale("si-LK,si;q=0.9,en;q=0.8")).toBe("si");
    expect(pickLocale("en-US;q=0.5,si;q=0.9")).toBe("si");
  });

  it("keeps English when it is ranked first", () => {
    expect(pickLocale("en-GB,en;q=0.9,si;q=0.5")).toBe("en");
  });
});

describe("hasLocale", () => {
  it("accepts only supported languages", () => {
    expect(hasLocale("si")).toBe(true);
    expect(hasLocale("ta")).toBe(false);
  });
});

function keyPaths(value: unknown, prefix = ""): string[] {
  if (Array.isArray(value)) {
    return [`${prefix}[${value.length}]`, ...value.flatMap((v, i) => keyPaths(v, `${prefix}[${i}]`))];
  }
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([k, v]) => keyPaths(v, prefix ? `${prefix}.${k}` : k));
  }
  return [prefix];
}

describe("messages", () => {
  it("Sinhala and English have exactly the same keys", () => {
    expect(keyPaths(si).sort()).toEqual(keyPaths(en).sort());
  });
});
