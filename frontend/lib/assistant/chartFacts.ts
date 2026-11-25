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

/**
 * The life area each house stands for, in the words the assistant should use. Sent with the
 * facts because the model mixes up which house a life area belongs to, and then names the wrong
 * ruler (AI evaluation, 2026-11-25). The same areas as personal-reading/reference.md, section 4;
 * the 8th in its careful wording.
 */
export const HOUSE_AREA: Record<number, string> = {
  1: "self, body, how you start things",
  2: "family you were born into, savings, speech",
  3: "siblings, courage, communication, short trips",
  4: "home, mother, property, inner peace",
  5: "children, creativity, studies, romance",
  6: "daily work, health habits, debts, competition",
  7: "marriage, partnership",
  8: "change, shared money, research",
  9: "luck, father, teachers, higher learning, long journeys",
  10: "career, status",
  11: "income, gains, friends, networks",
  12: "spending, rest, living abroad",
};

/** Each house: its life area, its sign, its ruler and where the ruler sits, the planets in it and looking at it. */
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
      area: HOUSE_AREA[house],
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
  const sun = chart.planets.find((p) => p.body === "sun");
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
      area: HOUSE_AREA[p.house],
      ...(power && { strength: power }),
      ...(ruled.length && { rules_houses: ruled }),
      ...(isYogaKaraka(ruled) && { yoga_karaka: true }),
      ...(p.retrograde && { retrograde: true }),
      ...(p.navamsha_sign === p.sign && { vargottama: true }),
      ...(sun && p.body !== "sun" && combust(p.body, p.longitude, sun.longitude, p.retrograde) && { combust: true }),
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

/** Every combination the site looks for, without the variant in brackets. */
export const COMBINATIONS = [
  "Gajakesari yoga",
  "Budhaditya yoga",
  "Chandra-Mangala yoga",
  "Ruchaka yoga",
  "Bhadra yoga",
  "Hamsa yoga",
  "Malavya yoga",
  "Shasha yoga",
  "Sunapha yoga",
  "Anapha yoga",
  "Durudhara yoga",
  "Ravi-Sukra yoga",
  "Kuja-Sukra yoga",
  "Shani-Mangala yoga",
  "Papa Kartari",
  "Shubha Kartari",
  "Neecha Bhanga Raja yoga",
  "Raja yoga",
  "Dhana yoga",
  "Vipareeta Raja yoga",
  "Guru-Chandala yoga",
  "Angaraka yoga",
  "Guru-Mangala yoga",
  "Kala Sarpa",
  "Amala yoga",
  "Saraswati yoga",
  "Vasumathi yoga",
  "Kemadruma yoga",
] as const;

/**
 * The combinations the site looked for and did not find. Asked "do I have X yoga?", the model
 * sometimes said yes to one that isn't there (AI evaluation, 2026-11-25): here it reads the no.
 */
export function combinationsNotFound(chart: { planets: Placement[] }, labels: Labels): string[] {
  const found = new Set(
    combinations(chart, labels).map((c) => String((c as { name: string }).name).replace(/ \(.*\)$/, "")),
  );
  return COMBINATIONS.filter((name) => !found.has(name));
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
  found.push(...moreCombinations(chart.planets, names));
  return found;
}

// Combinations added from the lankaastrology.com yoga articles (November 2026), checked against
// the classical definitions. Provisional until the astrologer review, like the ones above. The
// personal-reading reference (section 14) says what each means and how to word it.

const SEVEN = ["sun", "moon", "mars", "mercury", "jupiter", "venus", "saturn"];
const TRUE_PLANETS = ["mars", "mercury", "jupiter", "venus", "saturn"];

/** Kala Sarpa names by the house Rahu is in, 1 to 12. */
const KALA_SARPA = [
  "Anantha",
  "Kulika",
  "Vasuki",
  "Shankhapala",
  "Padma",
  "Mahapadma",
  "Takshaka",
  "Karkotaka",
  "Shankhachuda",
  "Ghataka",
  "Vishadhara",
  "Sheshanaga",
];

