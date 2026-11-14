"use client";

import Link from "next/link";
import { useState } from "react";

import type { Dictionary } from "@/app/[lang]/dictionaries";
import { ArrowRight } from "@/components/Icons";
import { FEATURED, findChange } from "@/lib/changes";
import { fill, forgetChart, loadRemembered } from "@/lib/hadahan";
import type { Locale } from "@/lib/i18n";
import { NAKSHATRA } from "@/lib/nakshatra";
import { RASHI } from "@/lib/rashi";
import { useHydrated } from "@/lib/useHydrated";
import { YEARS } from "@/lib/yearly";

import styles from "./YourSky.module.css";

type Props = { lang: Locale; t: Dictionary["yourSky"]; kinds: Dictionary["changes"]["kind"] };

/**
 * A welcome for a visitor who chose Remember my chart: their lagna, Moon and star, with links
 * to what matters to them now. Read only in the browser, so the server page stays the same for all.
 */
export function YourSky({ lang, t, kinds }: Props) {
  const hydrated = useHydrated();
  const [forgotten, setForgotten] = useState(false);
  const saved = hydrated && !forgotten ? loadRemembered() : null;
  const chart = saved?.result.chart;
  if (!saved || !chart) return null;

  const rashi = (key: string) => RASHI.find((r) => r.key === key)?.[lang] ?? key;
  const star = NAKSHATRA.find((n) => n.key === chart.moon.nakshatra)?.[lang] ?? chart.moon.nakshatra;
  const lagna = chart.lagna.sign;
  const change = findChange(FEATURED);

  const links = [
    { id: "forecast", href: `/${lang}/forecast/${YEARS[0]}/${lagna}`, label: fill(t.forecast, { year: YEARS[0] }) },
    ...(change
      ? [{ id: "change", href: `/${lang}/changes/${change.id}/${lagna}`, label: fill(t.change, { change: kinds[change.kind] }) }]
      : []),
    { id: "hadahan", href: `/${lang}/hadahan`, label: t.hadahan },
  ];

  return (
    <section className={`container ${styles.wrap}`} aria-labelledby="your-sky-title" data-card="your-sky">
      <div className={styles.card}>
        <div className={styles.head}>
          <p className={styles.eyebrow}>{t.title}</p>
          <h2 id="your-sky-title" className={`display ${styles.title}`}>
            {saved.name ? fill(t.welcomeNamed, { name: saved.name }) : t.welcome}
          </h2>
          <p className="mono">
            {fill(t.summary, { lagna: rashi(lagna), rashi: rashi(chart.moon.sign), star })}
          </p>
        </div>
        <ul className={styles.links}>
          {links.map((link) => (
            <li key={link.id}>
              <Link href={link.href} className={styles.link} data-link={link.id}>
                {link.label}
                <ArrowRight size={16} />
              </Link>
            </li>
          ))}
        </ul>
        <p className={styles.foot}>
          {t.note}{" "}
          <button
            type="button"
            className={styles.forget}
            onClick={() => {
              forgetChart();
              setForgotten(true);
            }}
          >
            {t.forget}
          </button>
        </p>
      </div>
    </section>
  );
}
