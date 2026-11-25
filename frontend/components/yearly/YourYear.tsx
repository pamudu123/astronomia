"use client";

import Link from "next/link";

import type { Dictionary } from "@/app/[lang]/dictionaries";
import { ArrowRight } from "@/components/Icons";
import { fill, loadResult } from "@/lib/hadahan";
import type { Locale } from "@/lib/i18n";
import { RASHI } from "@/lib/rashi";
import { useHydrated } from "@/lib/useHydrated";

import { PersonalYearly } from "./PersonalYearly";
import styles from "./Yearly.module.css";

type Props = {
  t: Dictionary["yearly"];
  names: Pick<Dictionary["changes"], "planet" | "house">;
  hadahan: Dictionary["hadahan"];
  lang: Locale;
  year: number;
};

/**
 * The first thing on the list of lagnas: straight to the year of the chart kept in this browser,
 * or, with no chart, a way to find it for someone who does not know their lagna.
 */
export function YourYear({ t, names, hadahan, lang, year }: Props) {
  const hydrated = useHydrated();
  const saved = hydrated ? loadResult() : null;
  const sign = saved?.result.chart?.lagna.sign;
  const lagna = RASHI.find((rashi) => rashi.key === sign)?.[lang];

  if (!saved || !lagna) {
    return (
      <PersonalYearly
        t={t}
        names={names}
        hadahan={hadahan}
        lang={lang}
        year={year}
        ask={{ title: t.askTitle, lead: t.askLead }}
      />
    );
  }
  return (
    <section className={styles.yours} aria-labelledby="your-year-title" data-card="your-year">
      <div>
        <h2 id="your-year-title" className="display">
          {saved.name ? fill(t.yoursNamed, { name: saved.name, year }) : fill(t.hadahanTitle, { year })}
        </h2>
        <p className={styles.small}>{fill(t.yoursLagna, { lagna })}</p>
      </div>
      <Link href={`/${lang}/forecast/${year}/${sign}`} className="btn btn-primary lift">
        {t.yoursOpen}
        <ArrowRight />
      </Link>
    </section>
  );
}
