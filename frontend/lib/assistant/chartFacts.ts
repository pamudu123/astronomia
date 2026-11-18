import type { Chart, Dasha, Labels } from "@/lib/hadahan";

import type { Json } from "./context";

/**
 * Chart facts the assistant reads like an astrologer reads a chart: who rules each house and
 * where that ruler sits, which planets look at each house, how strong each planet is in its
 * sign, a few well-known combinations, and the sub-periods of the running life period.
 *
 * All of this is table look-ups on what the engine already worked out (signs, houses and the
 * ninth-division sign of each planet). Nothing here calculates a position or a date. Doing
 * it here means the model reads facts instead of counting signs, which it gets wrong.
 *
 * The rules are the common core of the tradition and are provisional until the astrologer
 * review: whole-sign houses, the classical aspects (no aspects for Rahu and Ketu, where
 * traditions differ), and the usual own, exalted and debilitated signs.
 */

const SIGNS = [
  "mesha",
  "vrishabha",
  "mithuna",
  "kataka",
  "simha",
  "kanya",
  "tula",
  "vrischika",
  "dhanu",
  "makara",
  "kumbha",
  "meena",
] as const;

const SIGN_LORD: Record<string, string> = {
  mesha: "mars",
  vrishabha: "venus",
  mithuna: "mercury",
  kataka: "moon",
  simha: "sun",
  kanya: "mercury",
  tula: "venus",
  vrischika: "mars",
  dhanu: "jupiter",
  makara: "saturn",
  kumbha: "saturn",
  meena: "jupiter",
};

const OWN: Record<string, string[]> = {
  sun: ["simha"],
  moon: ["kataka"],
  mars: ["mesha", "vrischika"],
  mercury: ["mithuna", "kanya"],
  jupiter: ["dhanu", "meena"],
  venus: ["vrishabha", "tula"],
  saturn: ["makara", "kumbha"],
};

const EXALTED: Record<string, string> = {
  sun: "mesha",
  moon: "vrishabha",
  mars: "makara",
  mercury: "kanya",
  jupiter: "kataka",
  venus: "meena",
  saturn: "tula",
};

const DEBILITATED: Record<string, string> = {
  sun: "tula",
  moon: "vrischika",
  mars: "kataka",
  mercury: "meena",
  jupiter: "makara",
  venus: "kanya",
  saturn: "mesha",
};

/** Houses each planet looks at, counted from its own house (1 = its own house). */
const ASPECTS: Record<string, number[]> = {
  sun: [7],
  moon: [7],
  mercury: [7],
  venus: [7],
  mars: [4, 7, 8],
  jupiter: [5, 7, 9],
  saturn: [3, 7, 10],
};

/** The five "great person" combinations: the planet strong in an angular house. */
const MAHAPURUSHA: Record<string, string> = {
  mars: "Ruchaka",
  mercury: "Bhadra",
  jupiter: "Hamsa",
  venus: "Malavya",
  saturn: "Shasha",
};

const ANGULAR = new Set([1, 4, 7, 10]);

export type Strength = "exalted" | "own sign" | "debilitated";

export function strength(body: string, sign: string): Strength | null {
  if (EXALTED[body] === sign) return "exalted";
  if (OWN[body]?.includes(sign)) return "own sign";
  if (DEBILITATED[body] === sign) return "debilitated";
  return null;
}

/** The house `count` houses on from `house`, counting `house` itself as 1. */
function houseFrom(house: number, count: number): number {
  return ((house - 1 + count - 1) % 12) + 1;
}

type Names = { sign: (key: string) => string; planet: (key: string) => string };

function namesFrom(labels: Labels): Names {
  return {
    sign: (key) => labels.rashi[key]?.name ?? key,
    planet: (key) => labels.planet[key]?.name ?? key,
  };
}

/** Each house: its sign, its ruler and where the ruler sits, the planets in it and looking at it. */
export function houseFacts(chart: Chart, labels: Labels): Json[] {
  const names = namesFrom(labels);
  const start = SIGNS.indexOf(chart.lagna.sign as (typeof SIGNS)[number]);
  if (start < 0) return [];
  const houseOf = new Map<string, number>(chart.planets.map((p) => [p.body, p.house]));
  return Array.from({ length: 12 }, (_, i) => {
    const house = i + 1;
    const sign = SIGNS[(start + i) % 12];
    const lord = SIGN_LORD[sign];
    const inside = chart.planets.filter((p) => p.house === house).map((p) => names.planet(p.body));
    const lookers = chart.planets
      .filter((p) => (ASPECTS[p.body] ?? []).some((n) => houseFrom(p.house, n) === house))
      .map((p) => names.planet(p.body));
    return {
      house,
      sign: names.sign(sign),
      lord: names.planet(lord),
      lord_in_house: houseOf.get(lord) ?? null,
      ...(inside.length && { planets: inside }),
      ...(lookers.length && { aspected_by: lookers }),
    };
  });
}

