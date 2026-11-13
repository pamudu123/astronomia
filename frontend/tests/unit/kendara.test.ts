import { describe, expect, it } from "vitest";

import { HOUSE_CENTRES } from "@/components/hadahan/Kendara";
import {
  BODIES,
  HOUSE_SHAPES,
  type KendaraMatch,
  type KendaraResult,
  clearHandoff,
  handoffSnapshot,
  middleOf,
  nextUnplaced,
  parseHandoff,
  placedCount,
  saveHandoff,
  sharedStar,
  toDrawing,
  windowLength,
} from "@/lib/kendara";

/** Whether a point is inside a polygon given as "x,y x,y ..." (ray casting). */
function inside([x, y]: [number, number], points: string): boolean {
  const corners = points.split(" ").map((pair) => pair.split(",").map(Number));
  let hit = false;
  for (let i = 0, j = corners.length - 1; i < corners.length; j = i++) {
    const [xi, yi] = corners[i];
    const [xj, yj] = corners[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

describe("HOUSE_SHAPES", () => {
  it("has twelve houses, each holding the centre the kendara drawing uses", () => {
    expect(Object.keys(HOUSE_SHAPES)).toHaveLength(12);
    for (const [house, centre] of Object.entries(HOUSE_CENTRES)) {
      expect(inside(centre, HOUSE_SHAPES[Number(house)])).toBe(true);
      for (const [other, shape] of Object.entries(HOUSE_SHAPES)) {
        if (other !== house) expect(inside(centre, shape)).toBe(false);
      }
    }
  });
});

describe("drawing helpers", () => {
  it("moves on to the next planet still to place", () => {
    expect(nextUnplaced({})).toBe("sun");
    expect(nextUnplaced({ sun: 1 }, "sun")).toBe("moon");
    expect(nextUnplaced({ moon: 2 }, "ketu")).toBe("sun");
    const all = Object.fromEntries(BODIES.map((body) => [body, 1]));
    expect(nextUnplaced(all, "sun")).toBeNull();
  });

  it("counts placed planets and builds the request", () => {
    expect(placedCount({ lagna: "simha", houses: { sun: 9, moon: 4 } })).toBe(2);
    expect(toDrawing({ lagna: "", houses: { sun: 9 } })).toBeNull();
    expect(toDrawing({ lagna: "simha", houses: { moon: 4, sun: 9 } })).toEqual({
      lagna: "simha",
      houses: { sun: 9, moon: 4 },
    });
  });

  it("says how long a window is", () => {
    expect(windowLength(13)).toEqual({ unit: "minutes", value: 13 });
    expect(windowLength(118)).toEqual({ unit: "hours", value: 2 });
    expect(windowLength(155)).toEqual({ unit: "hours", value: 2.5 });
  });
});

const at = (utc: string, local: string) => ({ utc, local, clock: local.slice(11, 16), date: local.slice(0, 10) });

function match(start: [string, string], end: [string, string], stars: [string, number][] = []): KendaraMatch {
  return {
    start: at(...start),
    end: at(...end),
    minutes: 0,
    grade: "exact",
    near: [],
    near_text: null,
    text: "",
    stars: stars.map(([nakshatra, pada]) => ({
      nakshatra,
      name: nakshatra,
      pada,
      start: at(...start),
      end: at(...end),
    })),
  };
}

describe("middleOf", () => {
  it("gives the local middle of a window", () => {
    const window = match(
      ["1995-04-17T08:30:00Z", "1995-04-17T14:00:00+05:30"],
      ["1995-04-17T10:44:00Z", "1995-04-17T16:14:00+05:30"],
    );
    expect(middleOf(window)).toEqual({ date: "1995-04-17", time: "15:07" });
  });

  it("crosses midnight in the local day, not the UTC day", () => {
    const window = match(
      ["1995-04-17T18:00:00Z", "1995-04-17T23:30:00+05:30"],
      ["1995-04-17T19:00:00Z", "1995-04-18T00:30:00+05:30"],
    );
    expect(middleOf(window)).toEqual({ date: "1995-04-18", time: "00:00" });
  });

  it("works west of Greenwich", () => {
    const window = match(
      ["2000-01-01T03:00:00Z", "1999-12-31T22:00:00-05:00"],
      ["2000-01-01T07:00:00Z", "2000-01-01T02:00:00-05:00"],
    );
    expect(middleOf(window)).toEqual({ date: "2000-01-01", time: "00:00" });
  });
});

describe("sharedStar", () => {
  const start: [string, string] = ["1995-04-17T08:30:00Z", "1995-04-17T14:00:00+05:30"];
  const end: [string, string] = ["1995-04-17T10:44:00Z", "1995-04-17T16:14:00+05:30"];
  const result = (stars: [string, number][][]) => ({ matches: stars.map((s) => match(start, end, s)) }) as KendaraResult;

  it("finds one star and pada shared by every match", () => {
    expect(sharedStar(result([[["rohini", 2]], [["rohini", 2]]]))).toEqual({ nakshatra: "rohini", pada: 2, name: "rohini" });
  });

  it("gives nothing for two stars, two padas, a window across two, or no matches", () => {
    expect(sharedStar(result([[["rohini", 2]], [["hasta", 2]]]))).toBeNull();
    expect(sharedStar(result([[["rohini", 2]], [["rohini", 3]]]))).toBeNull();
    expect(sharedStar(result([[["rohini", 2], ["rohini", 3]]]))).toBeNull();
    expect(sharedStar(result([]))).toBeNull();
  });
});

describe("parseHandoff", () => {
  const place = { id: 1248991, name: "Colombo" };
  const raw = JSON.stringify({ target: "porondam", role: "groom", date: "1995-04-17", time: "15:07", place });

  it("reads a handoff for its own page only", () => {
    expect(parseHandoff(raw, "porondam")).toMatchObject({ role: "groom", time: "15:07" });
    expect(parseHandoff(raw, "hadahan")).toBeNull();
  });

  it("ignores nothing, broken text and missing parts", () => {
    expect(parseHandoff("", "porondam")).toBeNull();
    expect(parseHandoff("{", "porondam")).toBeNull();
    expect(parseHandoff(JSON.stringify({ target: "porondam", date: "1995-04-17" }), "porondam")).toBeNull();
  });
});

describe("the handoff", () => {
  const store = new Map<string, string>();
  const storage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
  };

  it("moves out of session storage on first read, stays steady, then clears", () => {
    (globalThis as { sessionStorage?: unknown }).sessionStorage = storage;
    const place = { id: 1248991, name: "Colombo" } as Parameters<typeof saveHandoff>[0]["place"];
    saveHandoff({ target: "hadahan", date: "1995-04-17", time: "15:07", place });
    expect(store.size).toBe(1);
    const first = handoffSnapshot();
    expect(parseHandoff(first, "hadahan")).toMatchObject({ time: "15:07" });
    expect(store.size).toBe(0); // a reload will not fill the form again
    expect(handoffSnapshot()).toBe(first); // the same text while the page renders
    clearHandoff();
    expect(handoffSnapshot()).toBe("");
    delete (globalThis as { sessionStorage?: unknown }).sessionStorage;
  });
});
