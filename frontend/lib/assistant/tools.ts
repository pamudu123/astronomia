/**
 * Reading the agent's tool calls for the chat's cards (components/assistant/ToolCards.tsx).
 *
 * The agent's engine tools return JSON (agent/app/tools/). The chat draws a card for some of
 * them and a one-line status for the rest. Nothing here works out a fact: the cards only lay
 * out what the engine returned.
 */

/** Engine lookups: their status line stays after the answer, so people see what was checked. */
export const ENGINE_TOOLS = [
  "find_place",
  "good_times_for_day",
  "month_calendar",
  "new_year_times",
  "find_matching_stars",
  "name_letters_for_star",
  "names_for_letters",
  "upcoming_planet_changes",
  "planet_change_for_sign",
  "year_ahead_for_sign",
] as const;

export type EngineTool = (typeof ENGINE_TOOLS)[number];

/** Background steps (reading skill notes, helpers): shown only while they run. */
export function isEngineTool(name: string): name is EngineTool {
  return (ENGINE_TOOLS as readonly string[]).includes(name);
}

/**
 * The status line's label key for a tool. Helpers ("task") and reading notes get their own
 * words; any other tool the agent gains later falls back to a general one.
 */
export function statusKey(name: string): EngineTool | "task" | "notes" | "other" {
  if (isEngineTool(name)) return name;
  if (name === "task") return "task";
  if (name === "read_file" || name === "ls") return "notes";
  return "other";
}

/** A tool result as an object, or null when it isn't JSON (an error message from the tool). */
export function parseResult<T>(result: string | undefined): T | null {
  if (!result) return null;
  try {
    const value: unknown = JSON.parse(result);
    return value && typeof value === "object" ? (value as T) : null;
  } catch {
    return null;
  }
}

// --- Good times for a day (good_times_for_day) ---

export type DayPart = { name: string; from: string | null; to: string | null };

export type GoodTimes = {
  date: string;
  weekday: string;
  place: string;
  sunrise: string | null;
  sunset: string | null;
  rahu_kalaya: string | null;
  thithi: DayPart[];
  nakatha: DayPart[];
  provisional: boolean;
};

/** Minutes after midnight for "06:02", or null for a time on another day ("02:02 on 2026-11-16"). */
export function minutes(clock: string | null | undefined): number | null {
  const match = clock?.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

/** "16:28 to 17:58" as its two clock times. */
export function splitSpan(span: string | null | undefined): [string, string] | null {
  const match = span?.match(/^(.+?) to (.+)$/);
  return match ? [match[1], match[2]] : null;
}

/**
 * Where Rahu kalaya sits on the daylight bar, from sunrise (0) to sunset (100), in percent.
 * Null when a time is missing or falls on another day.
 */
export function rahuOnDaylight(day: Pick<GoodTimes, "sunrise" | "sunset" | "rahu_kalaya">) {
  const rise = minutes(day.sunrise);
  const set = minutes(day.sunset);
  const span = splitSpan(day.rahu_kalaya);
  if (rise === null || set === null || set <= rise || !span) return null;
  const start = minutes(span[0]);
  const end = minutes(span[1]);
  if (start === null || end === null || end <= start) return null;
  const at = (m: number) => Math.min(100, Math.max(0, ((m - rise) / (set - rise)) * 100));
  return { left: at(start), width: at(end) - at(start) };
}

/** The middle of the daylight, for the bar's middle label: "12:00". */
export function midday(sunrise: string | null, sunset: string | null): string | null {
  const rise = minutes(sunrise);
  const set = minutes(sunset);
  if (rise === null || set === null) return null;
  const middle = Math.round((rise + set) / 2);
  return `${String(Math.floor(middle / 60)).padStart(2, "0")}:${String(middle % 60).padStart(2, "0")}`;
}

// --- Star matches (find_matching_stars) ---

export type StarMatch = {
  star_id: string;
  star: string;
  sign: string;
  factors_agree: string;
  essential_checks_pass: boolean;
  essential_checks: Record<string, boolean>;
  same_star: boolean;
};

export type StarMatches = {
  star: string;
  pada: number;
  sign: string;
  role: string;
  provisional: boolean;
  best_matches: StarMatch[];
};

/** "17 of 20" as numbers, for the score bar. */
export function score(factors: string): { agree: number; total: number } | null {
  const match = factors.match(/^(\d+) of (\d+)$/);
  if (!match) return null;
  const total = Number(match[2]);
  return total > 0 ? { agree: Number(match[1]), total } : null;
}
