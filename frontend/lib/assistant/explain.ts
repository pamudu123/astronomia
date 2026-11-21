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
import type { SpotName } from "@/lib/spots";

import type { ReportRequest } from "@/lib/report";

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
  | "match.years"
  | "match.wedding"
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
  | "chart.care"
  | "nakath.day"
  | "avurudu.times"
  | "names.letters"
  | "names.first"
  | "changes.mine"
  | "yearly.mine"
  | "kendara.dates";

/** The picture beside each chapter's opening answer (components/Spot.tsx). */
export const CHAPTER_SPOT: Record<ChapterId, SpotName> = {
  "match.people": "couple",
  "match.factors": "checklist",
  "match.checks": "shield",
  "match.mars": "mars",
  "match.styles": "moon",
  "match.summary": "compass",
  "match.combinations": "constellation",
  "match.lords": "planets",
  "match.years": "periods",
  "match.wedding": "wedding",
  "chart.summary": "compass",
  "chart.combinations": "constellation",
  "chart.saturn": "saturn",
  "chart.ahead": "road",
  "chart.nature": "sunrise",
  "chart.planets": "planets",
  "chart.houses": "houses",
  "chart.work": "work",
  "chart.love": "love",
  "chart.family": "family",
  "chart.studies": "book",
  "chart.abroad": "travel",
  "chart.periods": "periods",
  "chart.mars": "mars",
  "chart.care": "lotus",
  "nakath.day": "lamp",
  "avurudu.times": "pot",
  "names.letters": "cradle",
  "names.first": "book",
  "changes.mine": "change",
  "yearly.mine": "year",
  "kendara.dates": "search",
};

/** The icon on each life topic chip: the same as the reading's icon for that part of life. */
export const TOPIC_ICON: Partial<Record<ChapterId, string>> = {
  "chart.nature": "🙂",
  "chart.work": "💼",
  "chart.love": "💞",
  "chart.family": "🏠",
  "chart.studies": "📚",
  "chart.abroad": "✈️",
};

/** The full match reading, in reading order. */
export const MATCH_READING: ChapterId[] = [
  "match.people",
  "match.factors",
  "match.checks",
  "match.mars",
  "match.combinations",
  "match.lords",
  "match.styles",
  "match.years",
  "match.wedding",
  "match.summary",
];

/**
 * Match chapters that need data the page loads apart from the match: the couple's years ahead
 * (with both birth details on the person's own match) and the wedding dates (once searched).
 * Left out of the reading until there is something to read them from.
 */
export const MATCH_EXTRA: ChapterId[] = ["match.years", "match.wedding"];

