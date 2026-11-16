import type { BabyLetters } from "@/lib/babynames";
import type { PersonalChange } from "@/lib/changes";
import type { FirstLetters } from "@/lib/firstletters";
import type { Hadahan, Labels, Place } from "@/lib/hadahan";
import type { Locale } from "@/lib/i18n";
import type { KendaraResult } from "@/lib/kendara";
import type { Avurudu, MonthPanchanga, Panchanga } from "@/lib/nakath";
import type { Wedding } from "@/lib/wedding";
import type { PersonalYear } from "@/lib/yearly";

import { combinations, houseFacts, periodTimeline, planetFacts } from "./chartFacts";
import type { Json, PageContext } from "./context";

/**
 * What each page shows the assistant, one builder per page (docs/14, section 3.2).
 *
 * The rule for every builder: only results the page shows. Never names, birth dates, birth
 * times or birth places. Where a result would reveal a birth date (the old horoscope search,
 * the first life period), it is left out.
 *
 * Pages whose address already says what they show (a month, a sign, a planet change) need no
 * builder: the assistant reads the address and looks the facts up itself.
 */

type Moment = { clock: string; date: string } | null | undefined;

/** "06:00", or "02:02 on 2026-11-16" when the time falls on another day. */
function at(moment: Moment, day?: string): string | null {
  if (!moment) return null;
  return !day || moment.date === day ? moment.clock : `${moment.clock} on ${moment.date}`;
}

function range(start: Moment, end: Moment, day?: string): string {
  return `${at(start, day)} to ${at(end, day)}`;
}

function sign(labels: Labels, key: string): string {
  return labels.rashi[key]?.name ?? key;
}

function planet(labels: Labels, key: string): string {
  return labels.planet[key]?.name ?? key;
}

/** The birth chart result: signs, planets, life periods. */
export function chartContext(
  result: Hadahan,
  labels: Labels,
  language: Locale,
  shared = false,
): PageContext {
  const { chart, dasha, kuja } = result;
  if (!chart) return { page: "chart", language, ...(shared && { shared }) };
  const current = dasha?.current ?? [];
  const now = current[0];
  // The period after the current one; none if the current one isn't found in the list.
  const index = now && dasha ? dasha.periods.findIndex((p) => p.start === now.start) : -1;
  const next = index >= 0 ? dasha?.periods[index + 1] : undefined;
  return {
    page: "chart_result",
    language,
    ...(shared && { shared }),
    result: {
      rising_sign: sign(labels, chart.lagna.sign),
      moon_sign: sign(labels, chart.moon.sign),
      birth_star: labels.nakshatra[chart.moon.nakshatra] ?? chart.moon.nakshatra,
      birth_star_id: chart.moon.nakshatra,
      pada: chart.moon.pada,
      birth_time_check: chart.time_check.stable
        ? "the rising sign is the same for nearby birth times"
        : chart.time_check.reason,
      // Each planet with its strength in its sign and the houses it rules.
      planets: planetFacts(chart, labels),
      // Each house with its ruler, where the ruler sits, and the planets in it and looking at it.
      houses: houseFacts(chart, labels),
      // Well-known combinations (yogas) found from the placements above. Provisional rules.
      combinations: combinations(chart, labels),
      // Current and next life periods only: the first period starts at birth.
      life_period: now
        ? {
            now: planet(labels, now.lord),
            until: now.end,
            ...(current[1] && { sub_period: planet(labels, current[1].lord), sub_until: current[1].end }),
            ...(next && { next: planet(labels, next.lord), next_from: next.start }),
          }
        : null,
      // The sub-periods of the running period and the periods after it, for "what's ahead".
      life_period_timeline: dasha ? periodTimeline(dasha, labels) : null,
      mars_check: kuja ? { present: kuja.present, reduced: kuja.reduced } : null,
    },
  };
}

/** The day's good times: the place and the almanac shown. */
export function dayContext(data: Panchanga, place: Place | null, language: Locale): PageContext {
  const day = data.date;
  const parts = (items: Panchanga["thithi"]): Json =>
    items.map((p) => ({ name: p.name, time: range(p.start, p.end, day) }));
  return {
    page: "good_times_day",
    language,
    result: {
      date: day,
      weekday: data.weekday_name,
      place: place?.name ?? data.place.name,
      place_id: data.place.id ?? null,
      sunrise: at(data.sunrise, day),
      sunset: at(data.sunset, day),
      rahu_kalaya: data.rahu_kalaya ? range(data.rahu_kalaya.start, data.rahu_kalaya.end, day) : null,
      thithi: parts(data.thithi),
      nakatha: parts(data.nakatha),
      provisional: data.provisional,
    },
  };
}

