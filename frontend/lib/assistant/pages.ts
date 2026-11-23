import type { BabyLetters } from "@/lib/babynames";
import type { PersonalChange, Upcoming } from "@/lib/changes";
import type { FirstLetters } from "@/lib/firstletters";
import type { AnyHadahan, Labels, Place } from "@/lib/hadahan";
import type { Locale } from "@/lib/i18n";
import type { KendaraResult } from "@/lib/kendara";
import { type Avurudu, type MonthPanchanga, type Panchanga, SRI_LANKA } from "@/lib/nakath";
import type { Journey } from "@/lib/journey";
import { type Person, type Porondam, type Timeline, groupFactors } from "@/lib/porondam";
import type { Wedding } from "@/lib/wedding";
import type { PersonalYear } from "@/lib/yearly";

import {
  type Placement,
  carePeriods,
  combinations,
  houseFacts,
  lifeTimeline,
  periodTimeline,
  planetFacts,
  relation,
  seventhLord,
} from "./chartFacts";
import { type Json, type PageContext, matchContext } from "./context";

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
  result: AnyHadahan,
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

/**
 * What the written chart reading gets (docs/17): the chat's summary, with every later life
 * period and its sub-periods, and the Mars check's reasons and cancelling rules. Still no
 * birth date, time or place.
 */
export function chartReadingContext(
  result: AnyHadahan,
  labels: Labels,
  language: Locale,
  shared = false,
): PageContext {
  const context = chartContext(result, labels, language, shared);
  const { dasha, kuja, birth_table: table } = result;
  if (!context.result || typeof context.result !== "object" || Array.isArray(context.result)) return context;
  return {
    ...context,
    result: {
      ...context.result,
      ...(dasha && { life_period_timeline: lifeTimeline(dasha, labels) }),
      // The running and next sub-periods tradition counts as needing extra care, if any.
      ...(dasha && result.chart && { care_periods: carePeriods(result.chart, dasha, labels) }),
      // The almanac at birth and the birth star's traditional groups (chapter "Birth summary").
      // No time: the weekday, thithi, yoga and karana alone don't give the birth date.
      ...(table && {
        birth_table: {
          weekday: table.weekday.name,
          // Only for a birth before sunrise: the calendar date's weekday, which the match counts.
          ...(table.calendar_weekday && { calendar_weekday: table.calendar_weekday.name }),
          thithi: table.thithi.name,
          yoga: table.yoga.name,
          karana: table.karana.name,
          star_groups: Object.fromEntries(Object.entries(table.star).map(([group, label]) => [group, label.name])),
          provisional: table.provisional,
        },
      }),
      ...(kuja && {
        mars_check: {
          present: kuja.present,
          reduced: kuja.reduced,
          strength: kuja.strength,
          reasons: kuja.reasons,
          checks: kuja.cancellations.map((check) => ({
            rule: labels.kuja_rule[check.id] ?? check.id,
            applies: check.applies,
            reason: check.reason,
          })),
        },
      }),
    },
  };
}

const day = (iso: string) => iso.slice(0, 10);

/**
 * The date of a UTC moment in Sri Lanka, as YYYY-MM-DD. The planet changes in the same chapter
 * are dated in Sri Lanka time, and a moment after 18:30 UTC is already the next day there.
 */
export function sriLankaDay(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: SRI_LANKA });
}

/**
 * The extra facts two chart chapters need, fetched by the page beside the chart: Saturn's
 * periods and Jupiter's returns from the life road (chapter "Saturn periods"), and the planet
 * changes ahead (chapter "The year ahead"). Added to the reading's facts only for those
 * chapters, so the others keep their facts and their written text.
 */
export function chartExtrasContext(
  base: PageContext,
  extras: { journey?: Journey | null; upcoming?: Upcoming | null },
): PageContext {
  if (!base.result || typeof base.result !== "object" || Array.isArray(base.result)) return base;
  const { journey, upcoming } = extras;
  const now = journey?.now ?? "";
  // A stay running at birth starts at the birth moment: that date would give the birth date
  // away, so it is not sent (the rule for every builder in this file).
  const span = (s: { start: string; end: string }) => ({
    from: journey && s.start <= journey.birth ? "already running at birth" : sriLankaDay(s.start),
    until: sriLankaDay(s.end),
    state: s.end < now ? "past" : s.start > now ? "ahead" : "now",
  });
  // A stay cut where the road ends is left out altogether: its end would be the road's end,
  // and a reading that names where the road stops sounds like a lifespan.
  const withinRoad = (s: { end: string }) => !journey?.end || s.end < journey.end;
  return {
    ...base,
    result: {
      ...base.result,
      ...(journey && {
        // Counted from the Moon sign. Spans, not ages: an age would give away the birth date.
        saturn_erashtaka: journey.erashtaka.filter(withinRoad).map(span),
        saturn_erashtaka_from_rising_sign: (journey.erashtaka_lagna ?? []).filter(withinRoad).map(span),
        jupiter_returns: journey.guru_returns.filter(withinRoad).map(span),
        road_provisional: journey.provisional,
      }),
      ...(upcoming && {
        planet_changes_ahead: upcoming.changes.map((c) => ({
          change: c.change.title,
          when: c.change.when,
          from_rising_sign: counted(c.lagna),
          from_moon_sign: counted(c.gochara),
        })),
        sun_months_ahead: (upcoming.sun_months ?? []).map((m) => ({
          sign: m.sign_name,
          from: sriLankaDay(m.start),
          until: sriLankaDay(m.end),
          house_from_rising_sign: m.house_from_lagna,
          house_from_moon_sign: m.house_from_moon,
        })),
      }),
    },
  };
}

