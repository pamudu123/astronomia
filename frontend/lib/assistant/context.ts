import type { Labels } from "@/lib/hadahan";
import type { Locale } from "@/lib/i18n";
import type { Factor, Person, Porondam } from "@/lib/porondam";

/**
 * What the assistant sees: the page the person has open and a short summary of what is on
 * screen (docs/14, section 3). It goes to the AI provider with every message, so it holds
 * no birth dates, times, places or typed names: only the results the page shows.
 */
export type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

export type PageContext = {
  page: string;
  language: Locale;
  /** Someone else's result, opened from a share link. */
  shared?: boolean;
  result?: Json;
  /** Results of parts inside the page, such as the wedding dates under a match. */
  also_on_page?: { [part: string]: Json };
};

/** The page name from the address: "/en/porondam/stars" -> "porondam/stars", "/en" -> "home". */
export function pageFromPath(pathname: string): string {
  const rest = pathname.split("/").filter(Boolean).slice(1).join("/");
  return rest || "home";
}

/** Which tool a page belongs to, for the chat panel's "Reading: …" line and its suggestions. */
export type PageKey =
  | "home"
  | "tools"
  | "hadahan"
  | "porondam"
  | "stars"
  | "nakath"
  | "litha"
  | "avurudu"
  | "babyNames"
  | "firstLetters"
  | "wedding"
  | "kendara"
  | "changes"
  | "forecast";

const BY_RESULT: Record<string, PageKey> = {
  chart: "hadahan",
  chart_result: "hadahan",
  match: "porondam",
  match_result: "porondam",
  good_times_day: "nakath",
  litha_month: "litha",
  avurudu: "avurudu",
  baby_names: "babyNames",
  baby_names_result: "babyNames",
  first_letters_result: "firstLetters",
  wedding_dates_result: "wedding",
  old_horoscope_result: "kendara",
  planet_change_personal: "changes",
  year_ahead_personal: "forecast",
};

const BY_ADDRESS: Record<string, PageKey> = {
  home: "home",
  tools: "tools",
  hadahan: "hadahan",
  porondam: "porondam",
  nakath: "nakath",
  litha: "litha",
  avurudu: "avurudu",
  "baby-names": "babyNames",
  "first-letters": "firstLetters",
  kendara: "kendara",
  changes: "changes",
  forecast: "forecast",
};

/** "match_result" -> "porondam", "porondam/stars/rohini" -> "stars", "privacy" -> null. */
export function pageKey(page: string): PageKey | null {
  if (page in BY_RESULT) return BY_RESULT[page];
  const [first, second] = page.split("/");
  if (first === "porondam" && second === "stars") return "stars";
  return BY_ADDRESS[first] ?? null;
}

export const CONTEXT_DESCRIPTION =
  "The page the person has open on Sidera and a summary of what is on their screen";

function personSummary(person: Person, labels: Labels): { [key: string]: Json } {
  return {
    birth_star: labels.nakshatra[person.nakshatra] ?? person.nakshatra,
    birth_star_id: person.nakshatra,
    pada: person.pada,
    moon_sign: labels.rashi[person.rashi]?.name ?? person.rashi,
    ...(person.lagna ? { rising_sign: labels.rashi[person.lagna]?.name ?? person.lagna } : {}),
  };
}

function factorSummary(factor: Factor, labels: Labels) {
  const label = labels.porondam_factor[factor.id];
  return { id: factor.id, name: label?.name ?? factor.id, meaning: label?.meaning ?? "" };
}

/** The match result page: the score, each factor, the essential checks and the Mars check. */
export function matchContext(
  result: Porondam,
  labels: Labels,
  language: Locale,
  shared = false,
): PageContext {
  const { match, bride, groom, kuja } = result;
  if (!match || !bride || !groom) return { page: "match", language, ...(shared && { shared }) };
  const counted = match.factors.filter((f) => f.checked);
  return {
    page: "match_result",
    language,
    ...(shared && { shared }),
    result: {
      bride: personSummary(bride, labels),
      groom: personSummary(groom, labels),
      quick_match: bride.mode === "quick" || groom.mode === "quick",
      provisional: match.provisional,
      score: { agree: match.score.passed, counted: match.score.total },
      summary: match.summary_text,
      ...(match.same_star && { same_star: match.same_star_text }),
      essential_checks: match.hard_checks.map((f) => ({
        ...factorSummary(f, labels),
        passes: f.passed,
        reason: f.reason,
      })),
      factors_not_agreeing: counted
        .filter((f) => !f.passed)
        .map((f) => ({ ...factorSummary(f, labels), reason: f.reason })),
      factors_agreeing: counted.filter((f) => f.passed).map((f) => factorSummary(f, labels).name),
      factors_not_counted: match.factors
        .filter((f) => !f.checked)
        .map((f) => factorSummary(f, labels).name),
      mars_check: kuja
        ? { bride: kuja.bride.present, groom: kuja.groom.present, comparison: kuja.reason }
        : "needs full birth details for both people",
    },
  };
}
