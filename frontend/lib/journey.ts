/** The life road on the hadahan page: the engine's journey, turned into ages along one road. */

import type { components } from "./api-types";
import type { BirthRequest } from "./hadahan";
import type { Locale } from "./i18n";

export type JourneyResult = components["schemas"]["JourneyResponse"];
export type Journey = NonNullable<JourneyResult["journey"]>;
export type Tone = Journey["periods"][number]["tone"];

const YEAR_MS = 365.25 * 86400000;

/** Every road is this long, whatever the chart says. */
export const ROAD_YEARS = 100;
/** From this age the road softens into light. */
export const FADE_AGE = 92;
/** How close to a stop, in years, its card shows. */
export const STOP_REACH = 0.45;

export type RoadSub = {
  lord: string;
  main: number; // index of its main period
  s: number;
  e: number;
  house: number;
  theme: string;
  tone: Tone;
  start: string;
  end: string;
};

export type RoadPeriod = {
  lord: string;
  s: number; // age the period begins, never before birth
  e: number;
  house: number;
  theme: string;
  tone: Tone;
  start: string;
  end: string;
};

export type RoadStop = {
  kind: Journey["stops"][number]["kind"] | "today";
  y: number;
  tone: Tone;
  lord: string | null;
  title: string;
  text: string;
  helps: string | null;
};

export type Road = {
  birth: number; // ms
  today: number; // age now
  last: number; // the furthest age the road can be travelled to
  periods: RoadPeriod[];
  subs: RoadSub[];
  eras: [number, number][];
  stops: RoadStop[];
  quality: number[];
  step: number; // years between quality values
};

export async function fetchJourney(request: BirthRequest, lang: Locale): Promise<JourneyResult> {
  const response = await fetch("/api/v1/journey", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...request, lang }),
  });
  if (!response.ok) throw new Error(`request failed: ${response.status}`);
  return (await response.json()) as JourneyResult;
}

const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));

export function buildRoad(journey: Journey): Road {
  const birth = new Date(journey.birth).getTime();
  const age = (iso: string) => (new Date(iso).getTime() - birth) / YEAR_MS;
  const periods: RoadPeriod[] = [];
  const subs: RoadSub[] = [];
  journey.periods.forEach((period, index) => {
    periods.push({
      lord: period.lord,
      s: Math.max(0, age(period.start)),
      e: age(period.end),
      house: period.house,
      theme: period.theme,
      tone: period.tone,
      start: period.start,
      end: period.end,
    });
    for (const sub of period.sub) {
      subs.push({
        lord: sub.lord,
        main: index,
        s: Math.max(0, age(sub.start)),
        e: age(sub.end),
        house: sub.house,
        theme: sub.theme,
        tone: sub.tone,
        start: sub.start,
        end: sub.end,
      });
    }
  });
  const stops: RoadStop[] = journey.stops.map((stop) => ({
    kind: stop.kind,
    y: age(stop.at),
    tone: stop.tone,
    lord: stop.lord ?? null,
    title: stop.title,
    text: stop.text,
    helps: stop.helps ?? null,
  }));
  const last = stops.length ? stops[stops.length - 1].y : ROAD_YEARS - 4;
  return {
    birth,
    today: clamp(age(journey.now), 0, last),
    last,
    periods,
    subs,
    eras: journey.erashtaka.map((span) => [Math.max(0, age(span.start)), age(span.end)]),
    stops,
    quality: journey.quality.values,
    step: journey.quality.step_days / 365.25,
  };
}

/** Adds the "you are here" stop, unless today is past the end of the road. */
export function withToday(road: Road, title: string, text: string): Road {
  if (road.today >= road.last) return road;
  const tone = periodAt(road, road.today).tone;
  const today: RoadStop = { kind: "today", y: road.today, tone, lord: null, title, text, helps: null };
  const stops = [...road.stops, today].sort((a, b) => a.y - b.y);
  return { ...road, stops };
}

export function periodIndex(road: Road, age: number): number {
  const index = road.periods.findIndex((period) => age < period.e);
  return index < 0 ? road.periods.length - 1 : index;
}

export const periodAt = (road: Road, age: number): RoadPeriod => road.periods[periodIndex(road, age)];

export function subAt(road: Road, age: number): RoadSub {
  return road.subs.find((sub) => age < sub.e) ?? road.subs[road.subs.length - 1];
}

/** How easy the road is at an age: -1 (hard going) to 1 (clear road). */
export function qualityAt(road: Road, age: number): number {
  const at = clamp(age / road.step, 0, road.quality.length - 1);
  const low = Math.floor(at);
  const high = Math.min(low + 1, road.quality.length - 1);
  return road.quality[low] + (road.quality[high] - road.quality[low]) * (at - low);
}

/** 1 inside Erashtaka, easing to 0 over a few months at each end. */
export function mistAt(road: Road, age: number): number {
  let most = 0;
  for (const [from, to] of road.eras) {
    most = Math.max(most, clamp(Math.min(age - from, to - age) / 0.3 + 1, 0, 1));
  }
  return most;
}

/** 0 until the fade begins, 1 at the road's end. */
export const fadeAt = (age: number) => clamp((age - FADE_AGE) / (ROAD_YEARS - FADE_AGE), 0, 1);

export type RoadWord = "clear" | "good" | "steady" | "rough" | "hard";

export function roadWord(quality: number): { word: RoadWord; tone: Tone } {
  if (quality >= 0.5) return { word: "clear", tone: "good" };
  if (quality >= 0.15) return { word: "good", tone: "good" };
  if (quality > -0.15) return { word: "steady", tone: "mixed" };
  if (quality > -0.5) return { word: "rough", tone: "careful" };
  return { word: "hard", tone: "careful" };
}

/** The stop whose card shows at this age, if one is close enough. */
export function stopNear(road: Road, age: number): RoadStop | null {
  let near: RoadStop | null = null;
  let best = STOP_REACH;
  for (const stop of road.stops) {
    const gap = Math.abs(stop.y - age);
    if (gap < best) {
      best = gap;
      near = stop;
    }
  }
  return near;
}

/** The next stop ahead of (direction 1) or behind (direction -1) an age. */
export function stopBeside(road: Road, age: number, direction: 1 | -1): RoadStop | null {
  if (direction > 0) return road.stops.find((stop) => stop.y > age + 0.02) ?? null;
  return [...road.stops].reverse().find((stop) => stop.y < age - 0.02) ?? null;
}

export const yearAt = (road: Road, age: number) => new Date(road.birth + age * YEAR_MS).getUTCFullYear();