/**
 * The couple's next ten years, for the chapter "Your years ahead": each person's life periods
 * and sub-periods in the window, Saturn's harder stretches, and the stretches they share.
 *
 * A period that began before the window has no start date: for a young person that start
 * could be the birth date (the first life period starts at birth).
 */
export function coupleYearsContext(base: PageContext, timeline: Timeline, labels: Labels): PageContext {
  if (!base.result || typeof base.result !== "object" || Array.isArray(base.result)) return base;
  const from = timeline.start;
  const person = (p: Timeline["bride"]) => ({
    birth_details: p.mode,
    now: p.dasha_now ?? null,
    life_periods: (p.dasha ?? []).map((period) => ({
      period: planet(labels, period.lord),
      ...(period.start >= from ? { from: day(period.start) } : { from: "before this window" }),
      until: day(period.end),
      sub_periods: period.sub
        .filter((s) => s.end >= from)
        .map((s) => ({ sub: planet(labels, s.lord), from: day(s.start < from ? from : s.start), until: day(s.end) })),
    })),
    saturn: p.saturn.map((s) => ({ kind: s.kind, from: day(s.start), until: day(s.end), text: s.text })),
  });
  return {
    ...base,
    result: {
      ...base.result,
      years_ahead: {
        window: { from: day(timeline.start), until: day(timeline.end) },
        bride: person(timeline.bride),
        groom: person(timeline.groom),
        saturn_for_both: timeline.overlaps.map((s) => ({ from: day(s.start), until: day(s.end), text: s.text })),
        provisional: timeline.provisional,
      },
    },
  };
}

/** How many dates per ceremony, and reasons per date, the chapter "Wedding dates" gets. */
const WEDDING_DATES = 5;
const WEDDING_REASONS = 3;

/**
 * The wedding dates found under the match, for the chapter "Wedding dates": the top dates of
 * each ceremony with their first reasons. Trimmed because Sinhala text takes three times the
 * bytes, and the agent takes at most 40 KB of facts.
 */
export function weddingReadingContext(base: PageContext, wedding: Wedding): PageContext {
  if (!base.result || typeof base.result !== "object" || Array.isArray(base.result)) return base;
  const trimmed: Wedding = {
    ...wedding,
    ceremonies: wedding.ceremonies.map((c) => ({
      ...c,
      suggestions: c.suggestions
        .slice(0, WEDDING_DATES)
        .map((s) => ({ ...s, passes: s.passes.slice(0, WEDDING_REASONS) })),
    })),
  };
  return {
    ...base,
    result: { ...base.result, wedding_dates_found: weddingContext(trimmed, base.language).result ?? null },
  };
}

/** Marriage facts of one person's chart: the 7th house, its ruler, Venus, and the combinations. */
function marriageFacts(person: Person, labels: Labels): Json | null {
  const placements = (person.placements ?? null) as Placement[] | null;
  if (!placements || !person.lagna) return null;
  const lord = seventhLord(person.lagna);
  const at = (body: string) => placements.find((p) => p.body === body);
  const venus = at("venus");
  return {
    seventh_house_sign: sign(labels, Object.keys(labels.rashi)[(Object.keys(labels.rashi).indexOf(person.lagna) + 6) % 12]),
    seventh_lord: lord ? planet(labels, lord) : null,
    seventh_lord_in_house: lord ? (at(lord)?.house ?? null) : null,
    planets_in_seventh: placements.filter((p) => p.house === 7).map((p) => planet(labels, p.body)),
    venus: venus ? { sign: sign(labels, venus.sign), house: venus.house } : null,
    combinations: combinations({ planets: placements }, labels),
  };
}

/**
 * What the written match reading gets: the chat's summary, and with full birth details each
 * chart's marriage facts and how the two 7th-house rulers regard each other (chapters
 * "Marriage combinations" and "Your two 7th-house rulers").
 */
