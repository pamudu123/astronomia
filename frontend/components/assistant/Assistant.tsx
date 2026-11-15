"use client";

import dynamic from "next/dynamic";
import { type ReactNode, useCallback, useMemo, useState } from "react";

import type { Dictionary } from "@/app/[lang]/dictionaries";
import type { PageContext } from "@/lib/assistant/context";
import type { Locale } from "@/lib/i18n";

import { PageContextSetter, type Slot } from "./PageContext";

// CopilotKit reads the clock while rendering, which server prerendering does not allow, and
// it is large. So the chat loads in the browser only, once the page is up.
const Chat = dynamic(() => import("./Chat"), { ssr: false });

type Slots = Partial<Record<Slot, PageContext>>;

/** The page's main summary, with any parts inside the page added under `also_on_page`. */
export function combine(slots: Slots): PageContext | null {
  const { main, ...parts } = slots;
  const extra = Object.entries(parts).filter(([, part]) => part?.result != null);
  if (!main) return extra.length ? (extra[0][1] ?? null) : null;
  if (!extra.length) return main;
  return {
    ...main,
    also_on_page: Object.fromEntries(extra.map(([slot, part]) => [slot, part!.result!])),
  };
}

/**
 * The AI chat on every page. Pages only see a small context setter (useAssistantContext);
 * the chat itself sits beside them.
 */
export function Assistant({
  lang,
  t,
  children,
}: {
  lang: Locale;
  t: Dictionary["assistant"];
  children: ReactNode;
}) {
  const [slots, setSlots] = useState<Slots>({});
  const set = useCallback((slot: Slot, context: PageContext | null) => {
    setSlots((current) => {
      if (!context) {
        if (!(slot in current)) return current;
        const { [slot]: _gone, ...rest } = current; // eslint-disable-line @typescript-eslint/no-unused-vars
        return rest;
      }
      return { ...current, [slot]: context };
    });
  }, []);
  const page = useMemo(() => combine(slots), [slots]);
  return (
    <PageContextSetter value={set}>
      {children}
      <Chat lang={lang} t={t} page={page} />
    </PageContextSetter>
  );
}
