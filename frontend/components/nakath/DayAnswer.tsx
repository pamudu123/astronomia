import type { Dictionary } from "@/app/[lang]/dictionaries";
import { dayBar, rahuAdvice } from "@/lib/dayAdvice";
import { fill } from "@/lib/hadahan";
import type { Panchanga } from "@/lib/nakath";
import { useNow } from "@/lib/useNow";

import styles from "./Day.module.css";

/** The answer first: when to start important things, then daylight drawn as a bar. */
export function DayAnswer({ t, shown }: { t: Dictionary["nakath"]; shown: Panchanga }) {
  const now = useNow();
  const advice = rahuAdvice(shown, now);
  const bar = dayBar(shown, now);

  if (!advice || !bar || !shown.sunrise || !shown.sunset) {
    return (
      <section className={styles.answer} data-card="rahu">
        <h2 className={`display ${styles.headline}`}>{t.rahu}</h2>
        <p>{t.noSunrise}</p>
      </section>
    );
  }
  const [sunrise, sunset] = [shown.sunrise.clock, shown.sunset.clock];
  return (
    <section className={styles.answer} data-card="rahu" data-state={advice.state}>
      <h2 className={`display ${styles.headline}`}>{fill(t.day[advice.state], advice)}</h2>
      <div
        className={styles.bar}
        role="img"
        aria-label={fill(t.day.barLabel, { sunrise, sunset, start: advice.start, end: advice.end })}
      >
        <span className={styles.rahu} style={{ left: `${bar.rahu}%`, width: `${bar.width}%` }} />
        {bar.now !== null && (
          <span className={styles.now} style={{ left: `${bar.now}%` }}>
            <span className={bar.now > 80 ? styles.nowLeft : styles.nowText}>{t.day.now}</span>
          </span>
        )}
      </div>
      <div className={styles.legend}>
        <span>
          {t.sunrise} {sunrise}
        </span>
        <span className={styles.avoid}>
          {t.day.avoid}: {t.rahu}{" "}
          <strong>
            {advice.start} · {advice.end}
          </strong>
        </span>
        <span>
          {t.sunset} {sunset}
        </span>
      </div>
      <p className={styles.small}>{t.day.rahuPlain}</p>
    </section>
  );
}
