import type { components } from "./api-types";
import type { BirthRequest } from "./hadahan";
import type { Locale } from "./i18n";

export type Porondam = components["schemas"]["PorondamResponse"];
export type Match = NonNullable<Porondam["match"]>;
export type Factor = Match["factors"][number];
export type Person = NonNullable<Porondam["bride"]>;

export type QuickInput = { name: string; nakshatra: string; pada: number };
export type FullInput = BirthRequest & { name: string };
export type PersonInput = QuickInput | FullInput;

export type PorondamRequest = { bride: PersonInput; groom: PersonInput };

export type SavedMatch = { request: PorondamRequest; result: Porondam };

export const PORONDAM_KEY = "astronomia.porondam";

/** Birth details go in the body of a POST, never in the URL. */
export async function fetchPorondam(request: PorondamRequest, lang: Locale): Promise<Porondam> {
  const response = await fetch("/api/v1/porondam", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...request, lang }),
  });
  if (!response.ok) {
    const error = new Error(`request failed: ${response.status}`) as Error & { status: number };
    error.status = response.status;
    throw error;
  }
  return (await response.json()) as Porondam;
}

export type FactorFilter = "all" | "agree" | "disagree";

/** A factor that was not counted (it needs the birth dates) shows only under "all". */
export function filterFactors(factors: Factor[], filter: FactorFilter): Factor[] {
  if (filter === "agree") return factors.filter((f) => f.checked && f.passed);
  if (filter === "disagree") return factors.filter((f) => f.checked && !f.passed);
  return factors;
}

/** Stroke offset for a ring of the given circumference showing passed out of total. */
export function ringOffset(passed: number, total: number, circumference: number): number {
  if (total <= 0) return circumference;
  return circumference * (1 - Math.min(Math.max(passed / total, 0), 1));
}

export type TimelineResult = components["schemas"]["TimelineResponse"];
export type Timeline = NonNullable<TimelineResult["timeline"]>;
export type PersonTimeline = Timeline["bride"];

/** The next ten years for the couple. Birth details go in the body of a POST. */
export async function fetchTimeline(
  request: PorondamRequest,
  lang: Locale,
): Promise<TimelineResult> {
  const response = await fetch("/api/v1/porondam/timeline", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...request, lang }),
  });
  if (!response.ok) throw new Error(`request failed: ${response.status}`);
  return (await response.json()) as TimelineResult;
}

const dayNumber = (date: string) => Date.parse(`${date.slice(0, 10)}T00:00:00Z`) / 86_400_000;

/**
 * Where a span of dates sits on a time line, as percentages of the window.
 * The part outside the window is cut off. Null when nothing is left.
 */
export function spanPercent(
  start: string,
  end: string,
  windowStart: string,
  windowEnd: string,
): { left: number; width: number } | null {
  const [from, to] = [dayNumber(windowStart), dayNumber(windowEnd)];
  const [a, b] = [Math.max(dayNumber(start), from), Math.min(dayNumber(end), to)];
  if (!(to > from) || b <= a) return null;
  return { left: ((a - from) / (to - from)) * 100, width: ((b - a) / (to - from)) * 100 };
}

/** Each 1 January inside the window, with its place on the line. */
export function yearTicks(windowStart: string, windowEnd: string): { year: number; left: number }[] {
  const ticks = [];
  for (let year = Number(windowStart.slice(0, 4)) + 1; year <= Number(windowEnd.slice(0, 4)); year++) {
    const at = spanPercent(`${year}-01-01`, windowEnd, windowStart, windowEnd);
    if (at) ticks.push({ year, left: at.left });
  }
  return ticks;
}
