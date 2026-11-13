import { describe, expect, it } from "vitest";

import { HOUSE_CENTRES } from "@/components/hadahan/Kendara";
import { BODIES, HOUSE_SHAPES, nextUnplaced, placedCount, toDrawing, windowLength } from "@/lib/kendara";

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
