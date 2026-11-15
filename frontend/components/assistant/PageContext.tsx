"use client";

import { createContext, useContext, useEffect, useMemo } from "react";

import type { PageContext } from "@/lib/assistant/context";

type Setter = (context: PageContext | null) => void;

/** Set by the Assistant. Without it (the assistant is off) pages share nothing. */
export const PageContextSetter = createContext<Setter>(() => undefined);

/**
 * Tells the assistant what this page shows (docs/14, section 3). Pages call this with a
 * summary of their result; when the page goes away, the assistant falls back to the page name.
 * Pages never import CopilotKit, so the chat can be switched off or replaced without touching them.
 */
export function useAssistantContext(context: PageContext | null): void {
  const set = useContext(PageContextSetter);
  // The summary is rebuilt on every render; compare it by content.
  const key = JSON.stringify(context);
  const stable = useMemo(() => context, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    set(stable);
    return () => set(null);
  }, [set, stable]);
}
