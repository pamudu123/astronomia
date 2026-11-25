/**
 * The daily nakath page in plain words: when to start things, what the Moon is doing, and how
 * the day's star stands with a person's birth star. Worked out in the browser from the day the
 * backend already sent, so a birth star never leaves the device.
 */
import { NAKSHATRA } from "./nakshatra";
import { type Panchanga, todayIn } from "./nakath";

export type RahuAdvice = {
  start: string;
  end: string;
  state: "planned" | "before" | "during" | "after";
};

const ms = (moment: string) => Date.parse(moment);

/** Is this the day it is now at the day's own place? */
const isToday = (day: Panchanga, now: number) => todayIn(day.place.timezone, new Date(now)) === day.date;

/** What Rahu kalaya means right now. For a day that is not today, or before the clock is known, only the times. */
export function rahuAdvice(day: Panchanga, now: number | null): RahuAdvice | null {
  const rahu = day.rahu_kalaya;
  if (!rahu) return null;
  const times = { start: rahu.start.clock, end: rahu.end.clock };
  if (now === null || !isToday(day, now)) return { ...times, state: "planned" };
  if (now < ms(rahu.start.utc)) return { ...times, state: "before" };
  return { ...times, state: now < ms(rahu.end.utc) ? "during" : "after" };
}

/** Daylight as a bar: where Rahu kalaya and the present moment fall, in percent from sunrise. */
export function dayBar(day: Panchanga, now: number | null) {
  if (!day.sunrise || !day.sunset || !day.rahu_kalaya) return null;
  const from = ms(day.sunrise.utc);
  const length = ms(day.sunset.utc) - from;
  const at = (moment: number) => ((moment - from) / length) * 100;
  const rahu = at(ms(day.rahu_kalaya.start.utc));
  const present = now !== null && isToday(day, now) ? at(now) : null;
  return {
    rahu,
    width: at(ms(day.rahu_kalaya.end.utc)) - rahu,
    now: present !== null && present >= 0 && present <= 100 ? present : null,
  };
}

const FULL_MOON = 15;
const NEW_MOON = 30;

export type MoonPhase = "growing" | "full" | "shrinking" | "new";

/** The Moon on this Sinhala day. Full and new as the litha marks them: the thithi ends before the next sunrise. */
export function moonOf(day: Panchanga): { phase: MoonPhase; day: number; age: number } | null {
  const first = day.thithi[0];
  if (!first) return null;
  const next = day.next_sunrise;
  const endsToday = (number: number) =>
    day.thithi.some((part) => part.number === number && next && ms(part.end.utc) < ms(next.utc));
  const growing = first.number <= FULL_MOON;
  const count = growing ? first.number : first.number - FULL_MOON;
  if (endsToday(FULL_MOON)) return { phase: "full", day: count, age: FULL_MOON };
  if (endsToday(NEW_MOON)) return { phase: "new", day: count, age: NEW_MOON };
  return { phase: growing ? "growing" : "shrinking", day: count, age: first.number - 0.5 };
}

export type StarTone = "good" | "careful" | "own";

/**
 * Tara bala: the day's star counted from the birth star, in nines. Must match tara(),
 * avoid_tara and weak_tara in the backend's wedding rules (a unit test reads the rule file).
 */
export const AVOID_TARA = [3, 5, 7];
export const WEAK_TARA = [1];

export function tara(birthStar: string, dayStar: string): number | null {
  const index = (key: string) => NAKSHATRA.findIndex((star) => star.key === key);
  const [birth, day] = [index(birthStar), index(dayStar)];
  if (birth < 0 || day < 0) return null;
  return (((day - birth + 27) % 27) % 9) + 1;
}

export function starTone(birthStar: string, dayStar: string): StarTone | null {
  const count = tara(birthStar, dayStar);
  if (count === null) return null;
  if (AVOID_TARA.includes(count)) return "careful";
  return WEAK_TARA.includes(count) ? "own" : "good";
}
