"use client";

import { useEffect, useState } from "react";

import type { Dictionary } from "@/app/[lang]/dictionaries";
import type { Labels } from "@/lib/hadahan";
import type { Locale } from "@/lib/i18n";
import {
  type PersonTimeline,
  type PorondamRequest,
  type Timeline,
  fetchTimeline,
  spanPercent,
  yearTicks,
} from "@/lib/porondam";

import styles from "./CoupleTimeline.module.css";

type Props = {
  lang: Locale;
  t: Dictionary["porondam"]["timeline"];
  labels: Labels;
  request: PorondamRequest;
  brideName: string;
  groomName: string;
};

type Role = "bride" | "groom";

/** Saturn's periods as bands on the ten year line. */
function SaturnTrack({ person, timeline }: { person: PersonTimeline; timeline: Timeline }) {
  return (
    <div className={styles.track}>
      {person.saturn.map((period) => {
        const at = spanPercent(period.start, period.end, timeline.start, timeline.end);
        return (
          at && (
            <span
              key={`${period.kind}-${period.start}`}
              className={period.kind === "erashtaka" ? styles.bandErashtaka : styles.bandAshtama}
              style={{ left: `${at.left}%`, width: `${at.width}%` }}
            />
          )
        );
      })}
    </div>
  );
}

/** The main dasha periods as joined pieces, with a small tick where each sub period begins. */
function DashaTrack({
  person,
  timeline,
  labels,
}: {
  person: PersonTimeline;
  timeline: Timeline;
  labels: Labels;
}) {
  if (!person.dasha) return <div className={styles.trackEmpty} />;
  return (
    <div className={styles.track}>
      {person.dasha.map((main, index) => {
        const at = spanPercent(main.start, main.end, timeline.start, timeline.end);
        if (!at) return null;
        const planet = labels.planet[main.lord];
        return (
          <span
            key={main.start}
            className={index % 2 ? styles.dashaOdd : styles.dashaEven}
            style={{ left: `${at.left}%`, width: `${at.width}%` }}
          >
            {at.width > 22 ? planet.name : at.width > 6 ? planet.short : ""}
          </span>
        );
      })}
      {person.dasha.flatMap((main) =>
        main.sub.map((sub) => {
          const at = spanPercent(sub.start, timeline.end, timeline.start, timeline.end);
          return at && at.left > 0 ? (
            <i key={sub.start} className={styles.subTick} style={{ left: `${at.left}%` }} />
          ) : null;
        }),
      )}
    </div>
  );
}

/** "Years ahead for the couple": Saturn and dasha periods for both, on one time line. */
export function CoupleTimeline({ lang, t, labels, request, brideName, groomName }: Props) {
  const [timeline, setTimeline] = useState<Timeline | null>(null);

  useEffect(() => {
    let current = true;
    fetchTimeline(request, lang)
      .then((result) => {
        if (current && result.timeline) setTimeline(result.timeline);
      })
      // The match stands without this section.
      .catch(() => undefined);
    return () => {
      current = false;
    };
  }, [request, lang]);

  if (!timeline) return null;

  const people: [Role, string, PersonTimeline][] = [
    ["bride", brideName, timeline.bride],
    ["groom", groomName, timeline.groom],
  ];
  const ticks = yearTicks(timeline.start, timeline.end);

  return (
    <section className={`rise ${styles.panel}`} aria-labelledby="timeline-title" data-card="timeline">
      <div className={styles.head}>
        <h2 id="timeline-title" className={`display ${styles.title}`}>
          {t.title}
        </h2>
        <p className="soft">{t.lead}</p>
      </div>

      <div className={styles.chart} aria-hidden="true">
        <div className={styles.row}>
          <span />
          <div className={styles.axis}>
            {ticks.map((tick) => (
              <span key={tick.year} className={styles.year} style={{ left: `${tick.left}%` }}>
                {tick.year}
              </span>
            ))}
          </div>
        </div>
        {people.map(([role, name, person]) => (
          <div key={role} className={styles.person} data-role={role}>
            <span className={role === "bride" ? styles.nameBride : styles.nameGroom}>{name}</span>
            <div className={styles.row}>
              <span className={styles.rowLabel}>{t.saturn}</span>
              <SaturnTrack person={person} timeline={timeline} />
            </div>
            <div className={styles.row}>
              <span className={styles.rowLabel}>{t.dasha}</span>
              <DashaTrack person={person} timeline={timeline} labels={labels} />
            </div>
          </div>
        ))}
        <div className={styles.row}>
          <span className={styles.rowLabel}>{t.both}</span>
          <div className={styles.track}>
            {timeline.overlaps.map((span) => {
              const at = spanPercent(span.start, span.end, timeline.start, timeline.end);
              return (
                at && (
                  <span
                    key={span.start}
                    className={styles.bandOverlap}
                    style={{ left: `${at.left}%`, width: `${at.width}%` }}
                  />
                )
              );
            })}
          </div>
        </div>
        <div className={styles.grid}>
          <span />
          <div className={styles.gridLines}>
            {ticks.map((tick) => (
              <i key={tick.year} style={{ left: `${tick.left}%` }} />
            ))}
          </div>
        </div>
      </div>

      <ul className={styles.legend}>
        <li>
          <i className={styles.keyErashtaka} />
          {t.legendErashtaka}
        </li>
        <li>
          <i className={styles.keyAshtama} />
          {t.legendAshtama}
        </li>
        <li>
          <i className={styles.keyOverlap} />
          {t.legendOverlap}
        </li>
      </ul>

      <div className={styles.facts}>
        {people.map(([role, name, person]) => (
          <div key={role} className={styles.fact} data-facts={role}>
            <h3 className={role === "bride" ? styles.nameBride : styles.nameGroom}>{name}</h3>
            {person.saturn.length > 0 ? (
              <ul className={styles.lines}>
                {person.saturn.map((period) => (
                  <li key={`${period.kind}-${period.start}`}>{period.text}</li>
                ))}
              </ul>
            ) : (
              <p className={styles.small}>{t.noSaturn}</p>
            )}
            <p className={styles.small}>{person.dasha_now ?? t.dashaQuick}</p>
          </div>
        ))}
        <div className={styles.fact} data-facts="both">
          <h3 className={styles.nameBoth}>{t.together}</h3>
          {timeline.overlaps.length > 0 ? (
            <ul className={styles.lines}>
              {timeline.overlaps.map((span) => (
                <li key={span.start}>{span.text}</li>
              ))}
            </ul>
          ) : (
            <p className={styles.small}>{t.noOverlap}</p>
          )}
        </div>
      </div>

      <p className={styles.note}>{t.note}</p>
    </section>
  );
}
