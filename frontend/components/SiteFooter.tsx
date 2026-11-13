import Link from "next/link";

import type { Dictionary } from "@/app/[lang]/dictionaries";
import type { Locale } from "@/lib/i18n";

import styles from "./SiteFooter.module.css";

export function SiteFooter({ lang, dict }: { lang: Locale; dict: Dictionary }) {
  return (
    <footer className={styles.footer}>
      <div className={`container ${styles.inner}`}>
        <span className={styles.brand}>Astronomia</span>
        <p className={styles.disclaimer}>{dict.footer.disclaimer}</p>
        <nav className={styles.links} aria-label={dict.footer.legal}>
          <Link href={`/${lang}/avurudu`}>{dict.avurudu.footer}</Link>
          <Link href={`/${lang}/nakath`}>{dict.nakath.footer}</Link>
          <Link href={`/${lang}/privacy`}>{dict.footer.privacy}</Link>
          <Link href={`/${lang}/terms`}>{dict.footer.terms}</Link>
        </nav>
      </div>
    </footer>
  );
}
