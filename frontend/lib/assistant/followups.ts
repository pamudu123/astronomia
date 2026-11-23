import type { PageContext } from "./context";

/**
 * Which follow-up chips to show under an answer (components/assistant/Chat.tsx).
 *
 * The suggester is asked for zero to three questions Astro can answer in full, and it judges
 * that from the page and the conversation. This is the safety net in the browser, where the
 * page context is known for certain: a chip Astro could not answer in full is dropped, even
 * if the model wrote it. There is no fixed count: one chip is fine, and so is none.
 *
 * A chip is dropped when it:
 * - is empty or too long to be one short question;
 * - speaks to the person instead of as the person ("Would you like…", "your", ඔබ);
 * - asks for something Astro never gives: a verdict on a marriage, a guaranteed outcome or
 *   exact date, anything about death or lifespan, a named disease, investment or legal
 *   advice, or a product such as a gem;
 * - asks about the person's own chart or match while no such result is on the page, so Astro
 *   would need details the person hasn't given.
 */

export type Chip = { title: string; message: string; isLoading?: boolean };

/** About one short question; longer text is not a chip the person would tap. */
const MAX_LENGTH = 90;

const ADDRESSED_TO_THEM = [/\b(you|your|yours|yourself)\b/i, /ඔබ/];

/**
 * What Astro never gives (agent/app/prompts/guide.md, "Care and limits", and the "Never
 * suggest" list in agent/app/prompts/suggest.md). Hard but honest life questions (work,
 * money, love, a difficult period, what is coming) are fine: Astro answers those as
 * possibilities from the chart.
 */
const NEVER_ANSWERED = [
  // A final verdict on a marriage.
  /\bshould (we|i) (get )?marr/i,
  /\b(marry|marriage) or not\b/i,
  /විවාහ (විය යුතු|කරගත යුතු)/,
  // A guaranteed outcome or an exact date.
  /\b(exact(ly)?|guarantee[ds]?|for sure|definitely)\b/i,
  // Death, dying or lifespan.
  /\b(die|dying|death|dead|lifespan|life span)\b/i,
  /\bhow long will .* live\b/i,
  /(මරණ|මැරෙ|ආයුෂ)/,
  // A named disease.
  /\b(cancer|diabetes|heart attack|stroke|tumou?r|hiv|aids|dementia|kidney failure)\b/i,
  /(පිළිකා|දියවැඩියා|හෘදයාබාධ)/,
  // Investment and legal advice.
  /\b(invest(ing|ment)?|stocks?|shares|crypto|lottery|lawsuit|court case|lawyer|legal advice)\b/i,
  /(ආයෝජන|නඩු)/,
  // Products: gems, charms and the like are for their own astrologer.
  /\b(gem ?stones?|amulets?|charms?|yantras?|talisman)\b/i,
];

/** A question about the person's own chart, match or ceremony times. */
const ABOUT_THEIR_OWN = [
  /\bmy (birth )?(chart|horoscope|kendara|hadahan|rising sign|lagna|moon sign|rashi|birth star|nakshatra|nakatha|dasha|life period|planets?|mars check|kuja)\b/i,
  /\bour (match|score|porondam|factors?|essential checks?|wedding dates?|charts?)\b/i,
  /\b(my|our) baby'?s? (letters?|names?|star)\b/i,
  /මගේ (කේන්දර|ජන්ම පත්‍ර|ලග්න|රාශි|නැකත|නක්ෂත්‍ර|දශා|ග්‍රහ)/,
  /අපේ (පොරොන්දම|ගැළපීම|ලකුණු|මංගල)/,
];

/** Pages whose result is the person's own chart, match or times. */
const OWN_RESULTS = new Set([
  "chart_result",
  "match_result",
  "wedding_dates_result",
  "planet_change_personal",
  "year_ahead_personal",
]);

const text = (chip: Chip) => (chip.message || chip.title).trim();

/** Whether Astro can answer this chip in full, given what the page shows. */
export function answerable(chip: Chip, page: PageContext | null): boolean {
  const said = text(chip);
  // Still streaming in: judge it once its words are there.
  if (chip.isLoading && said.length < 4) return true;
  if (!said || said.length > MAX_LENGTH) return false;
  if (ADDRESSED_TO_THEM.some((pattern) => pattern.test(said))) return false;
  if (NEVER_ANSWERED.some((pattern) => pattern.test(said))) return false;
  const ownResult = Boolean(page?.result) && OWN_RESULTS.has(page?.page ?? "");
  if (!ownResult && ABOUT_THEIR_OWN.some((pattern) => pattern.test(said))) return false;
  return true;
}

/**
 * The chips to show, with each one's place in the original list (CopilotKit selects and
 * marks loading by index), and the loading indexes renumbered for the shorter list.
 * `fixed` holds the site's own page questions (shown before the first message): they are
 * written for the page that leads to the result, so they always stay.
 */
export function pickFollowUps<T extends Chip>(
  chips: T[],
  page: PageContext | null,
  loadingIndexes: ReadonlyArray<number> = [],
  fixed: ReadonlySet<string> = new Set(),
): { chips: T[]; original: number[]; loading: number[] } {
  const keep = (chip: T) => fixed.has(text(chip)) || answerable(chip, page);
  const original = chips.flatMap((chip, index) => (keep(chip) ? [index] : []));
  return {
    chips: original.map((index) => chips[index]),
    original,
    loading: original.flatMap((index, shown) => (loadingIndexes.includes(index) ? [shown] : [])),
  };
}
