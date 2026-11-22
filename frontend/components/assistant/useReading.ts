"use client";

import { useMemo, useSyncExternalStore } from "react";

import type { PageContext } from "@/lib/assistant/context";
import { type ChapterId, chapterKey, chapterState, outline, subscribe, writeAll, writtenChapters } from "@/lib/assistant/explain";
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

/**
 * The AI reading on a result page, shared by the reading card, the chat and the PDF report:
 *
 * - Tells the chat which chapters are written and what each says in short (the "reading"
 *   slot, under `also_on_page.reading`), so Astro's answers stay in step with them and it can
 *   point to a chapter instead of writing it again.
 * - `forPdf` gives the PDF its chapters. On a paid report (the `full_pdf` feature) it first
 *   writes every chapter not written yet; chapters already written are reused as they are.
 */
export function useReading(plan: ReadingPlan, lang: Locale, kind: "chart" | "match") {
  const words = useExplainText();
  const fullPdf = useCanUse("full_pdf");
  const acknowledged = useAiAcknowledged();
  const { report } = useReportAccess();
  const { ids, factsFor } = plan;
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
    if (!words) return null;
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
  }, [written, words, lang, kind]); // eslint-disable-line react-hooks/exhaustive-deps
  useAssistantContext(context, "reading");

  const forPdf = async (progress?: (done: number, total: number) => void): Promise<PdfChapter[]> => {
    if (!words) return [];
    if (fullPdf) {
      const items = ids.flatMap((id) => {
        const facts = factsFor(id);
        return facts ? [{ id, facts }] : [];
      });
      await writeAll(items, lang, progress, fetch, 4, report);
    }
    return writtenChapters(ids, lang, factsFor).map(({ id, text }) => ({ id, title: words.chapters[id], text }));
  };
  // The paid PDF sends the chapters not written yet to the AI: the AI notice comes first.
  return { forPdf, aiNotice: Boolean(words) && fullPdf && !acknowledged };
}
