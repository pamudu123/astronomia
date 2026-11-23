"use client";

import Link from "next/link";
import { type ReactNode, createContext, useContext, useEffect } from "react";

import type { Dictionary } from "@/app/[lang]/dictionaries";
import type { Locale } from "@/lib/i18n";
import { followSavedTheme } from "@/lib/theme";

type Text = { lang: Locale; t: Dictionary["notFound"]; hadahan: string; porondam: string; tools: string };

const NotFoundText = createContext<Text | null>(null);

/** not-found.tsx gets no params, so the layout gives it the language and words here. */
export function NotFoundTextProvider({ value, children }: { value: Text; children: ReactNode }) {
  return <NotFoundText value={value}>{children}</NotFoundText>;
}

/** Says the page was not found, with ways on to the main parts of the site. */
export function NotFoundPage() {
  const text = useContext(NotFoundText);
  // Next.js draws this page in the browser, where the layout's theme script does not run.
  useEffect(() => followSavedTheme(), []);
  if (!text) return null;
  const { lang, t } = text;
  return (
    <main id="main" className="container" style={{ paddingBlock: "64px 120px" }}>
      <div className="rise" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <h1 className="display" style={{ fontSize: "clamp(32px, 5vw, 48px)", lineHeight: 1.2 }}>
          {t.title}
        </h1>
        <p className="soft">{t.text}</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 8 }}>
          <Link href={`/${lang}/hadahan`} className="btn btn-primary lift">
            {text.hadahan}
          </Link>
          <Link href={`/${lang}/porondam`} className="btn btn-outline lift">
            {text.porondam}
          </Link>
          <Link href={`/${lang}/tools`} className="btn btn-outline lift">
            {text.tools}
          </Link>
        </div>
      </div>
    </main>
  );
}