/** A month of the litha: the place and the poya days. */
export function monthContext(data: MonthPanchanga, language: Locale): PageContext {
  return {
    page: "litha_month",
    language,
    result: {
      year: data.year,
      month: data.month,
      place: data.place.name,
      place_id: data.place.id ?? null,
      poya_days: data.days.filter((d) => d.poya).map((d) => d.date),
      poya_note: data.poya_note,
    },
  };
}

/** The New Year times for a year, in the time zone picked. */
export function avuruduContext(data: Avurudu, zone: string, language: Locale): PageContext {
  return {
    page: "avurudu",
    language,
    result: {
      year: data.year,
      official: data.official,
      source: data.source ?? null,
      time_zone_shown: zone,
      customs: data.items.map((i) => i.name),
    },
  };
}

/** Baby name letters for a birth: the star and its letters. No birth details. */
export function babyLettersContext(result: BabyLetters, language: Locale): PageContext {
  const { chart, letter } = result;
  if (!chart || !letter) return { page: "baby_names", language };
  return {
    page: "baby_names_result",
    language,
    result: {
      birth_star: chart.star_name,
      birth_star_id: chart.star,
      pada: chart.pada,
      moon_sign: chart.rashi_name,
      rising_sign: chart.lagna_name,
      first_letter: letter.letter,
      sounds_like: letter.latin,
      also_used: letter.others,
      nearby_letters: result.nearby.map((n) => n.letter),
      provisional: result.provisional,
    },
  };
}

function suggestions(items: FirstLetters["suggestions"] | Wedding["ceremonies"][number]["suggestions"]): Json {
  return items.slice(0, 8).map((s) => ({
    date: s.date_text,
    weekday: s.weekday,
    time: range(s.start, s.end, s.date),
    nakatha: s.nakatha,
    thithi: s.thithi,
    passes: s.passes,
    cautions: s.cautions,
  }));
}

/** First letters ceremony: the times found. The child's birth details stay out. */
export function firstLettersContext(result: FirstLetters, language: Locale): PageContext {
  return {
    page: "first_letters_result",
    language,
    result: {
      child_birth_star: result.child?.star_name ?? null,
      searched_from: result.first ?? null,
      searched_to: result.last ?? null,
      place: result.place?.name ?? null,
      times_found: suggestions(result.suggestions),
      none_found: result.none_text ?? null,
      age_note: result.age_note ?? null,
      provisional: result.provisional ?? null,
    },
  };
}

/** Wedding dates found for a couple, under a match result. */
export function weddingContext(result: Wedding, language: Locale): PageContext {
  return {
    page: "wedding_dates_result",
    language,
    result: {
      searched_from: result.first ?? null,
      searched_to: result.last ?? null,
      place: result.place?.name ?? null,
      ceremonies: result.ceremonies.map((c) => ({
        ceremony: c.name,
        dates: suggestions(c.suggestions),
        none_found: c.none_text,
      })),
      provisional: result.provisional ?? null,
    },
  };
}

/** Old horoscope search: how many birth times fit. The times themselves are birth dates. */
export function kendaraContext(result: KendaraResult, language: Locale): PageContext {
  return {
    page: "old_horoscope_result",
    language,
    result: {
      possible_birth_times_found: result.matches.length,
      grades: result.matches.map((m) => m.grade),
      list_cut_short: result.cut_off,
      problems: result.problems,
      note: result.note ?? null,
      provisional: result.provisional,
    },
  };
}

type Counted = NonNullable<PersonalChange["lagna"]>;

function counted(c: Counted | null | undefined): Json {
  if (!c) return null;
  return {
    sign: c.sign_name,
    moves: c.moves.map((m) => ({ move: m.text, leaves: m.from_theme, enters: m.to_theme })),
    other_planets: c.others.map((o) => o.text),
    notes: c.notes,
  };
}

/** A planet change read for the person's own chart. */
export function personalChangeContext(result: PersonalChange, language: Locale): PageContext {
  return {
    page: "planet_change_personal",
    language,
    result: {
      change: result.change.title,
      when: result.change.when,
      from_rising_sign: counted(result.lagna),
      from_moon_sign: counted(result.gochara),
      provisional: result.provisional,
    },
  };
}

type Year = NonNullable<PersonalYear["lagna"]>;

function year(y: Year | null | undefined): Json {
  if (!y) return null;
  return {
    sign: y.sign_name,
    planets: y.planets.map((p) => ({ planet: p.body, periods: p.stays.map((s) => s.text) })),
    key_dates: y.key_dates.map((k) => `${k.change.title}: ${k.change.when}`),
  };
}

/** The year ahead read for the person's own chart. */
export function personalYearContext(result: PersonalYear, language: Locale): PageContext {
  return {
    page: "year_ahead_personal",
    language,
    result: { from_rising_sign: year(result.lagna), from_moon_sign: year(result.gochara) },
  };
}
