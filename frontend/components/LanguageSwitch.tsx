"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { type Locale, switchLocalePath } from "@/lib/i18n";

import styles from "./SiteHeader.module.css";

const OPTIONS: { locale: Locale; label: string }[] = [
  { locale: "si", label: "සිංහල" },
  { locale: "en", label: "English" },
];

type Props = { current: Locale; label: string };

/** Reads the page address, so it waits for request time on pages with unknown params. */
export function LanguageSwitch(props: Props) {
  return <LanguageLinks {...props} pathname={usePathname() ?? `/${props.current}`} />;
}

/** The two language links, for a given page address. Also the stand-in while it loads. */
export function LanguageLinks({ current, label, pathname }: Props & { pathname: string }) {
  return (
    <div className={styles.languages} role="group" aria-label={label}>
      {OPTIONS.map((option) => {
        const active = option.locale === current;
        return (
          <Link
            key={option.locale}
            href={switchLocalePath(pathname, option.locale)}
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
