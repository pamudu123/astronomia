/**
 * The couple's road on the porondam page: each person's life road (lib/journey.ts), set side
 * by side on one line of years.
 *
 * A place on the shared line is counted in years from the elder's birth, so it is the elder's
 * age. The road runs to the elder's hundredth year: like every road here, it shows no ending.
 */

import type { components } from "./api-types";
import type { Locale } from "./i18n";
import { type Journey, type Road, type RoadStop, type Tone, buildRoad, mistAt, periodAt, qualityAt } from "./journey";
import type { FullInput, PersonInput, PorondamRequest } from "./porondam";

export type CoupleJourneyResult = components["schemas"]["CoupleJourneyResponse"];
export type Role = "bride" | "groom";
export const ROLES: readonly Role[] = ["bride", "groom"];

const YEAR_MS = 365.25 * 86400000;
/** How far back from today the couple's road can be travelled. */
export const LOOK_BACK_YEARS = 10;

export type CoupleStop = Omit<RoadStop, "kind"> & {
  kind: RoadStop["kind"] | "both_mist";
  who: Role | "both";
};

export type Couple = {
  origin: number; // ms: the elder's birth
  roads: Record<Role, Road>;
  /** Years from the elder's birth to each person's: a place minus this is that person's age. */
  offset: Record<Role, number>;
  start: number;
  today: number;
  last: number; // the furthest place the road can be travelled to
  /** Stretches where both are in Erashtaka at once. */
  bothMist: [number, number][];
  stops: CoupleStop[];
};

export type CoupleWords = {
  today: { title: string; text: string };
  /** {to} is the year the stretch ends. */
  bothMist: { title: string; text: string; helps: string };
};

/** The road needs a birth time for both: a birth star alone has no dasha periods. */
export const isFull = (person: PersonInput): person is FullInput => "date" in person;
export const bothFull = (request: PorondamRequest) => isFull(request.bride) && isFull(request.groom);

export async function fetchCoupleJourney(request: PorondamRequest, lang: Locale): Promise<CoupleJourneyResult> {
  const response = await fetch("/api/v1/journey/couple", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...request, lang }),
  });
  if (!response.ok) throw new Error(`request failed: ${response.status}`);
  return (await response.json()) as CoupleJourneyResult;
}

export const ageOf = (couple: Couple, role: Role, at: number) => at - couple.offset[role];
export const coupleYear = (couple: Couple, at: number) => new Date(couple.origin + at * YEAR_MS).getUTCFullYear();
export const qualityOf = (couple: Couple, role: Role, at: number) =>
  qualityAt(couple.roads[role], Math.max(0, ageOf(couple, role, at)));
export const mistOf = (couple: Couple, role: Role, at: number) => mistAt(couple.roads[role], ageOf(couple, role, at));
export const periodOf = (couple: Couple, role: Role, at: number) =>
  periodAt(couple.roads[role], Math.max(0, ageOf(couple, role, at)));

/** Null when today is past the end of the road, so there is nothing ahead to draw. */
export function buildCouple(bride: Journey, groom: Journey, words: CoupleWords): Couple | null {
  const journeys = { bride, groom };
  const births = { bride: new Date(bride.birth).getTime(), groom: new Date(groom.birth).getTime() };
  const origin = Math.min(births.bride, births.groom);
  const roads = { bride: buildRoad(bride), groom: buildRoad(groom) };
  const offset = { bride: (births.bride - origin) / YEAR_MS, groom: (births.groom - origin) / YEAR_MS };
  const today = (new Date(bride.now).getTime() - origin) / YEAR_MS;
  const last = Math.min(roads.bride.last + offset.bride, roads.groom.last + offset.groom);
  if (today >= last) return null;
  const start = Math.max(today - LOOK_BACK_YEARS, offset.bride, offset.groom);

  const bothMist: [number, number][] = [];
  for (const [a, b] of roads.bride.eras) {
    for (const [c, d] of roads.groom.eras) {
      const from = Math.max(a + offset.bride, c + offset.groom, start);
      const to = Math.min(b + offset.bride, d + offset.groom, last);
      if (to - from > 0.1) bothMist.push([from, to]);
    }
  }
  bothMist.sort((a, b) => a[0] - b[0]);

  const couple: Couple = { origin, roads, offset, start, today, last, bothMist, stops: [] };
  const stops: CoupleStop[] = [];
  for (const role of ROLES) {
    for (const stop of roads[role].stops) {
      const y = stop.y + offset[role];
      if (stop.kind === "birth" || stop.kind === "onward" || y <= start || y >= last) continue;
      stops.push({ ...stop, y, who: role });
    }
  }
  for (const [from, to] of bothMist) {
    if (from <= start) continue;
    stops.push({
      kind: "both_mist",
      y: from,
      tone: "careful",
      lord: "saturn",
      title: words.bothMist.title,
      text: words.bothMist.text.replace("{to}", String(coupleYear(couple, to))),
      helps: words.bothMist.helps,
      who: "both",
    });
  }
  stops.push({ kind: "today", y: today, tone: "good", lord: null, ...words.today, helps: null, who: "both" });
  // The elder's road ends first, so its last stop closes the shared road.
  const elder: Role = offset.bride <= offset.groom ? "bride" : "groom";
  const onward = journeys[elder].stops.find((stop) => stop.kind === "onward");
  if (onward) {
    stops.push({
      kind: "onward",
      y: last,
      tone: "good",
      lord: null,
      title: onward.title,
      text: onward.text,
      helps: null,
      who: "both",
    });
  }
  couple.stops = stops.sort((a, b) => a.y - b.y);
  return couple;
}

export type Phase = "both_good" | "both_hard" | "bride_hard" | "groom_hard" | "steady";

const lean = (quality: number): Tone => (quality >= 0.15 ? "good" : quality > -0.15 ? "mixed" : "careful");

/** How the two roads stand beside each other at one place. */
export function phaseAt(couple: Couple, at: number): { phase: Phase; tone: Tone } {
  const bride = lean(qualityOf(couple, "bride", at));
  const groom = lean(qualityOf(couple, "groom", at));
  if (bride === "good" && groom === "good") return { phase: "both_good", tone: "good" };
  if (bride === "careful" && groom === "careful") return { phase: "both_hard", tone: "careful" };
  if (bride === "careful") return { phase: "bride_hard", tone: "mixed" };
  if (groom === "careful") return { phase: "groom_hard", tone: "mixed" };
  return { phase: "steady", tone: bride === "good" || groom === "good" ? "good" : "mixed" };
}
