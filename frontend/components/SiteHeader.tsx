import Link from "next/link";
import { Suspense } from "react";

import type { Dictionary } from "@/app/[lang]/dictionaries";
import type { Locale } from "@/lib/i18n";

import { Logo } from "./Icons";
import { LanguageLinks, LanguageSwitch } from "./LanguageSwitch";
import { MobileTabBar, MobileTabs } from "./MobileTabBar";
import styles from "./SiteHeader.module.css";

export function SiteHeader({ lang, dict }: { lang: Locale; dict: Dictionary }) {
  return (
    <header className={`container ${styles.header}`}>
      <Link href={`/${lang}`} className={styles.brand} aria-label={dict.nav.home}>
        <Logo />
        <span className={styles.brandName}>Astronomia</span>
      </Link>
      <nav aria-label={dict.nav.main} className={styles.nav}>
        <Link href={`/${lang}/hadahan`} className={`${styles.link} ${styles.wide}`}>
          {dict.nav.hadahan}
        </Link>
        <Link href={`/${lang}/porondam`} className={`${styles.link} ${styles.wide}`}>
          {dict.nav.porondam}
        </Link>
        <Link href={`/${lang}#how`} className={`${styles.link} ${styles.wide}`}>
          {dict.nav.how}
        </Link>
        <Link href={`/${lang}/plans`} className={`${styles.link} ${styles.wide}`}>
          {dict.nav.plans}
        </Link>
        {/* Pages with a code in the address (shared links) only know it at request time. */}
        <Suspense fallback={<LanguageLinks current={lang} label={dict.nav.language} pathname={`/${lang}`} />}>
          <LanguageSwitch current={lang} label={dict.nav.language} />
        </Suspense>
      </nav>
      <Suspense fallback={<MobileTabs lang={lang} dict={dict} pathname="" />}>
        <MobileTabBar lang={lang} dict={dict} />
      </Suspense>
    </header>
  );
}