/** Strength, ruled houses and same-sign-in-the-ninth-division (vargottama) for each planet. */
export function planetFacts(chart: Chart, labels: Labels): Json[] {
  const names = namesFrom(labels);
  const start = SIGNS.indexOf(chart.lagna.sign as (typeof SIGNS)[number]);
  return chart.planets.map((p) => {
    const ruled =
      start < 0
        ? []
        : SIGNS.map((sign, i) => ({ sign, house: ((i - start + 12) % 12) + 1 }))
            .filter(({ sign }) => SIGN_LORD[sign] === p.body)
            .map(({ house }) => house)
            .sort((a, b) => a - b);
    const power = strength(p.body, p.sign);
    return {
      planet: names.planet(p.body),
      sign: names.sign(p.sign),
      house: p.house,
      ...(power && { strength: power }),
      ...(ruled.length && { rules_houses: ruled }),
      ...(p.retrograde && { retrograde: true }),
      ...(p.navamsha_sign === p.sign && { vargottama: true }),
    };
  });
}

/** A planet's sign and house: all a combination needs. A chart's planets, or a match person's. */
export type Placement = { body: string; sign: string; house: number };

/** Natural friendship between the seven planets (the classical table). Rahu and Ketu have none. */
const FRIENDS: Record<string, string[]> = {
  sun: ["moon", "mars", "jupiter"],
  moon: ["sun", "mercury"],
  mars: ["sun", "moon", "jupiter"],
  mercury: ["sun", "venus"],
  jupiter: ["sun", "moon", "mars"],
  venus: ["mercury", "saturn"],
  saturn: ["mercury", "venus"],
};

// The same enemies as the match rules (backend porondam rules, `enemies`).
const ENEMIES: Record<string, string[]> = {
  sun: ["venus", "saturn"],
  moon: [],
  mars: ["mercury"],
  mercury: ["moon"],
  jupiter: ["mercury", "venus"],
  venus: ["sun", "moon"],
  saturn: ["sun", "moon", "mars"],
};

export type Relation = "same planet" | "friends" | "neutral" | "enemies" | "mixed";

/**
 * How two planets regard each other: each one's view of the other, joined. "mixed" when one
 * counts the other a friend and the other doesn't return it.
 */
export function relation(a: string, b: string): Relation {
  if (a === b) return "same planet";
  const view = (from: string, to: string) =>
    FRIENDS[from]?.includes(to) ? 1 : ENEMIES[from]?.includes(to) ? -1 : 0;
  const both = [view(a, b), view(b, a)];
  if (both[0] === both[1]) return both[0] === 1 ? "friends" : both[0] === -1 ? "enemies" : "neutral";
  return "mixed";
}

/** The ruler of the 7th house (marriage and partnership) for a rising sign. */
export function seventhLord(lagna: string): string | null {
  const start = SIGNS.indexOf(lagna as (typeof SIGNS)[number]);
  return start < 0 ? null : SIGN_LORD[SIGNS[(start + 6) % 12]];
}

// Planets the tradition counts as hard (krura) and gentle (saumya) for the hemming rules.
const HARD = ["sun", "mars", "saturn", "rahu", "ketu"];
const GENTLE = ["mercury", "jupiter", "venus"];

/**
 * Hemming (kartari): a house with hard planets in the houses on both sides of it (papa
 * kartari), or gentle ones (shubha kartari). Read for the 1st house, the 7th and the Moon.
 */
function hemmed(planets: Placement[], house: number, kind: "papa" | "shubha"): boolean {
  const group = kind === "papa" ? HARD : GENTLE;
  const before = houseFrom(house, 12);
  const after = houseFrom(house, 2);
  const has = (h: number) => planets.some((p) => p.house === h && group.includes(p.body));
  return has(before) && has(after);
}

