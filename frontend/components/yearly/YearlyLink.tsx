import Link from "next/link";

import type { Dictionary } from "@/app/[lang]/dictionaries";
import { fill } from "@/lib/hadahan";
import type { Locale } from "@/lib/i18n";
import { YEARS } from "@/lib/yearly";

import styles from "./Yearly.module.css";
import { YearlyGate } from "./YearlyGate";

/** "Your 2027" on the hadahan: a link to the year for this lagna. */
export function YearlyLink({
  t,
  lang,
  lagna,
  lagnaName,
}: {
  t: Dictionary["yearly"];
  lang: Locale;
  lagna: string;
  lagnaName: string;
}) {
  const year = YEARS[0];
  return (
    <YearlyGate>
      <section className={`rise ${styles.panel}`} aria-labelledby="yearly-title" data-card="yearly">
        <h2 id="yearly-title" className="display">
          {fill(t.hadahanTitle, { year })}
        </h2>
        <p className="soft">{fill(t.hadahanLead, { year, lagna: lagnaName })}</p>
        <Link href={`/${lang}/forecast/${year}/${lagna}`} className="btn btn-outline lift">
          {fill(t.hadahanOpen, { year })}
        </Link>
      </section>
    </YearlyGate>
  );
}
