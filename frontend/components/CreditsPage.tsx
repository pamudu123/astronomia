import Link from "next/link";
import type { ReactNode } from "react";

import type { Dictionary } from "@/app/[lang]/dictionaries";
import {
  AVURUDU_SOURCES,
  CC_BY_SA_URL,
  CC_BY_URL,
  FONTS,
  GEONAMES_URL,
  OFL_URL,
  WIKIPEDIA_NAMES_URL,
} from "@/lib/credits";
import type { Locale } from "@/lib/i18n";

import styles from "./CreditsPage.module.css";
import legal from "./LegalPage.module.css";

function Out({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <li id={id} className={legal.section}>
      <h2 className={`display ${legal.sectionTitle}`}>{title}</h2>
      {children}
    </li>
  );
}

/** One section per source the site relies on, in the style of the privacy and terms pages. */
export function CreditsPage({ lang, dict }: { lang: Locale; dict: Dictionary }) {
  const c = dict.credits;
  return (
    <main id="main" className={`container ${legal.page}`}>
      <header className={`rise ${legal.head}`}>
        <h1 className={`display ${legal.title}`}>{c.title}</h1>
        <p className="soft">{c.lead}</p>
        <p className={legal.updated}>{c.updated}</p>
      </header>

      <ol className={legal.sections}>
        <Section id="places" title={c.places.title}>
          <p>{c.places.text}</p>
          <p className={styles.links}>
            <Out href={GEONAMES_URL}>GeoNames</Out>
            <span>
              {c.licence}: <Out href={CC_BY_URL}>CC BY 4.0</Out>
            </span>
          </p>
          <h3 className={styles.subTitle}>{c.places.changesTitle}</h3>
          <ul className={styles.list}>
            {c.places.changes.map((text) => (
              <li key={text}>{text}</li>
            ))}
          </ul>
        </Section>

        <Section id="fonts" title={c.fonts.title}>
          <p>{c.fonts.text}</p>
          <ul className={styles.cards}>
            {FONTS.map((font) => (
              <li key={font.family} className={styles.card}>
                <Out href={font.url}>
                  <span className={styles.family}>{font.family}</span>
                </Out>
                <span className={styles.small} lang="en">
                  {font.copyright}
                </span>
                <span className={styles.small}>
                  {c.licence}: <Out href={OFL_URL}>{c.fonts.licence}</Out>
                </span>
              </li>
            ))}
          </ul>
        </Section>

        <Section id="names" title={c.names.title}>
          <p>{c.names.text}</p>
          <ul className={styles.list}>
            <li>{c.names.wikipedia}</li>
            <li>{c.names.people}</li>
            <li>{c.names.ours}</li>
          </ul>
          <p>{c.names.where}</p>
          <p className={styles.links}>
            <Link href={`/${lang}/baby-names`}>{c.names.link}</Link>
            <Out href={WIKIPEDIA_NAMES_URL}>{c.names.category}</Out>
            <span>
              {c.licence}: <Out href={CC_BY_SA_URL}>CC BY-SA 4.0</Out>
            </span>
          </p>
        </Section>

        <Section id="avurudu" title={c.avurudu.title}>
          <p>{c.avurudu.text}</p>
          <ul className={styles.list}>
            {AVURUDU_SOURCES.map((source) => (
              <li key={source.year} data-year={source.year}>
                <Link href={`/${lang}/avurudu/${source.year}`}>{source.year}</Link>: {c.avurudu.bodies[source.body]} (
                <Out href={source.url}>{c.avurudu.via}</Out>)
              </li>
            ))}
          </ul>
        </Section>

        <Section id="planets" title={c.planets.title}>
          <p>{c.planets.text}</p>
          <p className="soft">{c.planets.how}</p>
        </Section>
      </ol>
    </main>
  );
}
