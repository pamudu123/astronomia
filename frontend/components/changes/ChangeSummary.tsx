import { PlanetIcon } from "@/components/PlanetIcon";
import type { PlanetChange } from "@/lib/changes";
import type { Locale } from "@/lib/i18n";

import styles from "./Changes.module.css";
import { type ChangesText, moveText, untilText, whenText } from "./text";

/** When the change happens and what moves. Needs no backend, so it is always in the page. */
export function ChangeSummary({ t, change, lang }: { t: ChangesText; change: PlanetChange; lang: Locale }) {
  return (
    <section className={`rise ${styles.summary}`} aria-label={whenText(t, change, lang)}>
      <p className={styles.when}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <rect x="3" y="5" width="18" height="16" rx="3" />
          <path d="M3 10h18M8 3v4M16 3v4" strokeLinecap="round" />
        </svg>
        <time dateTime={change.moment}>{whenText(t, change, lang)}</time>
      </p>
      <ul className={styles.moves}>
        {change.moves.map((move) => (
          <li key={move.body} className={styles.moveRow}>
            <PlanetIcon body={move.body} />
            <div>
              <p>{moveText(t, move, lang)}</p>
              <p className={styles.small}>{untilText(t, move, lang)}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
