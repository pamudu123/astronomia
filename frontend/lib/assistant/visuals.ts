/**
 * The diagram beside each AI chapter (docs/17): which one a chapter shows, and the geometry of
 * the sky wheel and the life periods bar. The PDF report draws the same diagrams for the same
 * chapters (backend/app/reports/visuals.py and CHAPTER_VISUAL in render.py); keep them in step.
 * Nothing here works out a fact: it lays out what the engine returned.
 */

import { RASHI } from "@/lib/rashi";

import type { ChapterId } from "./explain";

export type VisualName = "pillars" | "wheel" | "houses" | "periods" | "mars" | "people" | "ring" | "checks";

/** The diagram each chapter shows under its short answer, and the houses it lights up. */
export const CHAPTER_VISUAL: Partial<Record<ChapterId, { visual: VisualName; houses?: number[] }>> = {
  "chart.summary": { visual: "pillars" },
  "chart.nature": { visual: "pillars" },
  "chart.planets": { visual: "wheel" },
  "chart.combinations": { visual: "wheel" },
  "chart.houses": { visual: "houses" },
  "chart.work": { visual: "houses", houses: [2, 10, 11] },
  "chart.love": { visual: "houses", houses: [7] },
  "chart.family": { visual: "houses", houses: [4] },
  "chart.studies": { visual: "houses", houses: [4, 5, 9] },
  "chart.abroad": { visual: "houses", houses: [9, 12] },
  "chart.periods": { visual: "periods" },
  "chart.care": { visual: "periods" },
  "chart.mars": { visual: "mars" },
  "match.people": { visual: "people" },
  "match.styles": { visual: "people" },
  "match.factors": { visual: "ring" },
  "match.summary": { visual: "ring" },
  "match.checks": { visual: "checks" },
  "match.mars": { visual: "checks" },
};

/**
 * Angles nudged apart so neighbours are at least `gap` degrees apart, keeping their order and
 * moving them as little as possible (least squares). The circle is cut at its widest empty
 * stretch, then neighbours that are too close are pooled (pool adjacent violators).
 */
export function spread(angles: number[], gap: number): number[] {
  const count = angles.length;
  if (count < 2) return [...angles];
  const step = Math.min(gap, 360 / count);
  const mod = (value: number) => ((value % 360) + 360) % 360;
  let order = angles.map((_, i) => i).sort((a, b) => mod(angles[a]) - mod(angles[b]));
  let line = order.map((i) => mod(angles[i]));
  // The empty stretch after each angle; after the last it runs on round to the first.
  const stretches = line.map((angle, k) => (k + 1 < count ? line[k + 1] - angle : line[0] + 360 - angle));
  const widest = stretches.indexOf(Math.max(...stretches));
  const start = (widest + 1) % count;
  line = [...line.slice(start), ...line.slice(0, start).map((a) => a + 360)];
  order = [...order.slice(start), ...order.slice(0, start)];
  const pools: { mean: number; size: number }[] = [];
  line.forEach((value, k) => {
    let mean = value - k * step;
    let size = 1;
    while (pools.length && pools[pools.length - 1].mean > mean) {
      const before = pools.pop()!;
      mean = (before.mean * before.size + mean * size) / (before.size + size);
      size += before.size;
    }
    pools.push({ mean, size });
  });
  const fitted = pools.flatMap(({ mean, size }) => Array<number>(size).fill(mean));
  const result = Array<number>(count).fill(0);
  order.forEach((i, k) => {
    result[i] = mod(fitted[k] + k * step);
  });
  return result;
}

export const WHEEL = 300;

/** A point on the wheel: degrees counter-clockwise from the right, in the wheel's units. */
export function point(angle: number, radius: number): [number, number] {
  const rad = (angle * Math.PI) / 180;
  return [WHEEL / 2 + radius * Math.cos(rad), WHEEL / 2 - radius * Math.sin(rad)];
}

export type WheelPlanet = { key: string; label: string; longitude: number };

/**
 * The sky wheel's layout: the lagna on the left, the signs running counter-clockwise from it
 * (each sign's sector is also its house), and each planet's dot and label, fanned out where
 * planets crowd together.
 */
export function wheelLayout(lagna: number, planets: WheelPlanet[]) {
  const angle = (longitude: number) => 180 + (longitude - lagna);
  const lagnaSign = Math.floor(lagna / 30);
  const signs = RASHI.map((rashi, sign) => ({
    key: rashi.key,
    image: `/images/glyphs/rashi-${String(sign + 1).padStart(2, "0")}-${rashi.key}.svg`,
    edge: angle(sign * 30),
    middle: angle(sign * 30 + 15),
    house: ((sign - lagnaSign + 12) % 12) + 1,
  }));
  const trueAngles = planets.map((p) => angle(p.longitude));
  const shown = spread(trueAngles, 15);
  return {
    signs,
    lagnaStart: angle(lagnaSign * 30),
    planets: planets.map((planet, i) => ({ ...planet, angle: trueAngles[i], labelAngle: shown[i] })),
  };
}

export type BarSpan = { label: string; start: string; end: string; now?: boolean };

const YEAR = 365.25 * 24 * 60 * 60 * 1000;

/**
 * The life periods as one bar from birth: each period's place and width in per cent, ages
 * every ten years, and today's mark (null outside the bar).
 */
export function barLayout(birth: string, spans: BarSpan[], today: Date = new Date()) {
  const from = Date.parse(birth);
  const end = spans.length ? Date.parse(spans[spans.length - 1].end) : from;
  const total = Math.max((end - from) / YEAR, 1);
  const at = (time: number) => (100 * Math.min(Math.max((time - from) / YEAR, 0), total)) / total;
  const segments = spans
    .map((span) => {
      const left = at(Math.max(Date.parse(span.start), from));
      return { ...span, left, width: at(Date.parse(span.end)) - left };
    })
    .filter((segment) => segment.width > 0);
  const ages = Array.from({ length: Math.floor(total / 10) }, (_, i) => ({
    age: (i + 1) * 10,
    left: (100 * (i + 1) * 10) / total,
  }));
  const now = today.getTime();
  return { segments, ages, today: now >= from && now <= end ? at(now) : null };
}
