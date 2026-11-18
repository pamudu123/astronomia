/**
 * AI explanations on the page (docs/17): the chapters of a full reading and the explain
 * buttons that show one or two of them.
 *
 * Each chapter is written by the agent (POST /api/explain -> agent/app/explain.py) from the
 * same skills the chat uses. The ids are shared with the agent's CHAPTERS table.
 *
 * A chapter is written once per visit: the text is kept in memory and in the tab's session
 * storage, keyed by the chapter, the language and a hash of the facts. So a button and the
 * full reading showing the same chapter share one model call, and hiding and opening it again
 * costs nothing.
 */

import type { Locale } from "@/lib/i18n";

import type { PageContext } from "./context";

export type ChapterId =
  | "match.people"
  | "match.factors"
  | "match.checks"
  | "match.mars"
  | "match.styles"
  | "match.summary"
  | "match.combinations"
  | "match.lords"
  | "chart.summary"
  | "chart.combinations"
  | "chart.saturn"
  | "chart.ahead"
  | "chart.nature"
  | "chart.planets"
  | "chart.houses"
  | "chart.work"
  | "chart.love"
  | "chart.family"
  | "chart.studies"
  | "chart.abroad"
  | "chart.periods"
  | "chart.mars"
  | "chart.care";

/** The full match reading, in reading order. */
export const MATCH_READING: ChapterId[] = [
  "match.people",
  "match.factors",
  "match.checks",
  "match.mars",
  "match.combinations",
  "match.lords",
  "match.styles",
  "match.summary",
];

/** The explain buttons on the match page, and the chapters each one shows (docs/17, section 3). */
export const MATCH_PLACES = {
  /** Place 5: "What does our result mean?" */
  result: ["match.summary"],
  /** Place 6: "Is anything serious wrong?" Rajju, Vedha and the Mars check. */
  serious: ["match.checks", "match.mars"],
} satisfies Record<string, ChapterId[]>;

/** The full birth chart reading, in reading order (docs/17, section 2.2). */
export const CHART_READING: ChapterId[] = [
  "chart.summary",
  "chart.nature",
  "chart.planets",
  "chart.combinations",
  "chart.mars",
  "chart.houses",
  "chart.work",
  "chart.love",
  "chart.periods",
  "chart.saturn",
  "chart.care",
  "chart.ahead",
];

/** Chart chapters whose facts come from a second request beside the chart (chartExtrasContext). */
export const CHART_EXTRA: ChapterId[] = ["chart.saturn", "chart.ahead"];

/** The explain buttons on the chart page (docs/17, section 3, places 1 to 3). */
export const CHART_PLACES = {
  /** Place 1: "What does my chart say about me?" */
  chart: ["chart.nature"],
  /** Place 2: "Do I have Kuja dosha, and does it matter?" */
  mars: ["chart.mars"],
  /** Place 3: "Where am I in life now and what's coming?" */
  periods: ["chart.periods"],
} satisfies Record<string, ChapterId[]>;

/** Place 4: the life topic chips under the chart, one chapter each. */
export const CHART_TOPICS: ChapterId[] = [
  "chart.nature",
  "chart.work",
  "chart.love",
  "chart.family",
  "chart.studies",
  "chart.abroad",
];

/** The first chapters a full reading opens by itself, so there is something to read at once. */
export const OPEN_FIRST = 2;

export type ChapterState = {
  status: "idle" | "writing" | "done" | "failed";
  text: string;
};

const IDLE: ChapterState = { status: "idle", text: "" };

// Bump when the chapters change shape, so old texts kept in a tab are not shown again.
const VERSION = "v1";

/** A short, stable hash of a string (FNV-1a, 32 bit). Only for cache keys, not for security. */
export function hash(text: string): string {
  let value = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    value ^= text.charCodeAt(i);
    value = Math.imul(value, 0x01000193);
  }
  return (value >>> 0).toString(36);
}

/** Where a chapter is kept: the same chapter, language and facts give the same key. */
export function chapterKey(id: ChapterId, language: Locale, facts: PageContext): string {
  return `explain:${VERSION}:${id}:${language}:${hash(JSON.stringify(facts))}`;
}

