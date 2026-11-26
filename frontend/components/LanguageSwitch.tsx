"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";

import { LANGUAGE_COOKIE, type Locale, switchLocalePath } from "@/lib/i18n";

import styles from "./SiteHeader.module.css";

const OPTIONS: { locale: Locale; label: string }[] = [
  { locale: "si", label: "සිංහල" },
  { locale: "en", label: "English" },
];

type Props = { current: Locale; label: string };

/**
 * The query and hash are read from the browser, not with useSearchParams, so the built page keeps
 * its language links. An in-page change of either fires no event of its own, so they are read
 * again when someone reaches for a link.
 */
const TAIL_EVENTS = ["popstate", "hashchange", "pointerdown", "focusin"] as const;

function subscribeTail(onChange: () => void) {
  for (const name of TAIL_EVENTS) window.addEventListener(name, onChange, true);
  return () => {
    for (const name of TAIL_EVENTS) window.removeEventListener(name, onChange, true);
  };
}

const readTail = () => window.location.search + window.location.hash;

/** Kept for a year, for the redirect from the site root (proxy.ts). Holds only "si" or "en". */
function rememberLanguage(locale: Locale) {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${LANGUAGE_COOKIE}=${locale}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
}

/** Reads the page address, so it waits for request time on pages with unknown params. */
export function LanguageSwitch(props: Props) {
  return <LanguageLinks {...props} pathname={usePathname() ?? `/${props.current}`} />;
}

/** The two language links, for a given page address. Also the stand-in while it loads. */
export function LanguageLinks({ current, label, pathname }: Props & { pathname: string }) {
  const tail = useSyncExternalStore(subscribeTail, readTail, () => "");
  return (
    <div className={styles.languages} role="group" aria-label={label}>
      {OPTIONS.map((option) => {
        const active = option.locale === current;
        return (
          <Link
            key={option.locale}
            href={switchLocalePath(pathname, option.locale, tail)}
            onClick={() => rememberLanguage(option.locale)}
            hrefLang={option.locale}
            lang={option.locale}
            aria-current={active ? "true" : undefined}
            className={active ? styles.languageActive : styles.language}
          >
            {option.label}
          </Link>
        );
      })}
    </div>
  );
}
