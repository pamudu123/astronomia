"use client";

import { useContext } from "react";

import { SavedTime } from "@/components/account/SavedTime";
import { type Shown, offers } from "@/lib/assistant/pageVisuals";

import { ChartVisual, MatchVisual } from "./ChapterDiagram";
import { ExplainText, HeldVisualsContext } from "./PageContext";
import styles from "./ToolCards.module.css";

/**
 * One diagram in the chat (docs/24): the same drawing the page's written chapters use, from the
 * result the question was about.
 */
export function VisualCard({ shown }: { shown: Shown }) {
  const held = useContext(HeldVisualsContext).get(shown.page);
  if (!held) return null;
  const { visuals, words, at } = held;
  if (!offers(visuals).includes(shown.shown)) return null;
  const title = words.titles[shown.shown];
  return (
    <ExplainText value={words.explain}>
      <section className={`${styles.card} ${styles.visual}`} aria-label={title} data-chat-visual={shown.shown}>
        <h4 className={styles.title}>{title}</h4>
        {visuals.kind === "chart" ? (
          <ChartVisual
            visual={shown.shown}
            houses={shown.houses}
            result={visuals.result}
            labels={visuals.labels}
            birth={visuals.birth}
            saved={visuals.saved && <SavedTime times={visuals.saved} part="frozen" />}
            today={at}
          />
        ) : (
          <MatchVisual visual={shown.shown} result={visuals.result} labels={visuals.labels} />
        )}
      </section>
    </ExplainText>
  );
}
