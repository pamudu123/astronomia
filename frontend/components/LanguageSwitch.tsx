"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { type Locale, switchLocalePath } from "@/lib/i18n";

import styles from "./SiteHeader.module.css";

const OPTIONS: { locale: Locale; label: string }[] = [
  { locale: "si", label: "සිංහල" },
  { locale: "en", label: "English" },
];

export function LanguageSwitch({ current, label }: { current: Locale; label: string }) {
  const pathname = usePathname() ?? `/${current}`;
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
