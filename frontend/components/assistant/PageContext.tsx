"use client";

import { createContext, useContext, useEffect, useMemo } from "react";

import type { Dictionary } from "@/app/[lang]/dictionaries";
import type { PageContext } from "@/lib/assistant/context";
import type { HeldVisuals, PageVisuals } from "@/lib/assistant/pageVisuals";

/**
 * Where on the page a summary comes from: the page's main result, or a part inside it (the
 * wedding dates under a match, the chapters of the AI reading written so far).
 */
export type Slot = "main" | "wedding" | "reading";

type Setter = (slot: Slot, context: PageContext | null) => void;

/** Set by the Assistant. Without it (the assistant is off) pages share nothing. */
export const PageContextSetter = createContext<Setter>(() => undefined);

/** True where the chat is on (AGENT_URL is set), so a page can offer to ask it something. */
export const AssistantOn = createContext(false);
export const useAssistantOn = () => useContext(AssistantOn);

/**
 * The words for the AI explanations (components/assistant/Explain.tsx). Set by the Assistant,
 * so the explanations appear only where the AI is on, and pages need no extra text props.
 */
export const ExplainText = createContext<Dictionary["assistant"]["explain"] | null>(null);
export const useExplainText = () => useContext(ExplainText);

/**
 * Tells the assistant what this page shows (docs/14, section 3). Pages call this with a
 * summary of their result; when the page goes away, the assistant falls back to the page name.
 * A part inside a page (the wedding dates under a match) uses its own slot, so it adds to the
 * page's summary instead of replacing it.
 * Pages never import CopilotKit, so the chat can be switched off or replaced without touching them.
 */
export function useAssistantContext(context: PageContext | null, slot: Slot = "main"): void {
  const set = useContext(PageContextSetter);
  // The summary is rebuilt on every render; compare it by content.
  const key = JSON.stringify(context);
  const stable = useMemo(() => context, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    set(slot, stable);
    return () => set(slot, null);
  }, [set, slot, stable]);
}

/** The words a diagram in the chat was first drawn with: an old answer keeps its language too. */
export type VisualWords = {
  explain: Dictionary["assistant"]["explain"];
  titles: Dictionary["assistant"]["cards"]["visual"];
};

/**
 * The results pages handed over, by id, for the diagrams in the chat (VisualCard.tsx). A context
 * and not part of the renderer ToolCards registers: CopilotKit keeps the first renderer when only
 * what it closes over has changed.
 */
export const HeldVisualsContext = createContext<ReadonlyMap<string, HeldVisuals<VisualWords>>>(new Map());

/** Set by the Assistant: where a page hands over the result the chat may draw. */
export const PageVisualsSetter = createContext<(visuals: PageVisuals | null) => void>(() => undefined);

/**
 * Hands the chat the result on screen, so Astro can show one of its diagrams (docs/24). Keep
 * `visuals` the same object while the result is the same (useMemo): a new object is a new result.
 */
export function useAssistantVisuals(visuals: PageVisuals | null): void {
  const set = useContext(PageVisualsSetter);
  useEffect(() => {
    set(visuals);
    return () => set(null);
  }, [set, visuals]);
}

/** For server pages: shares a summary the page built while rendering. */
export function ShareWithAssistant({ context }: { context: PageContext }) {
  useAssistantContext(context);
  return null;
}
