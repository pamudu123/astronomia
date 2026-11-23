"use client";

import { createContext, useContext, useEffect, useMemo } from "react";

import type { Dictionary } from "@/app/[lang]/dictionaries";
import type { PageContext } from "@/lib/assistant/context";

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

/** For server pages: shares a summary the page built while rendering. */
export function ShareWithAssistant({ context }: { context: PageContext }) {
  useAssistantContext(context);
  return null;
}
