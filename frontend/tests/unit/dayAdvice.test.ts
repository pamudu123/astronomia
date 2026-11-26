import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { AVOID_TARA, WEAK_TARA, dayBar, moonOf, rahuAdvice, starTone, tara } from "@/lib/dayAdvice";
import type { Panchanga } from "@/lib/nakath";
import { NAKSHATRA } from "@/lib/nakshatra";

// Colombo, 14 April 2027: sunrise 06:03, Rahu kalaya 12:07 to 13:38, sunset 18:18.
const day = JSON.parse(
  readFileSync(join(__dirname, "..", "e2e", "fixtures", "panchanga-2027-04-14-colombo-en.json"), "utf-8"),
) as Panchanga;
const at = (clock: string) => Date.parse(`2027-04-14T${clock}:00+05:30`);

describe("rahuAdvice", () => {
  it.each([
    ["02:00", "before"], // today by the clock, before sunrise
    ["12:06", "before"],
    ["12:07", "during"],
    ["13:37", "during"],
    ["13:38", "after"],
    ["23:30", "after"],
  ])("at %s it is %s", (clock, state) => {
    expect(rahuAdvice(day, at(clock))).toEqual({ start: "12:07", end: "13:38", state });
  });

  it("only plans for another day, or while the clock is not known", () => {
    expect(rahuAdvice(day, at("12:30") + 86_400_000)?.state).toBe("planned");
    expect(rahuAdvice(day, null)?.state).toBe("planned");
  });

  it("says nothing where the Sun does not rise", () => {
    expect(rahuAdvice({ ...day, rahu_kalaya: null }, null)).toBeNull();
    expect(dayBar({ ...day, sunrise: null }, null)).toBeNull();
  });
});

describe("dayBar", () => {
  it("places Rahu kalaya in daylight and marks now only in daylight", () => {
    const bar = dayBar(day, at("06:03"));
    // Wednesday: the fifth of eight parts.
    expect(bar?.rahu).toBeCloseTo(50, 0);
    expect(bar?.width).toBeCloseTo(12.5, 0);
    expect(bar?.now).toBe(0);
    expect(dayBar(day, at("19:00"))?.now).toBeNull();
    expect(dayBar(day, null)?.now).toBeNull();
  });
});

describe("moonOf", () => {
  const withThithi = (number: number, ends: "before" | "after") => {
    const next = Date.parse(day.next_sunrise!.utc);
    const end = new Date(next + (ends === "before" ? -60_000 : 60_000)).toISOString();
    return { ...day, thithi: [{ ...day.thithi[0], number, end: { ...day.thithi[0].end, utc: end } }] };
  };

  it("reads the half of the month", () => {
    expect(moonOf(day)).toMatchObject({ phase: "growing", day: 8 });
    expect(moonOf(withThithi(20, "after"))).toMatchObject({ phase: "shrinking", day: 5 });
  });

  it("marks full and new on the day the thithi ends, as the litha does", () => {
    expect(moonOf(withThithi(15, "before"))?.phase).toBe("full");
    expect(moonOf(withThithi(15, "after"))?.phase).toBe("growing");
    expect(moonOf(withThithi(30, "before"))?.phase).toBe("new");
    expect(moonOf({ ...day, thithi: [] })).toBeNull();
  });
});

describe("tara", () => {
  it("counts in nines from the birth star, round the circle", () => {
    expect(tara("ashwini", "ashwini")).toBe(1);
    expect(tara("ashwini", "krittika")).toBe(3);
    expect(tara("revati", "ashwini")).toBe(2);
    expect(tara("rohini", NAKSHATRA[(3 + 9) % 27].key)).toBe(1);
    expect(tara("ashwini", "nowhere")).toBeNull();
  });

  it("gives each star its tone", () => {
    // Only good or moderate: the weaker stars and the birth star's own day are moderate.
    expect(starTone("ashwini", "ashwini")).toBe("moderate");
    expect(starTone("ashwini", "bharani")).toBe("good");
    expect(starTone("ashwini", "krittika")).toBe("moderate");
    expect(starTone("", "krittika")).toBeNull();
  });

  it("uses the same numbers as the backend's wedding rules", () => {
    const rules = readFileSync(
      join(__dirname, "..", "..", "..", "backend", "app", "data", "rules", "wedding_si_v1.yaml"),
      "utf-8",
    );
    const list = (key: string) => JSON.parse(rules.match(new RegExp(`${key}: (\\[[^\\]]*\\])`))![1]);
    expect(AVOID_TARA).toEqual(list("avoid_tara"));
    expect(WEAK_TARA).toEqual(list("weak_tara"));
  });
});