/** The explain buttons on the match page, and the chapters each one shows (docs/17, section 3). */
export const MATCH_PLACES = {
  /** Place 5: "What does our result mean?" */
  result: ["match.summary"],
  /** Place 6: "Is anything serious wrong?" Rajju, Vedha and the Mars check. */
  serious: ["match.checks", "match.mars"],
  /** Place 7: "What's ahead for us?" */
  years: ["match.years"],
  /** Place 8: "Which date should we pick?" */
  wedding: ["match.wedding"],
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

/** The explain buttons on the other main pages (docs/17, section 3, places 9 to 14). */
export const PAGE_PLACES = {
  /** Place 9: "What kind of day is today, and what is it good for?" */
  day: ["nakath.day"],
  /** Place 10: "What do we do, and when?" */
  avurudu: ["avurudu.times"],
  /** Place 11: "Which letter, and why?" */
  babyLetters: ["names.letters"],
  /** Place 12: "Which time for akuru kiyaweema?" */
  firstLetters: ["names.first"],
  /** Place 13: "How does this planet change affect me?" */
  change: ["changes.mine"],
  /** Place 14: "What does next year look like for me?" */
  year: ["yearly.mine"],
  /** Place 15: "Why several dates, and how do I find the right one?" */
  kendara: ["kendara.dates"],
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
// v2: plain words first, small paragraphs, an icon on each bold lead. v3: short answer, small tables.
const VERSION = "v3";

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
  /** The report on the page: chart and match chapters are written only for a paid one. */
  report: ReportRequest | null = null,
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
      body: JSON.stringify(report ? { id, language, facts, report } : { id, language, facts }),
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

/**
 * The chapters already written in this visit, in the order given: what the PDF report prints
 * as the AI reading (backend/app/reports/reading.py). `factsFor` gives each chapter's facts,
 * as the page shows it; a chapter with none yet is left out.
 */
export function writtenChapters(
  ids: ChapterId[],
  language: Locale,
  factsFor: (id: ChapterId) => PageContext | null,
): { id: ChapterId; text: string }[] {
  const written: { id: ChapterId; text: string }[] = [];
  for (const id of ids) {
    const facts = factsFor(id);
    if (!facts) continue;
    const state = chapterState(chapterKey(id, language, facts));
    if (state.status === "done") written.push({ id, text: state.text });
  }
  return written;
}

/** Forgets every chapter in memory (tests). */
export function resetChapters(): void {
  entries.clear();
}

// ---- The text: the small part of markdown a chapter uses (explain-card skill). ----

export type Span = { text: string; bold: boolean };
export type Block =
  | { kind: "paragraph"; spans: Span[] }
  | { kind: "list"; items: Span[][] }
  | { kind: "table"; head: Span[][]; rows: Span[][][] };

/** "| a | b |" -> ["a", "b"]. Outer pipes are optional; an escaped \| stays in its cell. */
function cells(line: string): string[] {
  const inner = line.trim().replace(/^\|/, "").replace(/(?<!\\)\|$/, "");
  return inner.split(/(?<!\\)\|/).map((cell) => cell.trim().replace(/\\\|/g, "|"));
}

const TABLE_RULE = /^\|?\s*:?-{2,}:?\s*(?:\|\s*:?-{2,}:?\s*)*\|?$/;

/**
 * A small table (explain-card skill): a header row, a rule of dashes, then the rows. Lines
 * that only look like a table (no rule under the first) stay as text. Short rows are padded,
 * long ones cut, so every row has the header's columns.
 */
function table(lines: string[]): Block | null {
  if (lines.length < 2 || !lines.every((line) => line.includes("|")) || !TABLE_RULE.test(lines[1])) return null;
  const head = cells(lines[0]);
  const rows = lines
    .slice(2)
    .map(cells)
    .map((row) => head.map((_, index) => spans(row[index] ?? "")));
  return { kind: "table", head: head.map(spans), rows };
}

/** True when a line is part of a table: it starts with a pipe, or is a table's rule. */
const isTableLine = (line: string) => line.startsWith("|") || TABLE_RULE.test(line);

// An icon at the start of a bold lead: one emoji, with its variation selector and joined parts.
const ICON = /^(\p{Extended_Pictographic}️?(?:‍\p{Extended_Pictographic}️?)*)\s*/u;

export type Lead = { icon: string | null; text: string };

/** "💼 Work that suits you" -> the icon and the words, so the page can draw the icon apart. */
export function lead(text: string): Lead {
  const match = ICON.exec(text);
  return match ? { icon: match[1], text: text.slice(match[0].length) } : { icon: null, text };
}

/** A paragraph that is only a bold line: a part's lead. */
export const isLead = (block: Block): block is { kind: "paragraph"; spans: Span[] } =>
  block.kind === "paragraph" && block.spans.length === 1 && block.spans[0].bold;

/** What a part is about, from its lead's icon, so the page can tint the ones that matter. */
export type Tone = "plain" | "good" | "tip" | "attention";

export function tone(icon: string | null): Tone {
  if (!icon) return "plain";
  if (icon.startsWith("⚠")) return "attention";
  if (icon === "💡") return "tip";
  if (icon === "✅") return "good";
  return "plain";
}

/**
 * A chapter in its pieces: the answer it opens with (the blocks before the first lead), then
 * each part, a lead with the blocks under it.
 */
export function parts(items: Block[]): { answer: Block[]; parts: { lead: Lead; blocks: Block[] }[] } {
  const answer: Block[] = [];
  const result: { lead: Lead; blocks: Block[] }[] = [];
  for (const block of items) {
    if (isLead(block)) result.push({ lead: lead(block.spans[0].text), blocks: [] });
    else if (result.length) result[result.length - 1].blocks.push(block);
    else answer.push(block);
  }
  return { answer, parts: result };
}

/** "**Lead** rest" -> bold and plain spans. An unclosed ** stays as text. */
export function spans(line: string): Span[] {
  const parts = line.split("**");
  if (parts.length % 2 === 0) return [{ text: line, bold: false }];
  return parts
    .map((text, index) => ({ text, bold: index % 2 === 1 }))
    .filter((span) => span.text !== "");
}

/**
 * Paragraphs, bold, simple lists and small tables. Rendered as React elements, never as HTML,
 * so nothing in a chapter can run on the page. Headings (#) are shown as bold lines.
 */
export function blocks(text: string): Block[] {
  const result: Block[] = [];
  for (const chunk of text.replace(/\r\n/g, "\n").split(/\n\s*\n/)) {
    const lines = chunk.split("\n").map((line) => line.trim()).filter(Boolean);
    if (!lines.length) continue;
    let paragraph: string[] = [];
    let items: Span[][] = [];
    let rows: string[] = [];
    const flushTable = () => {
      if (!rows.length) return;
      const found = table(rows);
      // Not a real table (no rule under the header yet, or ever): keep the lines as text.
      if (found) result.push(found);
      else result.push({ kind: "paragraph", spans: spans(rows.join(" ")) });
      rows = [];
    };
    const flush = () => {
      flushTable();
      if (paragraph.length) result.push({ kind: "paragraph", spans: spans(paragraph.join(" ")) });
      if (items.length) result.push({ kind: "list", items });
      paragraph = [];
      items = [];
    };
    for (const line of lines) {
      if (isTableLine(line)) {
        if (paragraph.length || items.length) flush();
        rows.push(line);
        continue;
      }
      flushTable();
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