export function matchReadingContext(
  result: Porondam,
  labels: Labels,
  language: Locale,
  shared = false,
  weddingSearch = false,
): PageContext {
  const context = matchContext(result, labels, language, shared, weddingSearch);
  const { bride, groom } = result;
  if (!bride || !groom || !context.result || typeof context.result !== "object" || Array.isArray(context.result)) {
    return context;
  }
  const match = result.match;
  // The factors by theme as the page's ring groups them, with the counts the page shows, so the
  // reading doesn't group or count them itself (real-model check, 2026-11-19).
  const themes = match
    ? groupFactors(match.factors, labels.porondam_theme).map((g) => ({
        theme: g.name || "other",
        agree: g.agree,
        counted: g.counted,
        factors: g.factors.map((f) => labels.porondam_factor[f.id]?.name ?? f.id),
      }))
    : [];
  const kuja = result.kuja;
  const marsOf = (k: NonNullable<Porondam["kuja"]>["bride"]) => ({
    present: k.present,
    reduced: k.reduced,
    reasons: k.reasons,
    checks: k.cancellations.map((c) => ({ rule: labels.kuja_rule[c.id] ?? c.id, applies: c.applies })),
  });
  const brideFacts = marriageFacts(bride, labels);
  const groomFacts = marriageFacts(groom, labels);
  const brideLord = bride.lagna ? seventhLord(bride.lagna) : null;
  const groomLord = groom.lagna ? seventhLord(groom.lagna) : null;
  return {
    ...context,
    result: {
      ...context.result,
      factor_themes: themes,
      ...(kuja && {
        mars_check: {
          bride: marsOf(kuja.bride),
          groom: marsOf(kuja.groom),
          comparison: kuja.reason,
        },
      }),
      marriage_in_each_chart:
        brideFacts && groomFacts
          ? { bride: brideFacts, groom: groomFacts, provisional: true }
          : "needs full birth details for both people",
      seventh_lords:
        brideLord && groomLord
          ? {
              bride: planet(labels, brideLord),
              groom: planet(labels, groomLord),
              relation: relation(brideLord, groomLord),
              provisional: true,
            }
          : "needs full birth details for both people",
    },
  };
}

/**
 * The day's good times: the place and the almanac shown.
 *
 * Everything comes from the fetched day itself. The place picker can already hold a new city
 * while the old day is still on screen; its name is used only when it is the day's own place,
 * so the city, time zone and times always belong together (code review follow-up to the QA).
 */
export function dayContext(data: Panchanga, place: Place | null, language: Locale): PageContext {
  const day = data.date;
  const parts = (items: Panchanga["thithi"]): Json =>
    items.map((p) => ({ name: p.name, time: range(p.start, p.end, day) }));
  const picked = place && data.place.id != null && place.id === data.place.id ? place.name : null;
  return {
    page: "good_times_day",
    language,
    result: {
      date: day,
      weekday: data.weekday_name,
      place: data.place.name ?? picked,
      place_id: data.place.id ?? null,
      timezone: data.place.timezone,
      sunrise: at(data.sunrise, day),
      sunset: at(data.sunset, day),
      rahu_kalaya: data.rahu_kalaya ? range(data.rahu_kalaya.start, data.rahu_kalaya.end, day) : null,
      thithi: parts(data.thithi),
      nakatha: parts(data.nakatha),
      ...(data.skipped ? { skipped_date: data.skipped_note ?? null } : {}),
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

type Both = Avurudu["calculated"]["dawn"] | null | undefined;

/** "21:44 on 2028-04-13", in Sri Lanka time and, when the page shows another zone, in that one. */
function both(moment: Both, zone: string): Json {
  if (!moment) return null;
  const sriLanka = `${moment.sri_lanka.clock} on ${moment.sri_lanka.date}`;
  if (zone === SRI_LANKA) return { sri_lanka: sriLanka };
  return { sri_lanka: sriLanka, [zone]: `${moment.local.clock} on ${moment.local.date}` };
}

/**
 * The New Year times for a year, as the page shows them: the site's calculated dawn and punya
 * kalaya (every year) and the official list (only when published), each labelled. The time
 * zone is the one the fetched times are in, never a zone picked but not loaded yet (QA ASTRO-03).
 */
export function avuruduContext(data: Avurudu, language: Locale): PageContext {
  const zone = data.timezone;
  return {
    page: "avurudu",
    language,
    result: {
      year: data.year,
      time_zone_shown: zone,
      calculated: {
        label: "the site's own calculation",
        new_year_dawn: both(data.calculated.dawn, zone),
        punya_kalaya_from: both(data.calculated.punya_start, zone),
        punya_kalaya_to: both(data.calculated.punya_end, zone),
      },
      official: data.official
        ? {
            source: data.source ?? null,
            times: data.items.map((i) => ({
              custom: i.name,
              at: both(i.at, zone),
              from: both(i.start, zone),
              to: both(i.end, zone),
              ...(i.date_text ? { date: i.date_text } : {}),
            })),
          }
        : "no official list published for this year yet",
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