/** Well-known combinations found in the chart, each with the placements behind it. */
export function combinations(chart: { planets: Placement[] }, labels: Labels): Json[] {
  const names = namesFrom(labels);
  const at = new Map<string, Placement>(chart.planets.map((p) => [p.body, p]));
  const found: Json[] = [];
  const moon = at.get("moon");
  const jupiter = at.get("jupiter");
  if (moon && jupiter && [0, 3, 6, 9].includes((jupiter.house - moon.house + 12) % 12)) {
    found.push({
      name: "Gajakesari yoga",
      based_on: `${names.planet("jupiter")} in house ${jupiter.house}, an angle from ${names.planet("moon")} in house ${moon.house}`,
    });
  }
  const sun = at.get("sun");
  const mercury = at.get("mercury");
  if (sun && mercury && sun.house === mercury.house) {
    found.push({
      name: "Budhaditya yoga",
      based_on: `${names.planet("sun")} and ${names.planet("mercury")} together in house ${sun.house}`,
    });
  }
  const mars = at.get("mars");
  if (moon && mars && moon.house === mars.house) {
    found.push({
      name: "Chandra-Mangala yoga",
      based_on: `${names.planet("moon")} and ${names.planet("mars")} together in house ${moon.house}`,
    });
  }
  // Two planets together that tradition reads for relationships (docs/17, match chapter 5).
  const pairs: [string, string, string][] = [
    ["sun", "venus", "Ravi-Sukra yoga"],
    ["mars", "venus", "Kuja-Sukra yoga"],
    ["saturn", "mars", "Shani-Mangala yoga"],
  ];
  for (const [a, b, name] of pairs) {
    const first = at.get(a);
    const second = at.get(b);
    if (first && second && first.house === second.house) {
      found.push({
        name,
        based_on: `${names.planet(a)} and ${names.planet(b)} together in house ${first.house}`,
      });
    }
  }
  // Planets on either side of the Moon (Sunapha, Anapha, Durudhara). The Sun, Rahu and Ketu
  // don't count.
  if (moon) {
    const counts = (h: number) =>
      chart.planets.some((p) => p.house === h && !["sun", "moon", "rahu", "ketu"].includes(p.body));
    const second = counts(houseFrom(moon.house, 2));
    const twelfth = counts(houseFrom(moon.house, 12));
    const name = second && twelfth ? "Durudhara yoga" : second ? "Sunapha yoga" : twelfth ? "Anapha yoga" : null;
    if (name) {
      found.push({
        name,
        based_on: `planets in the house${second && twelfth ? "s" : ""} ${[second && "after", twelfth && "before"].filter(Boolean).join(" and ")} the ${names.planet("moon")}'s house ${moon.house}`,
      });
    }
  }
  // Hemming of the 1st house, the 7th and the Moon's house.
  const places: [number | undefined, string][] = [
    [1, "the 1st house (self)"],
    [7, "the 7th house (marriage and partnership)"],
    [moon?.house, `the ${names.planet("moon")}'s house`],
  ];
  for (const [house, what] of places) {
    if (!house) continue;
    if (hemmed(chart.planets, house, "papa")) {
      found.push({ name: "Papa Kartari", based_on: `hard planets on both sides of ${what}` });
    } else if (hemmed(chart.planets, house, "shubha")) {
      found.push({ name: "Shubha Kartari", based_on: `gentle planets on both sides of ${what}` });
    }
  }
  for (const [body, yoga] of Object.entries(MAHAPURUSHA)) {
    const p = at.get(body);
    const power = p && strength(body, p.sign);
    if (p && ANGULAR.has(p.house) && (power === "exalted" || power === "own sign")) {
      found.push({
        name: `${yoga} yoga`,
        based_on: `${names.planet(body)} in ${power === "exalted" ? "its exalted sign" : "its own sign"} ${names.sign(p.sign)}, in house ${p.house}`,
      });
    }
  }
  return found;
}

const day = (iso: string) => iso.slice(0, 10);

/**
 * The sub-periods of the running main period, and the main periods after it. The first
 * main period is never included: it is tied to the birth date.
 */
export function periodTimeline(dasha: Dasha, labels: Labels, ahead = 2): Json | null {
  const names = namesFrom(labels);
  const now = dasha.current[0];
  if (!now) return null;
  const index = dasha.periods.findIndex((p) => p.start === now.start);
  if (index < 0) return null;
  const main = dasha.periods[index];
  return {
    ...(index > 0 && {
      sub_periods: main.sub.map((s) => ({
        sub: names.planet(s.lord),
        from: day(s.start),
        until: day(s.end),
      })),
    }),
    later_periods: dasha.periods.slice(index + 1, index + 1 + ahead).map((p) => ({
      period: names.planet(p.lord),
      from: day(p.start),
      until: day(p.end),
    })),
  };
}

/**
 * The life periods for a written reading: the sub-periods of the running period and every
 * later period, each with its own sub-periods. Longer than `periodTimeline`, which the chat
 * gets with every message. The first main period is still left out: it is tied to the birth
 * date.
 */
export function lifeTimeline(dasha: Dasha, labels: Labels): Json | null {
  const names = namesFrom(labels);
  const now = dasha.current[0];
  if (!now) return null;
  const index = dasha.periods.findIndex((p) => p.start === now.start);
  if (index < 0) return null;
  const subs = (period: Dasha["periods"][number]) =>
    period.sub.map((s) => ({ sub: names.planet(s.lord), from: day(s.start), until: day(s.end) }));
  return {
    ...(index > 0 && { sub_periods: subs(dasha.periods[index]) }),
    later_periods: dasha.periods.slice(index + 1).map((p) => ({
      period: names.planet(p.lord),
      from: day(p.start),
      until: day(p.end),
      sub_periods: subs(p),
    })),
  };
}
