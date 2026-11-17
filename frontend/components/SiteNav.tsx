"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import type { Dictionary } from "@/app/[lang]/dictionaries";
import type { Locale } from "@/lib/i18n";

import { MyReportsLink } from "./account/MyReportsLink";
import { ChartIcon, MatchIcon, MoreIcon, isMorePage } from "./MobileTabBar";
import styles from "./SiteHeader.module.css";

type Props = { lang: Locale; dict: Dictionary };

/** The page links in the header, each with an icon. The current page gets a soft gold highlight. */
export function SiteNav(props: Props) {
  return <SiteNavLinks {...props} pathname={usePathname() ?? ""} />;
}

const under = (pathname: string, base: string) => pathname === base || pathname.startsWith(`${base}/`);

/** The links for a given page address. Also the stand-in while the address is not known. */
export function SiteNavLinks({ lang, dict, pathname }: Props & { pathname: string }) {
  const links = [
    { href: `/${lang}/hadahan`, label: dict.nav.hadahan, icon: <ChartIcon />, active: under(pathname, `/${lang}/hadahan`) },
    {
      href: `/${lang}/porondam`,
      label: dict.nav.porondam,
      icon: <MatchIcon />,
      active: under(pathname, `/${lang}/porondam`) && !isMorePage(lang, pathname),
    },
    { href: `/${lang}/tools`, label: dict.nav.tools, icon: <MoreIcon />, active: isMorePage(lang, pathname) },
    { href: `/${lang}#how`, label: dict.nav.how, icon: <HelpIcon />, active: false },
    { href: `/${lang}/plans`, label: dict.nav.plans, icon: <CrownIcon />, active: under(pathname, `/${lang}/plans`) },
  ];
  return (
    <>
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={`${link.active ? styles.linkActive : styles.link} ${styles.wide}`}
          aria-current={link.active ? "page" : undefined}
        >
          {link.icon}
          {link.label}
        </Link>
      ))}
      {/* Shown on phones too: the tab bar has no place for it. */}
      <MyReportsLink
        href={`/${lang}/my`}
        label={dict.nav.myReports}
        active={under(pathname, `/${lang}/my`)}
        className={`${under(pathname, `/${lang}/my`) ? styles.linkActive : styles.link} ${styles.mine}`}
      />
    </>
  );
}

function HelpIcon() {
  return (
    <svg aria-hidden="true" width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <path d="M8.6 8.6a2.5 2.5 0 0 1 4.8.9c0 1.7-2.4 2.2-2.4 3.6" />
      <circle cx="11" cy="15.6" r="0.6" fill="currentColor" />
    </svg>
  );
}

function CrownIcon() {
  return (
    <svg aria-hidden="true" width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3.5 7l4 4L11 4.5 14.5 11l4-4-1.5 10h-12z" />
      <path d="M5 17h12" />
    </svg>
  );
}
