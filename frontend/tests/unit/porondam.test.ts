import { describe, expect, it } from "vitest";

import { type Factor, filterFactors, ringOffset } from "@/lib/porondam";

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
