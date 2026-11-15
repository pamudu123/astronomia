"use client";

import dynamic from "next/dynamic";
import { type ReactNode, useState } from "react";

import type { Dictionary } from "@/app/[lang]/dictionaries";
import type { PageContext } from "@/lib/assistant/context";
import type { Locale } from "@/lib/i18n";

import { PageContextSetter } from "./PageContext";

// CopilotKit reads the clock while rendering, which server prerendering does not allow, and
// it is large. So the chat loads in the browser only, once the page is up.
const Chat = dynamic(() => import("./Chat"), { ssr: false });

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
  const [page, setPage] = useState<PageContext | null>(null);
  return (
    <PageContextSetter value={setPage}>
      {children}
      <Chat lang={lang} t={t} page={page} />
    </PageContextSetter>
  );
}