/** Vipareeta Raja yoga's three kinds, by the house whose ruler forms it. */
const VIPAREETA: Record<number, string> = { 6: "Harsha", 8: "Sarala", 12: "Vimala" };

/** The rising sign, worked back from any placement: house 1 is `house - 1` signs before it. */
function risingIndex(planets: Placement[]): number {
  const p = planets.find((q) => SIGNS.includes(q.sign as (typeof SIGNS)[number]));
  return p ? (SIGNS.indexOf(p.sign as (typeof SIGNS)[number]) - (p.house - 1) + 12) % 12 : -1;
}

/** Houses counted from one house to another, both included: the same house is 1. */
function countFrom(from: number, to: number): number {
  return ((to - from + 12) % 12) + 1;
}

function moreCombinations(planets: Placement[], names: Names): Json[] {
  const found: Json[] = [];
  const at = new Map<string, Placement>(planets.map((p) => [p.body, p]));
  const rising = risingIndex(planets);
  const moon = at.get("moon");
  const together = (a: string, b: string) => !!at.get(a) && at.get(a)?.house === at.get(b)?.house;
  const lordOf = (house: number) => (rising < 0 ? null : SIGN_LORD[SIGNS[(rising + house - 1) % 12]]);
  const ruled = (body: string) =>
    rising < 0 ? [] : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].filter((h) => lordOf(h) === body);
  const where = (body: string) => `${names.planet(body)} in house ${at.get(body)?.house}`;
  const kendraFromLagnaOrMoon = (p: Placement) =>
    ANGULAR.has(p.house) || (!!moon && ANGULAR.has(countFrom(moon.house, p.house)));

  // Neecha Bhanga: a debilitated planet whose sign's ruler, or the planet exalted in that sign,
  // is in an angle from the rising sign or the Moon.
  for (const [body, sign] of Object.entries(DEBILITATED)) {
    const p = at.get(body);
    if (!p || p.sign !== sign) continue;
    const helpers = [SIGN_LORD[sign], ...Object.keys(EXALTED).filter((b) => EXALTED[b] === sign)]
      .filter((b) => b !== body)
      .filter((b, i, all) => all.indexOf(b) === i);
    const helper = helpers.find((b) => {
      const h = at.get(b);
      return h && kendraFromLagnaOrMoon(h);
    });
    if (helper) {
      found.push({
        name: "Neecha Bhanga Raja yoga",
        based_on: `${names.planet(body)} debilitated in ${names.sign(sign)}, helped by ${where(helper)}, an angle from the rising sign or the ${names.planet("moon")}`,
      });
    }
  }

  // Two planets joined by sitting together or by being in each other's signs (exchange).
  const linked = (a: string, b: string) => {
    const pa = at.get(a);
    const pb = at.get(b);
    if (!pa || !pb || a === b) return null;
    if (pa.house === pb.house) return `together in house ${pa.house}`;
    if (SIGN_LORD[pa.sign] === b && SIGN_LORD[pb.sign] === a) return "in each other's signs";
    return null;
  };
  const pairs = (first: number[], second: number[], name: string) => {
    if (rising < 0) return;
    const seen = new Set<string>();
    for (const h1 of first) {
      for (const h2 of second) {
        const a = lordOf(h1);
        const b = lordOf(h2);
        if (!a || !b || a === b) continue;
        const key = [a, b].sort().join("+");
        const how = linked(a, b);
        if (!how || seen.has(key)) continue;
        seen.add(key);
        found.push({
          name,
          based_on: `${names.planet(a)} (ruler of house ${ruled(a).join(" and ")}) and ${names.planet(b)} (ruler of house ${ruled(b).join(" and ")}) ${how}`,
        });
      }
    }
  };
  // Raja yoga: a ruler of an angle with a ruler of a trine. Dhana yoga: a ruler of the 2nd or
  // 11th (money) with a ruler of the 1st, 5th or 9th (fortune).
  pairs([1, 4, 7, 10], [1, 5, 9], "Raja yoga");
  pairs([2, 11], [1, 5, 9], "Dhana yoga");

  // Vipareeta Raja yoga: the ruler of the 6th, 8th or 12th sitting in the 6th, 8th or 12th.
  for (const house of [6, 8, 12]) {
    const lord = lordOf(house);
    const p = lord ? at.get(lord) : undefined;
    if (lord && p && [6, 8, 12].includes(p.house)) {
      found.push({
        name: `Vipareeta Raja yoga (${VIPAREETA[house]})`,
        based_on: `${names.planet(lord)}, ruler of house ${house}, in house ${p.house}`,
      });
    }
  }

  // Pairs that tradition names.
  const named: [string, string, string][] = [
    ["jupiter", "rahu", "Guru-Chandala yoga"],
    ["mars", "rahu", "Angaraka yoga"],
  ];
  for (const [a, b, name] of named) {
    if (together(a, b)) found.push({ name, based_on: `${names.planet(a)} and ${names.planet(b)} together in house ${at.get(a)?.house}` });
  }
  const mars = at.get("mars");
  const jupiter = at.get("jupiter");
  if (mars && jupiter && [1, 7].includes(countFrom(mars.house, jupiter.house))) {
    found.push({
      name: "Guru-Mangala yoga",
      based_on:
        mars.house === jupiter.house
          ? `${names.planet("jupiter")} and ${names.planet("mars")} together in house ${mars.house}`
          : `${names.planet("jupiter")} in house ${jupiter.house} and ${names.planet("mars")} in house ${mars.house}, facing each other`,
    });
  }

  // Kala Sarpa: all seven planets on one side of the Rahu-Ketu line (signs of the nodes included).
  const rahu = at.get("rahu");
  const seven = SEVEN.map((b) => at.get(b)).filter((p): p is Placement => !!p);
  if (rahu && seven.length === 7) {
    const side = seven.map((p) => countFrom(rahu.house, p.house) - 1); // 0 is Rahu's house, 6 Ketu's
    if (side.every((d) => d <= 6) || side.every((d) => d === 0 || d >= 6)) {
      found.push({
        name: `Kala Sarpa (${KALA_SARPA[rahu.house - 1]})`,
        based_on: `all seven planets on one side of ${names.planet("rahu")} in house ${rahu.house} and ${names.planet("ketu")}`,
      });
    }
  }

  // Amala: a gentle planet in the 10th from the rising sign or the Moon, with no hard planet there.
  for (const [from, label] of [
    [1, "the rising sign"],
    [moon?.house, `the ${names.planet("moon")}`],
  ] as const) {
    if (!from) continue;
    const tenth = houseFrom(from, 10);
    const inside = planets.filter((p) => p.house === tenth);
    const gentle = inside.filter((p) => GENTLE.includes(p.body));
    if (gentle.length && !inside.some((p) => HARD.includes(p.body))) {
      found.push({
        name: "Amala yoga",
        based_on: `${gentle.map((p) => names.planet(p.body)).join(" and ")} in house ${tenth}, the 10th from ${label}`,
      });
      break;
    }
  }

  // Saraswati: Mercury, Jupiter and Venus all in angles, trines or the 2nd, with Jupiter in its
  // own, exalted or a friend's sign.
  const good = new Set([1, 2, 4, 5, 7, 9, 10]);
  const friendSigns = ["simha", "kataka", "mesha", "vrischika"]; // signs of the Sun, Moon, Mars
  if (
    jupiter &&
    GENTLE.every((b) => at.get(b) && good.has(at.get(b)!.house)) &&
    (strength("jupiter", jupiter.sign) === "own sign" ||
      strength("jupiter", jupiter.sign) === "exalted" ||
      friendSigns.includes(jupiter.sign))
  ) {
    found.push({
      name: "Saraswati yoga",
      based_on: `${GENTLE.map(where).join(", ")}, with ${names.planet("jupiter")} well placed in ${names.sign(jupiter.sign)}`,
    });
  }

  // Vasumathi: Mercury, Jupiter and Venus all in houses of growth (3, 6, 10, 11) from the
  // rising sign or the Moon.
  const growth = [3, 6, 10, 11];
  for (const [from, label] of [
    [1, "the rising sign"],
    [moon?.house, `the ${names.planet("moon")}`],
  ] as const) {
    if (!from) continue;
    if (GENTLE.every((b) => at.get(b) && growth.includes(countFrom(from, at.get(b)!.house)))) {
      found.push({
        name: "Vasumathi yoga",
        based_on: `${GENTLE.map((b) => names.planet(b)).join(", ")} in houses of growth from ${label}`,
      });
      break;
    }
  }

  // Kemadruma: no planet but the Sun, Rahu or Ketu beside the Moon. Only listed when nothing
  // cancels it: no planet with the Moon, and none in an angle from the rising sign or the Moon.
  if (moon) {
    const beside = planets.some(
      (p) => [houseFrom(moon.house, 2), houseFrom(moon.house, 12)].includes(p.house) && TRUE_PLANETS.includes(p.body),
    );
    const cancelled = planets.some(
      (p) => TRUE_PLANETS.includes(p.body) && (p.house === moon.house || kendraFromLagnaOrMoon(p)),
    );
    if (!beside && !cancelled) {
      found.push({
        name: "Kemadruma yoga",
        based_on: `no planet beside the ${names.planet("moon")} in house ${moon.house}, and nothing that cancels it`,
      });
    }
  }
  return found;
}

