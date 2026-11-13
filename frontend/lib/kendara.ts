import type { components } from "./api-types";
import type { Place } from "./hadahan";
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

// ---------- using a match on the hadahan and porondam pages ----------


export type Role = "bride" | "groom";

/** What a match hands to the hadahan or porondam form: never put in a URL. */
export type Handoff = {
  target: "hadahan" | "porondam";
  role?: Role;
  date: string; // local, YYYY-MM-DD
  time: string; // local, HH:MM
  place: Place;
};

const HANDOFF_KEY = "astronomia.kendara.handoff";
let held: string | null = null;

export function saveHandoff(handoff: Handoff): void {
  held = null;
  try {
    sessionStorage.setItem(HANDOFF_KEY, JSON.stringify(handoff));
  } catch {
    held = JSON.stringify(handoff); // without storage, keep it for this page view
  }
}

/**
 * The handoff waiting for a form, as text ("" when none). On first read it moves from session
 * storage into memory, so it is used once but stays steady while the page renders.
 */
export function handoffSnapshot(): string {
  try {
    const raw = sessionStorage.getItem(HANDOFF_KEY);
    if (raw) {
      held = raw;
      sessionStorage.removeItem(HANDOFF_KEY);
    }
  } catch {
    // Storage can be unavailable (private mode).
  }
  return held ?? "";
}

/** Forget the handoff once the form has been sent. */
export function clearHandoff(): void {
  held = null;
}

export function parseHandoff(raw: string, target: Handoff["target"]): Handoff | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Handoff;
    return value.target === target && value.date && value.time && value.place ? value : null;
  } catch {
    return null;
  }
}

/** The local date and time at the middle of a window, in the window's own UTC offset. */
export function middleOf(match: Pick<KendaraMatch, "start" | "end">): { date: string; time: string } {
  const offset = /([+-])(\d{2}):(\d{2})$/.exec(match.start.local);
  const minutes = offset ? (offset[1] === "-" ? -1 : 1) * (Number(offset[2]) * 60 + Number(offset[3])) : 0;
  const middle = (Date.parse(match.start.utc) + Date.parse(match.end.utc)) / 2;
  const local = new Date(middle + minutes * 60_000).toISOString();
  return { date: local.slice(0, 10), time: local.slice(11, 16) };
}

/** The birth star and pada, when every match has that one star and pada and no other. */
export function sharedStar(result: KendaraResult): { nakshatra: string; pada: number; name: string } | null {
  const stars = result.matches.map((match) => match.stars);
  if (stars.length === 0 || stars.some((list) => list.length !== 1)) return null;
  const [first] = stars[0];
  return stars.every(([star]) => star.nakshatra === first.nakshatra && star.pada === first.pada)
    ? { nakshatra: first.nakshatra, pada: first.pada, name: first.name }
    : null;
}

/** Colombo's place id in the place index, the search's default place. */
export const COLOMBO_ID = 1248991;
