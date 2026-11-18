import type { components } from "./api-types";
import type { BirthRequest, Labels } from "./hadahan";
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

/**
 * Whether a factor counts towards the score. Only an explicit `checked: false` means not
 * counted, as the API's default is true: a result from before the field existed (a saved
 * match, an old share link or an older backend) counts every factor (QA UI-01).
 */
export const isCounted = (factor: Pick<Factor, "checked">): boolean => factor.checked !== false;

/** A factor that was not counted (it needs the birth dates) shows only under "all". */
export function filterFactors(factors: Factor[], filter: FactorFilter): Factor[] {
  if (filter === "agree") return factors.filter((f) => isCounted(f) && f.passed);
  if (filter === "disagree") return factors.filter((f) => isCounted(f) && !f.passed);
  return factors;
}

export type Themes = NonNullable<Labels["porondam_theme"]>;

/** One life area of the summary chart, with its factors in the result's order. */
export type FactorGroup = {
  /** The theme id, or "" for factors no theme names. */
  id: string;
  /** The theme's name, or "" for the group with no name. */
  name: string;
  factors: Factor[];
  /** How many of the counted factors agree. */
  agree: number;
  /** How many factors count. Ones that need the birth dates may not. */
  counted: number;
};

const group = (id: string, name: string, factors: Factor[]): FactorGroup => ({
  id,
  name,
  factors,
  agree: factors.filter((f) => isCounted(f) && f.passed).length,
  counted: factors.filter(isCounted).length,
});

/**
 * The factors grouped by life area, in the themes' order. A factor no theme names (a newer
 * rule set, or labels from an older backend) goes in a last group with no name, so the chart
 * never drops one. Themes with no factor in this result are left out.
 */
export function groupFactors(factors: Factor[], themes: Themes | undefined): FactorGroup[] {
  const groups: FactorGroup[] = [];
  const placed = new Set<string>();
  for (const [id, theme] of Object.entries(themes ?? {})) {
    const inTheme = factors.filter((f) => theme.factors.includes(f.id) && !placed.has(f.id));
    inTheme.forEach((f) => placed.add(f.id));
    if (inTheme.length) groups.push(group(id, theme.name, inTheme));
  }
  const rest = factors.filter((f) => !placed.has(f.id));
  if (rest.length) groups.push(group("", "", rest));
  return groups;
}

/**
 * Where each factor's segment sits on the summary ring, in degrees clockwise from the top.
 * Groups are split by a wider gap than the segments inside them.
 */
export function ringSegments(
  sizes: number[],
  groupGap: number,
  segmentGap: number,
): { start: number; end: number }[] {
  const total = sizes.reduce((sum, n) => sum + n, 0);
  if (total <= 0) return [];
  const gaps = sizes.length > 1 ? sizes.length * groupGap : 0;
  const each = (360 - gaps) / total;
  const segments = [];
  let at = sizes.length > 1 ? groupGap / 2 : 0;
  for (const size of sizes) {
    for (let i = 0; i < size; i++) {
      segments.push({ start: at + segmentGap / 2, end: at + each - segmentGap / 2 });
      at += each;
    }
    if (sizes.length > 1) at += groupGap;
  }
  return segments;
}

/** Stroke offset for a ring of the given circumference showing passed out of total. */
export function ringOffset(passed: number, total: number, circumference: number): number {
  if (total <= 0) return circumference;
  return circumference * (1 - Math.min(Math.max(passed / total, 0), 1));
}

export type TimelineResult = components["schemas"]["TimelineResponse"];
export type Timeline = NonNullable<TimelineResult["timeline"]>;
export type PersonTimeline = Timeline["bride"];

// One request per couple and language while the page is open: "Years ahead for the couple"
// and the written reading (the couple's years ahead) both use it.
const timelines = new Map<string, Promise<TimelineResult>>();

/** The next ten years for the couple. Birth details go in the body of a POST. */
export function fetchTimeline(request: PorondamRequest, lang: Locale): Promise<TimelineResult> {
  const key = JSON.stringify([request, lang]);
  const known = timelines.get(key);
  if (known) return known;
  const pending = (async () => {
    const response = await fetch("/api/v1/porondam/timeline", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...request, lang }),
    });
    if (!response.ok) throw new Error(`request failed: ${response.status}`);
    return (await response.json()) as TimelineResult;
  })();
  timelines.set(key, pending);
  pending.catch(() => timelines.delete(key)); // a failed request can be tried again
  return pending;
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
