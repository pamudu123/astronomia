"use client";

import { Fragment, useEffect, useId, useMemo, useState, useSyncExternalStore } from "react";

import { Lock } from "@/components/Icons";
import type { PageContext } from "@/lib/assistant/context";
import {
  type Block,
  type ChapterId,
  OPEN_FIRST,
  type Span,
  blocks,
  chapterKey,
  chapterState,
  idleState,
  requestChapter,
  subscribe,
} from "@/lib/assistant/explain";
import { askAssistant } from "@/lib/assistant/panel";
import { canUse } from "@/lib/entitlements";
import { fill } from "@/lib/hadahan";
import type { Locale } from "@/lib/i18n";

import styles from "./Explain.module.css";
import { useExplainText } from "./PageContext";

type Text = NonNullable<ReturnType<typeof useExplainText>>;

/**
 * AI explanations on the page (docs/17): `FullReading`, the chapters card at the top of a
 * result, and `AiExplain`, a button on a main place that opens one or two of those chapters
 * in place. Both show nothing where the AI is off. The text comes from lib/assistant/explain.ts.
 */

/** A chapter's state, kept in step with the shared store. Idle while its facts are loading. */
function useChapter(id: ChapterId, lang: Locale, facts: PageContext | null) {
  const key = facts ? chapterKey(id, lang, facts) : "";
  return useSyncExternalStore(subscribe, () => (key ? chapterState(key) : idleState()), idleState);
}

function Spans({ spans }: { spans: Span[] }) {
  return spans.map((span, index) =>
    span.bold ? <strong key={index}>{span.text}</strong> : <Fragment key={index}>{span.text}</Fragment>,
  );
}

function Blocks({ items }: { items: Block[] }) {
  return items.map((block, index) =>
    block.kind === "list" ? (
      <ul key={index}>
        {block.items.map((item, i) => (
          <li key={i}>
            <Spans spans={item} />
          </li>
        ))}
      </ul>
    ) : (
      // A paragraph that is only a bold lead sits close to the text it introduces.
      <p key={index} className={block.spans.length === 1 && block.spans[0].bold ? styles.lead : undefined}>
        <Spans spans={block.spans} />
      </p>
    ),
  );
}

/** One chapter's text: written on first show, then kept for the visit. */
function Chapter({
  id,
  lang,
  facts,
  t,
  heading,
}: {
  id: ChapterId;
  lang: Locale;
  /** Null while the facts this chapter needs are still loading. */
  facts: PageContext | null;
  t: Text;
  /** Show the chapter's title above it (when a button shows more than one chapter). */
  heading?: boolean;
}) {
  const state = useChapter(id, lang, facts);
  const title = t.chapters[id];
  useEffect(() => {
    if (facts) void requestChapter(id, lang, facts);
    // The key covers id, language and facts; asking again for a written chapter does nothing.
  }, [id, lang, facts]);

  return (
    <div className={styles.chapter} data-chapter={id} data-status={state.status} aria-busy={state.status === "writing"}>
      {heading && <h4 className={styles.chapterHeading}>{title}</h4>}
      {state.status === "failed" ? (
        <p className={styles.failed}>
          {t.failed}{" "}
          <button
            type="button"
            className={styles.linkButton}
            onClick={() => facts && void requestChapter(id, lang, facts)}
          >
            {t.retry}
          </button>
        </p>
      ) : (
        <div className={styles.text}>
          <Blocks items={blocks(state.text)} />
          {state.status !== "done" && (
            <p className={styles.writing} role="status">
              <span className={styles.dots} aria-hidden="true" />
              {t.writing}
            </p>
          )}
        </div>
      )}
      {state.status === "done" && (
        <button
          type="button"
          className={styles.ask}
          onClick={() => askAssistant(fill(t.askQuestion, { title }))}
        >
          {t.ask} →
        </button>
      )}
    </div>
  );
}

/**
 * An explain button on a main place of the page (docs/17, section 3). Collapsed until tapped;
 * opens the chapters it stands for under it, and hides them again without losing them.
 */
