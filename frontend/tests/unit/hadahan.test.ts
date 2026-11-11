import { describe, expect, it } from "vitest";

import { fill, formatDate, formatDegree, formatMonthYear, formatYear } from "@/lib/hadahan";

describe("formatDate", () => {
  it("writes English dates day first", () => {
    expect(formatDate("1995-04-19T00:00:00Z", "en")).toBe("19 April 1995");
  });

  it("writes Sinhala dates without depending on the browser", () => {
    expect(formatDate("1995-04-19T00:00:00Z", "si")).toBe("1995 අප්‍රේල් 19");
  });

  it("uses the UTC date, not the local one", () => {
    expect(formatDate("2024-12-31T23:30:00Z", "en")).toBe("31 December 2024");
  });
});

describe("other formats", () => {
  it("formats years and months", () => {
    expect(formatYear("2030-04-13T00:00:00Z")).toBe("2030");
    expect(formatMonthYear("2026-08-01T00:00:00Z", "en")).toBe("Aug 2026");
    expect(formatMonthYear("2026-08-01T00:00:00Z", "si")).toBe("2026 අගෝස්තු");
  });

  it("formats degrees and minutes", () => {
    expect(formatDegree(21.1)).toBe("21° 06′");
    expect(formatDegree(9.4999)).toBe("9° 30′");
    expect(formatDegree(4.9999)).toBe("5° 00′");
  });

  it("fills templates and keeps unknown placeholders", () => {
    expect(fill("{name}'s hadahan", { name: "Nimali" })).toBe("Nimali's hadahan");
    expect(fill("{a} and {b}", { a: 1 })).toBe("1 and {b}");
  });
});