/** Degrees from the Sun within which a planet counts as combust (asta), the usual figures. */
const COMBUST_ORB: Record<string, number> = { moon: 12, mars: 17, mercury: 14, jupiter: 11, venus: 10, saturn: 15 };
const COMBUST_ORB_RETROGRADE: Record<string, number> = { mercury: 12, venus: 8 };

/** Whether a planet is combust: close enough to the Sun that tradition says its light is hidden. */
export function combust(body: string, longitude: number, sunLongitude: number, retrograde = false): boolean {
  const orb = (retrograde && COMBUST_ORB_RETROGRADE[body]) || COMBUST_ORB[body];
  if (!orb) return false;
  const gap = Math.abs(longitude - sunLongitude) % 360;
  return Math.min(gap, 360 - gap) <= orb;
}

/** The planet that rules both an angle (4, 7 or 10) and a trine (5 or 9) for this rising sign. */
export function isYogaKaraka(ruledHouses: number[]): boolean {
  return ruledHouses.some((h) => [4, 7, 10].includes(h)) && ruledHouses.some((h) => [5, 9].includes(h));
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

/**
 * The running sub-period and the next one, when tradition counts them as calling for extra
 * care with health and safety: the sub-period's planet rules the 8th house or sits in it
 * (personal-reading reference, "Periods that call for extra care"). Worked out here so every
 * reading, in either language, applies the rule the same way.
 */
export function carePeriods(chart: Chart, dasha: Dasha, labels: Labels): Json[] {
  const names = namesFrom(labels);
  const start = SIGNS.indexOf(chart.lagna.sign as (typeof SIGNS)[number]);
  const [main, sub] = dasha.current;
  if (start < 0 || !main || !sub) return [];
  const eighthLord = SIGN_LORD[SIGNS[(start + 7) % 12]];
  const inEighth = new Set(chart.planets.filter((p) => p.house === 8).map((p) => p.body));
  const index = dasha.periods.findIndex((p) => p.start === main.start);
  const subs = index >= 0 ? dasha.periods[index].sub : [];
  const at = subs.findIndex((s) => s.start === sub.start);
  const nextMain = at >= 0 && at + 1 < subs.length ? main : dasha.periods[index + 1];
  const following = at >= 0 && at + 1 < subs.length ? subs[at + 1] : nextMain?.sub[0];
  const found: Json[] = [];
  const entries = [
    ["now", sub, main],
    ["next", following, nextMain],
  ] as const;
  for (const [when, period, inMain] of entries) {
    if (!period || !inMain) continue;
    const because =
      period.lord === eighthLord ? "rules the 8th house" : inEighth.has(period.lord) ? "sits in the 8th house" : null;
    if (because) {
      found.push({
        when,
        main_period: names.planet(inMain.lord),
        sub: names.planet(period.lord),
        from: day(period.start),
        until: day(period.end),
        because,
      });
    }
  }
  return found;
}
