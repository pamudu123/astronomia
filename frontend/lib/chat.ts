/**
 * What the chat shows about its limits (docs/18 section 5, docs/21): plain words, never tokens
 * or money. The backend keeps the rules and the counts; this only turns its answer into words.
 */
import type { components } from "./api-types";
import { fill } from "./hadahan";
import type { Locale } from "./i18n";

export type ChatStatus = components["schemas"]["ChatStatus"];
export type ChatReason = components["schemas"]["ChatRefusal"]["reason"];
export type BlockReason = components["schemas"]["Blocked"]["reason"];

/** The words for the limits, from messages/<lang>.json (assistant.limits). */
export type LimitText = {
  freeStart: string;
  freeLeft: string;
  freeOne: string;
  paidLeft: string;
  paidOne: string;
  paidAlmost: string;
  paidNear: string;
  paidDone: string;
  counter: string;
  tooLong: string;
  free_used: string;
  paid_used: string;
  busy: string;
  network: string;
  burst: string;
  account_day: string;
  kept: string;
  getReport: string;
  later: string;
};

/** The paid allowance's note shows once this much of it is used. */
export const NEAR_END = 0.8;

/** Reasons that offer "Get the full report": a report brings its own chat. */
const OFFERS_REPORT: ReadonlySet<BlockReason> = new Set(["free_used", "paid_used", "busy", "network"]);

export type LimitView =
  | { state: "open"; line: string; note: string | null }
  | { state: "blocked"; reason: BlockReason; message: string; offerReport: boolean };

/** A day in the site's calendar, in the reader's language: "Saturday 28 November". */
export function formatDay(iso: string | null | undefined, lang: Locale, t: LimitText): string {
  if (!iso) return t.later;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return t.later;
  return new Intl.DateTimeFormat(lang === "si" ? "si-LK" : "en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Asia/Colombo",
  }).format(date);
}

function freeLine(status: ChatStatus, t: LimitText): string {
  const { left, limit } = status.free;
  if (left === 1) return t.freeOne;
  return fill(left === limit ? t.freeStart : t.freeLeft, { count: String(left) });
}

function paidLine(left: number, t: LimitText): string {
  if (left <= 0) return t.paidAlmost;
  if (left === 1) return t.paidOne;
  return fill(t.paidLeft, { count: String(left) });
}

/** What to show for this status: what is left, or why the next question has to wait. */
export function limitView(status: ChatStatus, t: LimitText, lang: Locale): LimitView {
  const blocked = status.blocked;
  if (blocked) {
    const message = fill(t[blocked.reason], {
      date: formatDay(blocked.until, lang, t),
      limit: String(status.free.limit),
    });
    return { state: "blocked", reason: blocked.reason, message, offerReport: OFFERS_REPORT.has(blocked.reason) };
  }
  const paid = status.paid;
  if (status.mode === "paid" && paid) {
    return {
      state: "open",
      line: paidLine(paid.questions_left, t),
      note: paid.used_share >= NEAR_END ? t.paidNear : null,
    };
  }
  // Free questions: after the reports' chat is used, say so once above them.
  return { state: "open", line: freeLine(status, t), note: paid ? t.paidDone : null };
}

/** Characters counted as the backend and the AI service count them (Unicode code points). */
export function messageLength(text: string): number {
  return Array.from(text).length;
}

/** True when the message is too long to send. Nothing is cut: the text stays to be shortened. */
export function tooLong(text: string, status: ChatStatus | null): boolean {
  return status !== null && messageLength(text) > status.max_length;
}
