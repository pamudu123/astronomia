import Link from "next/link";

import type { Dictionary } from "@/app/[lang]/dictionaries";
import { fill } from "@/lib/hadahan";
import type { Locale } from "@/lib/i18n";
import { YEARS } from "@/lib/yearly";

import styles from "./SiteFooter.module.css";

export function SiteFooter({ lang, dict }: { lang: Locale; dict: Dictionary }) {
  return (
    <footer className={styles.footer}>
      <div className={`container ${styles.inner}`}>
        <p className={styles.brandBlock}>
          <span className={styles.brand}>Sidera</span>
          <span className={styles.tagline} lang={lang}>
            {dict.hero.tagline.sky}
            {lang === "en" && <span className="visually-hidden">,</span>}{" "}
            <span className={styles.taglineCalc}>{dict.hero.tagline.calculated}</span>
          </span>
        </p>
        <p className={styles.disclaimer}>{dict.footer.disclaimer}</p>
        <nav className={styles.links} aria-label={dict.footer.legal}>
          <Link href={`/${lang}/tools`}>{dict.nav.tools}</Link>
          <Link href={`/${lang}/changes`}>{dict.footer.changes}</Link>
          <Link href={`/${lang}/forecast/${YEARS[0]}`}>{fill(dict.yearly.footer, { year: YEARS[0] })}</Link>
          <Link href={`/${lang}/avurudu`}>{dict.avurudu.footer}</Link>
          <Link href={`/${lang}/nakath`}>{dict.nakath.footer}</Link>
          <Link href={`/${lang}/litha`}>{dict.litha.footer}</Link>
          <Link href={`/${lang}/baby-names`}>{dict.babyNames.footer}</Link>
          <Link href={`/${lang}/first-letters`}>{dict.firstLetters.footer}</Link>
          <Link href={`/${lang}/privacy`}>{dict.footer.privacy}</Link>
          <Link href={`/${lang}/terms`}>{dict.footer.terms}</Link>
        </nav>
      </div>
    </footer>
  );
}
