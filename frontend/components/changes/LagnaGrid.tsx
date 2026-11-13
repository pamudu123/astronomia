import Image from "next/image";
import Link from "next/link";

import { type PlanetChange, houseFrom } from "@/lib/changes";
import { fill } from "@/lib/hadahan";
import type { Locale } from "@/lib/i18n";
import { RASHI } from "@/lib/rashi";

import styles from "./Changes.module.css";
import type { ChangesText } from "./text";

/** The twelve lagnas, each with the houses the change moves through. */
export function LagnaGrid({
  t,
  change,
  lang,
  current,
}: {
  t: ChangesText;
  change: PlanetChange;
  lang: Locale;
  current?: string;
}) {
  return (
    <ul className={styles.lagnas}>
      {RASHI.map((rashi) => (
        <li key={rashi.key}>
          <Link
            href={`/${lang}/changes/${change.id}/${rashi.key}`}
            className={rashi.key === current ? styles.lagnaCurrent : styles.lagna}
            aria-current={rashi.key === current ? "page" : undefined}
            data-lagna={rashi.key}
          >
            <Image src={rashi.image} alt="" width={52} height={52} unoptimized={rashi.image.endsWith(".svg")} />
            <span>
              <span className={styles.lagnaName}>{rashi[lang]}</span>
              {change.moves.map((move) => (
                <span key={move.body} className={styles.lagnaShift}>
                  {t.planet[move.body].name}:{" "}
                  {fill(t.shift, {
                    from: t.house[houseFrom(move.from, rashi.key) - 1],
                    to: t.house[houseFrom(move.to, rashi.key) - 1],
                  })}
                </span>
              ))}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
