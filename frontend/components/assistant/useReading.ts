"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

import type { PageContext } from "@/lib/assistant/context";
import {
  type ChapterId,
  chapterKey,
  chapterState,
  fetchKept,
  outline,
  subscribe,
  takeKept,
  writeAll,
  writtenChapters,
} from "@/lib/assistant/explain";
import type { Locale } from "@/lib/i18n";

import { useCanUse, useReportAccess } from "@/components/paid/ReportAccess";

import { useAiAcknowledged } from "./AiNotice";
import { useAssistantContext, useExplainText } from "./PageContext";

/** The chapters of a reading and the facts each is written from (null while still loading). */
export type ReadingPlan = {
  ids: ChapterId[];
  factsFor: (id: ChapterId) => PageContext | null;
};

export type PdfChapter = { id: ChapterId; title: string; text: string };

// How long the PDF waits for facts still on their way (the Saturn periods, the year ahead).
const FACTS_WAIT_MS = 20_000;

/**
 * The AI reading on a result page, shared by the reading card, the chat and the PDF report:
 *
 * - Tells the chat which chapters are written and what each says in short (the "reading"
 *   slot, under `also_on_page.reading`), so Astro's answers stay in step with them and it can
 *   point to a chapter instead of writing it again.
 * - `forPdf` gives the PDF its chapters. On a paid report (the `full_pdf` feature) it first
 *   writes every chapter not written yet; chapters already written are reused as they are.
 * - A paid report's kept chapters are fetched when it opens, on any device of the account.
 */
export function useReading(plan: ReadingPlan, lang: Locale, kind: "chart" | "match") {
  const words = useExplainText();
  const fullPdf = useCanUse("full_pdf");
  const acknowledged = useAiAcknowledged();
  const canRead = useCanUse("ai_reading");
  const { report, access } = useReportAccess();
  const paid = access.state === "ready" && access.access.paid;
  const { ids, factsFor } = plan;
  // The plan as it is now, for the PDF: some chapters' facts arrive after the page opens.
  const latest = useRef(plan);
  useEffect(() => {
    latest.current = plan;
  });
  // What the paid report keeps on the server: those words replace this device's, so they are
  // the same everywhere. Without an answer, the AI route still looks before it writes.
  const reportKey = paid && report ? JSON.stringify(report) : "";
  const [kept, setKept] = useState<{ key: string; chapters: Partial<Record<ChapterId, string>> } | null>(null);
  useEffect(() => {
    if (!reportKey) return;
    const controller = new AbortController();
    fetchKept(JSON.parse(reportKey), lang, { signal: controller.signal })
      .then((chapters) => setKept({ key: reportKey + lang, chapters }))
      .catch(() => undefined);
    return () => controller.abort();
  }, [reportKey, lang]);
  // Each chapter's place on this device: it changes when its facts arrive.
  const keys = ids.map((id) => {
    const facts = factsFor(id);
    return facts ? chapterKey(id, lang, facts) : "";
  });
  const keysKey = keys.join(" ");
  useEffect(() => {
    if (!kept || kept.key !== reportKey + lang) return;
    ids.forEach((id, index) => {
      const text = kept.chapters[id];
      if (text && keys[index]) takeKept(keys[index], text);
    });
  }, [kept, keysKey, reportKey, lang]); // eslint-disable-line react-hooks/exhaustive-deps

  // A cheap fingerprint of what is written, so the chat's summary changes only when a
  // chapter is finished.
  const written = useSyncExternalStore(
    subscribe,
    () =>
      ids
        .map((id) => {
          const facts = factsFor(id);
          if (!facts) return "";
          const state = chapterState(chapterKey(id, lang, facts));
          return state.status === "done" ? `${id}:${state.text.length}` : "";
        })
        .join("|"),
    () => "",
  );
  const context = useMemo<PageContext | null>(() => {
    // A report that isn't paid shares nothing, even if this browser once held its chapters.
    if (!words || !canRead) return null;
    const chapters = writtenChapters(ids, lang, factsFor).map(({ id, text }) => ({
      id,
      title: words.chapters[id],
      ...outline(text),
    }));
    if (!chapters.length) return null;
    return {
      page: `${kind}_reading`,
      language: lang,
      result: {
        about:
          "Chapters of this result's AI reading already written and shown on this page (and printed " +
          "in its PDF report). Each has its short answer and the headings of its parts.",
        chapters,
      },
    };
    // `written` stands for the store's contents.
  }, [written, words, canRead, lang, kind]); // eslint-disable-line react-hooks/exhaustive-deps
  useAssistantContext(context, "reading");

  const forPdf = async (progress?: (done: number, total: number) => void): Promise<PdfChapter[]> => {
    // Only the full PDF of a paid report prints the reading.
    if (!words || !fullPdf) return [];
    const until = Date.now() + FACTS_WAIT_MS;
    const waiting = () => latest.current.ids.some((id) => !latest.current.factsFor(id));
    while (waiting() && Date.now() < until) await new Promise((resolve) => setTimeout(resolve, 250));
    const now = latest.current;
    const items = now.ids.flatMap((id) => {
      const facts = now.factsFor(id);
      return facts ? [{ id, facts }] : [];
    });
    await writeAll(items, lang, progress, fetch, 4, report);
    const chapters = writtenChapters(now.ids, lang, now.factsFor);
    // A paid report is never handed over with chapters missing. Those written are kept, so
    // trying again only writes the rest.
    if (paid && chapters.length < now.ids.length) throw new Error("the reading is not complete");
    return chapters.map(({ id, text }) => ({ id, title: words.chapters[id], text }));
  };
  // The paid PDF sends the chapters not written yet to the AI: the AI notice comes first.
  return { forPdf, aiNotice: Boolean(words) && fullPdf && !acknowledged };
}
