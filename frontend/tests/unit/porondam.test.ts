import { describe, expect, it } from "vitest";

import { type Factor, filterFactors, ringOffset, spanPercent, yearTicks } from "@/lib/porondam";

const factor = (id: string, passed: boolean): Factor => ({ id, passed, hard: false, checked: true, facts: {}, reason: "" });

describe("filterFactors", () => {
  const all = [factor("dina", true), factor("gana", false), factor("yoni", true)];

  it("keeps everything for all", () => {
    expect(filterFactors(all, "all")).toHaveLength(3);
  });

  it("splits agreeing and not agreeing factors", () => {
    expect(filterFactors(all, "agree").map((f) => f.id)).toEqual(["dina", "yoni"]);
    expect(filterFactors(all, "disagree").map((f) => f.id)).toEqual(["gana"]);
  });

  it("shows a factor that was not counted only under all", () => {
    const withWeekday = [...all, { ...factor("weekday", false), checked: false }];
    expect(filterFactors(withWeekday, "all")).toHaveLength(4);
    expect(filterFactors(withWeekday, "agree").map((f) => f.id)).toEqual(["dina", "yoni"]);
    expect(filterFactors(withWeekday, "disagree").map((f) => f.id)).toEqual(["gana"]);
  });
});

describe("ringOffset", () => {
  it("fills the ring in proportion", () => {
    expect(ringOffset(0, 9, 100)).toBe(100);
    expect(ringOffset(9, 9, 100)).toBe(0);
    expect(ringOffset(3, 6, 100)).toBe(50);
  });

  it("never overflows", () => {
    expect(ringOffset(12, 9, 100)).toBe(0);
    expect(ringOffset(1, 0, 100)).toBe(100);
  });
});

describe("spanPercent", () => {
  const window = ["2026-01-01", "2036-01-01"] as const;

  it("places a span inside the window", () => {
    const at = spanPercent("2031-01-01", "2036-01-01", ...window)!;
    expect(at.left).toBeCloseTo(50, 0);
    expect(at.width).toBeCloseTo(50, 0);
  });

  it("cuts off what lies outside the window", () => {
    expect(spanPercent("2020-01-01", "2040-01-01", ...window)).toEqual({ left: 0, width: 100 });
    expect(spanPercent("2020-01-01", "2031-01-01", ...window)!.left).toBe(0);
  });

  it("gives nothing for a span outside the window", () => {
    expect(spanPercent("2020-01-01", "2025-01-01", ...window)).toBeNull();
    expect(spanPercent("2036-01-01", "2040-01-01", ...window)).toBeNull();
  });
});

describe("yearTicks", () => {
  it("marks each 1 January after the start", () => {
    const ticks = yearTicks("2026-11-12", "2036-11-12");
    expect(ticks.map((tick) => tick.year)).toEqual([2027, 2028, 2029, 2030, 2031, 2032, 2033, 2034, 2035, 2036]);
    expect(ticks[0].left).toBeGreaterThan(0);
    expect(ticks[0].left).toBeLessThan(2);
    expect(ticks.at(-1)!.left).toBeLessThan(100);
  });
});
