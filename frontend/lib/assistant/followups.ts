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
 * - asks for something the site never gives: a verdict on a marriage, a prediction, a remedy,
 *   or health, money or legal advice;
 * - asks about the person's own chart or match while no such result is on the page, so Astro
 *   would need details the person hasn't given.
 */

export type Chip = { title: string; message: string; isLoading?: boolean };

/** About one short question; longer text is not a chip the person would tap. */
const MAX_LENGTH = 90;

const ADDRESSED_TO_THEM = [/\b(you|your|yours|yourself)\b/i, /ඔබ/];

/** Things the site never answers (agent/app/prompts/guide.md, "Care and limits"). */
const NEVER_ANSWERED = [
  /\bshould (we|i) (get )?marr/i,
  /\b(marry|marriage) or not\b/i,
  /\bwill (we|i|my|our|this)\b/i,
  /\b(predict|prediction|future|fortune|lucky number|lottery)\b/i,
  /\b(remed(y|ies)|pooja|puja|gem ?stones?|amulet|charm|ritual to)\b/i,
  /\b(health|illness|disease|medical|medicine|doctor|pregnan)/i,
  /\b(money|invest|loan|salary|business profit|stock)/i,
  /\b(legal|lawyer|court|divorce)\b/i,
  /විවාහ (විය යුතු|කරගත යුතු)/,
  /අනාගතය/,
  /(සෞඛ්‍ය|ලෙඩ|බෙහෙත්|මුදල්|ආයෝජන|නීති)/,
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
  "baby_names_result",
  "first_letters_result",
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
