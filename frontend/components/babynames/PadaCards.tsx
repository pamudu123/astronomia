import type { Dictionary } from "@/app/[lang]/dictionaries";
import { type PadaLetter, degrees } from "@/lib/babynames";
import { fill } from "@/lib/hadahan";

import styles from "./BabyNames.module.css";

type Props = {
  t: Dictionary["babyNames"];
  padas: PadaLetter[];
  /** The pada of the birth being shown, if any. */
  current?: number;
};

/** The four padas of a star, each with its letter, transliteration and Moon sign. */
export function PadaCards({ t, padas, current }: Props) {
  return (
    <ol className={styles.padas}>
      {padas.map((pada) => (
        <li
          key={pada.pada}
          className={`${styles.pada} ${pada.pada === current ? styles.padaCurrent : ""}`}
          data-pada={pada.pada}
        >
          <span className={styles.padaLabel}>{fill(t.padaLabel, { pada: pada.pada })}</span>
          <span className={`sinhala ${styles.letter}`} lang="si">
            {pada.letter}
          </span>
          <span className={styles.latin}>{pada.latin}</span>
          <span className={styles.small}>
            {fill(t.range, {
              rashi: pada.rashi_name,
              from: degrees(pada.from_degree),
              to: degrees(pada.to_degree),
            })}
          </span>
          {pada.others.length > 0 && (
            <span className={styles.small}>{fill(t.others, { letters: pada.others.join(" ") })}</span>
          )}
          {pada.pada === current && <span className={styles.tag}>{t.yourPada}</span>}
        </li>
      ))}
    </ol>
  );
}
