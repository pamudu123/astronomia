"use client";

import dynamic from "next/dynamic";
import { type ReactNode, useCallback, useMemo, useState } from "react";

import type { Dictionary } from "@/app/[lang]/dictionaries";
import type { PageContext } from "@/lib/assistant/context";
import { type HeldVisuals, type PageVisuals, offers } from "@/lib/assistant/pageVisuals";
import type { Locale } from "@/lib/i18n";

import { NoticeText } from "./AiNotice";
import {
  AssistantOn,
  ExplainText,
  HeldVisualsContext,
  PageContextSetter,
  PageVisualsSetter,
  type Slot,
  type VisualWords,
} from "./PageContext";

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

type Held = HeldVisuals<VisualWords>;

/** The results handed over so far, by id, and the one on screen. */
type Visuals = { held: ReadonlyMap<string, Held>; now: Held | null };

/** Enough for any one chat: the oldest result goes first. Only this tab's memory holds them. */
const HELD_MAX = 60;

function hold(current: Visuals, page: PageVisuals | null, words: VisualWords): Visuals {
  if (!page || !offers(page).length) return current.now ? { ...current, now: null } : current;
  // A random id says nothing about the result, and no two pages share one.
  const now: Held = { id: crypto.randomUUID().slice(0, 8), at: new Date(), visuals: page, words };
  const held = new Map([...current.held].slice(-(HELD_MAX - 1)));
  return { held: held.set(now.id, now), now };
}

/**
 * The AI chat on every page. Pages only see a small context setter (useAssistantContext);
 * the chat itself sits beside them.
 */
export function Assistant({
  lang,
  t,
  tools,
  children,
}: {
  lang: Locale;
  t: Dictionary["assistant"];
  /** The tools' names, for the chat panel's "Reading: …" line. */
  tools: Dictionary["allTools"];
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
  const [visuals, setVisuals] = useState<Visuals>({ held: new Map(), now: null });
  const words = useMemo<VisualWords>(() => ({ explain: t.explain, titles: t.cards.visual }), [t]);
  const setPageVisuals = useCallback(
    (handed: PageVisuals | null) => setVisuals((current) => hold(current, handed, words)),
    [words],
  );
  const page = useMemo(() => {
    const summary = combine(slots);
    if (!summary || !visuals.now) return summary;
    return { ...summary, visuals: { id: visuals.now.id, offers: offers(visuals.now.visuals) } };
  }, [slots, visuals.now]);
  const notice = useMemo(() => ({ t: t.notice, lang }), [t.notice, lang]);
  return (
    <PageContextSetter value={set}>
      <PageVisualsSetter value={setPageVisuals}>
        <NoticeText value={notice}>
          <AssistantOn value>
            <ExplainText value={t.explain}>{children}</ExplainText>
          </AssistantOn>
          <HeldVisualsContext value={visuals.held}>
            <Chat lang={lang} t={t} tools={tools} page={page} />
          </HeldVisualsContext>
        </NoticeText>
      </PageVisualsSetter>
    </PageContextSetter>
  );
}
