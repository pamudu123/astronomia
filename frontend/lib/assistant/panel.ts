/** The chat panel's width, and what the follow-up suggester is asked for (components/assistant/Chat.tsx). */

import type { Locale } from "@/lib/i18n";

// Wide enough for a match card later; the page keeps the rest on a laptop screen. People can
// drag the panel's left edge between the two limits; their width is remembered.
export const PANEL_WIDTH = 400;
export const PANEL_MIN = 340;
export const PANEL_MAX = 760;

/** The browser event a page sends to put a question to the assistant (Chat.tsx listens). */
export const ASK_EVENT = "sidera:ask";

/** Opens the chat panel and asks this question, as if the person had typed it. */
export function askAssistant(question: string): void {
  window.dispatchEvent(new CustomEvent<string>(ASK_EVENT, { detail: question }));
}

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
    `Write in ${language}, unless the person is writing in the other language.`,
    "Each suggestion is the person's own next question to Astro, in the first person (I, my, we, our),",
    'never addressed to them: no "you", "your", "Would you like", "Do you want".',
    "Use the same short text for title and message, at most 10 words.",
  ].join(" ");
}
