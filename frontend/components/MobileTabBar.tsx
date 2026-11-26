"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import type { Dictionary } from "@/app/[lang]/dictionaries";
import type { Locale } from "@/lib/i18n";

import styles from "./MobileTabBar.module.css";

/** Bottom tab bar for phones, as in the mobile design. Hidden on wide screens. */
export function MobileTabBar(props: Props) {
  return <MobileTabs {...props} pathname={usePathname() ?? `/${props.lang}`} />;
}

type Props = { lang: Locale; dict: Dictionary };

/** The All tools page and the tools it leads to beyond the first three tabs; the More tab is lit on them. */
const MORE_PAGES = ["tools", "nakath", "litha", "avurudu", "first-letters", "baby-names", "porondam/stars", "changes", "forecast", "kendara"];

export const isMorePage = (lang: Locale, pathname: string) =>
  MORE_PAGES.some((page) => pathname === `/${lang}/${page}` || pathname.startsWith(`/${lang}/${page}/`));

/** On phones, More also leads to Why Sidera. On wide screens that has a header link of its own. */
const isMoreTab = (lang: Locale, pathname: string) => isMorePage(lang, pathname) || pathname === `/${lang}/why-sidera`;

/** The tabs for a given page address. Also the stand-in while the address is not known. */
export function MobileTabs({ lang, dict, pathname }: Props & { pathname: string }) {
  const tabs = [
    { href: `/${lang}`, label: dict.nav.homeTab, icon: <HomeIcon />, active: pathname === `/${lang}` },
    { href: `/${lang}/hadahan`, label: dict.nav.hadahan, icon: <ChartIcon />, active: pathname === `/${lang}/hadahan` },
    { href: `/${lang}/porondam`, label: dict.nav.porondam, icon: <MatchIcon />, active: pathname === `/${lang}/porondam` },
    { href: `/${lang}/tools`, label: dict.nav.more, icon: <MoreIcon />, active: isMoreTab(lang, pathname) },
  ];
  return (
    <nav className={styles.bar} aria-label={dict.nav.main}>
      {tabs.map((tab) => {
        const active = tab.active;
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

export function ChartIcon() {
  return (
    <svg aria-hidden="true" width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="3" y="3" width="16" height="16" />
      <path d="M8.3 3v16M13.7 3v16M3 8.3h16M3 13.7h16" />
    </svg>
  );
}

export function MoreIcon() {
  return (
    <svg aria-hidden="true" width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="3" y="3" width="6.5" height="6.5" rx="1.5" />
      <rect x="12.5" y="3" width="6.5" height="6.5" rx="1.5" />
      <rect x="3" y="12.5" width="6.5" height="6.5" rx="1.5" />
      <rect x="12.5" y="12.5" width="6.5" height="6.5" rx="1.5" />
    </svg>
  );
}

export function MatchIcon() {
  return (
    <svg aria-hidden="true" width="26" height="22" viewBox="0 0 26 22" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="9.5" cy="11" r="7" />
      <circle cx="16.5" cy="11" r="7" />
    </svg>
  );
}
