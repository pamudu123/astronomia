import type { components } from "./api-types";
import type { Locale } from "./i18n";

/** The request without its language, which fetchKendara adds. */
export type KendaraRequest = Omit<components["schemas"]["KendaraRequest"], "lang">;
export type KendaraResult = components["schemas"]["KendaraResponse"];
export type KendaraMatch = KendaraResult["matches"][number];

export const BODIES = ["sun", "moon", "mars", "mercury", "jupiter", "venus", "saturn", "rahu", "ketu"] as const;
export type BodyKey = (typeof BODIES)[number];

/** One kendara being drawn: the lagna sign, and the house each planet has been put in. */
export type DrawingState = { lagna: string; houses: Partial<Record<BodyKey, number>> };

export const EMPTY_DRAWING: DrawingState = { lagna: "", houses: {} };

/**
 * The outline of each house in the 300 x 300 drawing, matching components/hadahan/Kendara.tsx:
 * house 1 at the top centre and the houses running anticlockwise. The corner squares are cut
 * corner to corner, so each corner holds two houses.
 */
export const HOUSE_SHAPES: Record<number, string> = {
  1: "100,0 200,0 200,100 100,100",
  2: "0,0 100,0 100,100",
  3: "0,0 100,100 0,100",
  4: "0,100 100,100 100,200 0,200",
  5: "0,200 100,200 0,300",
  6: "100,200 100,300 0,300",
  7: "100,200 200,200 200,300 100,300",
  8: "200,200 300,300 200,300",
  9: "200,200 300,200 300,300",
  10: "200,100 300,100 300,200 200,200",
  11: "300,0 300,100 200,100",
  12: "200,0 300,0 200,100",
};

/** The next planet still to place, after `from`, or null when all are placed. */
export function nextUnplaced(houses: DrawingState["houses"], from?: BodyKey): BodyKey | null {
  const start = from ? BODIES.indexOf(from) + 1 : 0;
  for (let i = 0; i < BODIES.length; i++) {
    const body = BODIES[(start + i) % BODIES.length];
    if (houses[body] === undefined) return body;
  }
  return null;
}

export function placedCount(drawing: DrawingState): number {
  return BODIES.filter((body) => drawing.houses[body] !== undefined).length;
}

/** The drawing as the API takes it, or null without a lagna. */
export function toDrawing(drawing: DrawingState): KendaraRequest["rashi"] | null {
  if (!drawing.lagna) return null;
  const houses: Record<string, number> = {};
  for (const body of BODIES) {
    const house = drawing.houses[body];
    if (house !== undefined) houses[body] = house;
  }
  return { lagna: drawing.lagna, houses };
}

/** The drawing travels in the body of a POST, never in the URL. */
export async function fetchKendara(request: KendaraRequest, lang: Locale): Promise<KendaraResult> {
  const response = await fetch("/api/v1/kendara/search", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...request, lang }),
  });
  if (!response.ok) throw new Error(`request failed: ${response.status}`);
  return (await response.json()) as KendaraResult;
}

/** "about 2 hours" style length of a window, in minutes or hours. */
export function windowLength(minutes: number): { unit: "minutes" | "hours"; value: number } {
  if (minutes < 90) return { unit: "minutes", value: Math.max(1, Math.round(minutes)) };
  return { unit: "hours", value: Math.round((minutes / 60) * 2) / 2 };
}