export function AiExplain({
  chapters,
  lang,
  facts,
  className,
}: {
  chapters: ChapterId[];
  lang: Locale;
  facts: PageContext | null;
  className?: string;
}) {
  const t = useExplainText();
  const [open, setOpen] = useState(false);
  const panel = useId();
  // Pages pass a new summary on every render; keep it by content, so a chapter is asked once.
  const factsKey = JSON.stringify(facts);
  const stable = useMemo(() => facts, [factsKey]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!t || !stable) return null;
  const allowed = canUse("ai_explain");

  return (
    <div className={`${styles.place} ${className ?? ""}`} data-explain={chapters.join(" ")}>
      <button
        type="button"
        className={styles.toggle}
        aria-expanded={open}
        aria-controls={panel}
        onClick={() => setOpen(!open)}
      >
        <span aria-hidden="true" className={styles.spark}>
          ✦
        </span>
        {open ? t.hide : t.explain}
        <span aria-hidden="true" className={open ? styles.caretUp : styles.caret} />
      </button>
      {open && (
        <div id={panel} className={styles.panel}>
          {allowed ? (
            <>
              {chapters.map((id) => (
                <Chapter key={id} id={id} lang={lang} facts={stable} t={t} heading={chapters.length > 1} />
              ))}
              <p className={styles.label}>{t.label}</p>
            </>
          ) : (
            <p className={styles.locked}>
              <Lock size={16} /> {t.locked}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * The full reading at the top of a result (docs/17, section 2): a closed card that lists what
 * is inside, then the chapters, each opened and hidden on its own.
 */
export function FullReading({
  chapters,
  lang,
  facts,
  reading,
  extra,
  pdf = false,
}: {
  chapters: ChapterId[];
  lang: Locale;
  facts: PageContext | null;
  /**
   * Chapters that need more than the page's facts (the Saturn periods, the year ahead): their
   * own facts, or null while those are loading. The other chapters keep the page's facts.
   */
  extra?: Partial<Record<ChapterId, PageContext | null>>;
  /** True where the page has a PDF report, which prints the chapters opened here. */
  pdf?: boolean;
  /** Which reading's words the card uses. */
  reading: "matchReading" | "chartReading";
}) {
  const t = useExplainText();
  const [started, setStarted] = useState(false);
  const [open, setOpen] = useState<Set<ChapterId>>(new Set());
  const base = useId();
  if (!t || !facts) return null;
  const words = t[reading];
  const allowed = canUse("ai_reading");

  const toggle = (id: ChapterId) =>
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const start = () => {
    setStarted(true);
    setOpen(new Set(chapters.slice(0, OPEN_FIRST)));
  };

  return (
    <section className={`rise ${styles.reading}`} aria-labelledby={`${base}-title`} data-card="full-reading">
      <div className={styles.readingHead}>
        <div>
          <h2 id={`${base}-title`} className={`display ${styles.readingTitle}`}>
            <span aria-hidden="true" className={styles.spark}>
              ✦
            </span>{" "}
            {words.title}
          </h2>
          {!started && <p className="soft">{fill(words.lead, { count: chapters.length })}</p>}
        </div>
        {started ? (
          <div className={styles.readingActions}>
            <button type="button" className={styles.smallButton} onClick={() => setOpen(new Set(chapters))}>
              {words.openAll}
            </button>
            <button type="button" className={styles.smallButton} onClick={() => setOpen(new Set())}>
              {words.hideAll}
            </button>
          </div>
        ) : allowed ? (
          <button type="button" className="btn btn-primary lift" onClick={start}>
            {words.get}
          </button>
        ) : (
          <p className={styles.locked}>
            <Lock size={16} /> {t.locked}
          </p>
        )}
      </div>

      {started && (
        <>
          <ol className={styles.chapters}>
            {chapters.map((id, index) => {
              const isOpen = open.has(id);
              const panel = `${base}-${index}`;
              return (
                <li key={id} className={isOpen ? styles.chapterOpen : styles.chapterRow}>
                  <h3 className={styles.chapterTitle}>
                    <button
                      type="button"
                      className={styles.chapterButton}
                      aria-expanded={isOpen}
                      aria-controls={panel}
                      onClick={() => toggle(id)}
                    >
                      <span className={styles.chapterNumber}>{index + 1}</span>
                      {t.chapters[id]}
                      <span aria-hidden="true" className={isOpen ? styles.caretUp : styles.caret} />
                    </button>
                  </h3>
                  {isOpen && (
                    <div id={panel}>
                      <Chapter id={id} lang={lang} facts={extra && id in extra ? (extra[id] ?? null) : facts} t={t} />
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
          <p className={styles.label}>
            {t.readingLabel}
            {pdf && ` · ${t.inPdf}`}
          </p>
        </>
      )}
    </section>
  );
}

/**
 * The life topic chips under a chart (docs/17, place 4): one chapter per chip. Picking a chip
 * opens its chapter under the row; picking it again hides it.
 */
export function TopicChips({
  chapters,
  lang,
  facts,
}: {
  chapters: ChapterId[];
  lang: Locale;
  facts: PageContext | null;
}) {
  const t = useExplainText();
  const [picked, setPicked] = useState<ChapterId | null>(null);
  const base = useId();
  if (!t || !facts) return null;
  const allowed = canUse("ai_explain");

  return (
    <section className={`rise ${styles.topics}`} aria-labelledby={`${base}-title`} data-card="topics">
      <div className={styles.topicsHead}>
        <h2 id={`${base}-title`} className={`display ${styles.readingTitle}`}>
          <span aria-hidden="true" className={styles.spark}>
            ✦
          </span>{" "}
          {t.topics.title}
        </h2>
        <p className="soft">{t.topics.lead}</p>
      </div>
      <div className={styles.chips} role="group" aria-label={t.topics.title}>
        {chapters.map((id) => (
          <button
            key={id}
            type="button"
            className={picked === id ? styles.chipOn : styles.chip}
            aria-pressed={picked === id}
            aria-controls={`${base}-panel`}
            onClick={() => setPicked(picked === id ? null : id)}
            data-topic={id}
          >
            {t.chapters[id]}
          </button>
        ))}
      </div>
      {picked && (
        <div id={`${base}-panel`} className={styles.panel}>
          {allowed ? (
            <>
              <Chapter key={picked} id={picked} lang={lang} facts={facts} t={t} heading />
              <p className={styles.label}>{t.label}</p>
            </>
          ) : (
            <p className={styles.locked}>
              <Lock size={16} /> {t.locked}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
