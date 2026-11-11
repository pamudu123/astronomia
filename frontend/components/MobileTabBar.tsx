"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import type { Dictionary } from "@/app/[lang]/dictionaries";
import type { Locale } from "@/lib/i18n";

import styles from "./MobileTabBar.module.css";

/** Bottom tab bar for phones, as in the mobile design. Hidden on wide screens. */
export function MobileTabBar({ lang, dict }: { lang: Locale; dict: Dictionary }) {
  const pathname = usePathname() ?? `/${lang}`;
  const tabs = [
    { href: `/${lang}`, label: dict.nav.homeTab, icon: <HomeIcon /> },
    { href: `/${lang}/hadahan`, label: dict.nav.hadahan, icon: <ChartIcon /> },
    { href: `/${lang}/porondam`, label: dict.nav.porondam, icon: <MatchIcon /> },
  ];
  return (
    <nav className={styles.bar} aria-label={dict.nav.main}>
      {tabs.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={active ? styles.tabActive : styles.tab}
            aria-current={active ? "page" : undefined}
          >
            {tab.icon}
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}

function HomeIcon() {
  return (
    <svg aria-hidden="true" width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3.5 10L11 3.5 18.5 10v8.5h-5v-5h-5v5h-5z" />
    </svg>
  );
}

function ChartIcon() {
  return (
    <svg aria-hidden="true" width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="3" y="3" width="16" height="16" />
      <path d="M8.3 3v16M13.7 3v16M3 8.3h16M3 13.7h16" />
    </svg>
  );
}

function MatchIcon() {
  return (
    <svg aria-hidden="true" width="26" height="22" viewBox="0 0 26 22" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="9.5" cy="11" r="7" />
      <circle cx="16.5" cy="11" r="7" />
    </svg>
  );
}