// ---- The store: one entry per chapter key, shared by every component that shows it. ----

const entries = new Map<string, ChapterState>();
const listeners = new Set<() => void>();

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function set(key: string, state: ChapterState): void {
  entries.set(key, state);
  listeners.forEach((listener) => listener());
}

function stored(key: string): string | null {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null; // private windows and blocked storage: write it again
  }
}

function store(key: string, text: string): void {
  try {
    window.sessionStorage.setItem(key, text);
  } catch {
    // Full or blocked storage: the text stays in memory for this page.
  }
}

/** A chapter's state for rendering. Kept text from earlier in the visit counts as done. */
export function chapterState(key: string): ChapterState {
  const entry = entries.get(key);
  if (entry) return entry;
  if (typeof window === "undefined") return IDLE;
  const text = stored(key);
  if (text == null) return IDLE;
  const done: ChapterState = { status: "done", text };
  entries.set(key, done);
  return done;
}

export const idleState = (): ChapterState => IDLE;

/**
 * Writes a chapter unless it is written or being written. The text arrives as it is
 * written. A failed chapter can be asked for again.
 */
export async function requestChapter(
  id: ChapterId,
  language: Locale,
  facts: PageContext,
  send: typeof fetch = fetch,
): Promise<void> {
  const key = chapterKey(id, language, facts);
  const current = chapterState(key);
  if (current.status === "writing" || current.status === "done") return;
  set(key, { status: "writing", text: "" });
  let text = "";
  try {
    const response = await send("/api/explain", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, language, facts }),
    });
    if (!response.ok || !response.body) throw new Error(`explain: ${response.status}`);
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      text += decoder.decode(value, { stream: true });
      set(key, { status: "writing", text });
    }
    text += decoder.decode();
    if (!text.trim()) throw new Error("explain: empty");
    set(key, { status: "done", text });
    store(key, text);
  } catch {
    set(key, { status: "failed", text: "" });
  }
}

/** Forgets every chapter in memory (tests). */
export function resetChapters(): void {
  entries.clear();
}

// ---- The text: the small part of markdown a chapter uses (explain-card skill). ----

export type Span = { text: string; bold: boolean };
export type Block = { kind: "paragraph"; spans: Span[] } | { kind: "list"; items: Span[][] };

/** "**Lead** rest" -> bold and plain spans. An unclosed ** stays as text. */
export function spans(line: string): Span[] {
  const parts = line.split("**");
  if (parts.length % 2 === 0) return [{ text: line, bold: false }];
  return parts
    .map((text, index) => ({ text, bold: index % 2 === 1 }))
    .filter((span) => span.text !== "");
}

/**
 * Paragraphs, bold and simple lists. Rendered as React elements, never as HTML, so nothing
 * in a chapter can run on the page. Headings (#) are shown as bold lines.
 */
export function blocks(text: string): Block[] {
  const result: Block[] = [];
  for (const chunk of text.replace(/\r\n/g, "\n").split(/\n\s*\n/)) {
    const lines = chunk.split("\n").map((line) => line.trim()).filter(Boolean);
    if (!lines.length) continue;
    let paragraph: string[] = [];
    let items: Span[][] = [];
    const flush = () => {
      if (paragraph.length) result.push({ kind: "paragraph", spans: spans(paragraph.join(" ")) });
      if (items.length) result.push({ kind: "list", items });
      paragraph = [];
      items = [];
    };
    for (const line of lines) {
      const item = /^(?:[-*•]|\d+[.)])\s+(.*)$/.exec(line);
      const heading = /^#{1,6}\s+(.*)$/.exec(line);
      // A bold lead on its own line ("**Where it comes easily**") stays on its own line.
      const lead = /^\*\*([^*]+)\*\*:?$/.exec(line);
      if (item) {
        if (paragraph.length) flush();
        items.push(spans(item[1]));
      } else if (heading || lead) {
        flush();
        const text = heading ? heading[1].replace(/\*\*/g, "") : lead![1];
        result.push({ kind: "paragraph", spans: [{ text, bold: true }] });
      } else {
        if (items.length) flush();
        paragraph.push(line);
      }
    }
    flush();
  }
  return result;
}
