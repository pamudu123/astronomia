/** The chat panel's width, and what the follow-up suggester is asked for (components/assistant/Chat.tsx). */

import type { Locale } from "@/lib/i18n";

// Wide enough for a match card later; the page keeps the rest on a laptop screen. People can
// drag the panel's left edge between the two limits; their width is remembered.
export const PANEL_WIDTH = 400;
export const PANEL_MIN = 340;
export const PANEL_MAX = 760;

/** A panel width inside the limits, leaving at least 40% of the window for the page. */
export function clampWidth(width: number, viewport: number): number {
  const max = Math.max(PANEL_MIN, Math.min(PANEL_MAX, Math.round(viewport * 0.6)));
  return Math.round(Math.min(max, Math.max(PANEL_MIN, width)));
}

/**
 * What the suggester is asked for after each answer. The first-person rule is also in the
 * agent's own prompt (agent/app/prompts/suggest.md); it is repeated here because CopilotKit
 * puts its own "suggest what the user could say next" note around it.
 */
export function followUpInstructions(lang: Locale): string {
  const language = lang === "si" ? "Sinhala" : "English";
  return [
    // The answer's language wins over the page's: a Sinhala answer on an English page gets
    // Sinhala buttons (QA ASTRO-04). The suggester also names the answer's language itself.
    "Write in the same language as Astro's last answer (Sinhala or English), even when the page is in the other one.",
    `Only when there is no answer yet, write in ${language}, the page's language.`,
    "Each suggestion is the person's own next question to Astro, in the first person (I, my, we, our),",
    'never addressed to them: no "you", "your", "Would you like", "Do you want".',
    "Use the same short text for title and message, at most 10 words.",
    // No fixed count (CopilotKit is told "at least 0"): only what Astro can fully answer.
    "Suggest only questions Astro can answer in full from the page on screen, the site's tools or its background notes,",
    "with what the person has already given: nothing that needs details they haven't entered or facts the site can't work out.",
    "Usually one to three. If none can be answered in full, call the tool with an empty list.",
  ].join(" ");
}
