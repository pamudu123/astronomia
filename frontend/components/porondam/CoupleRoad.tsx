"use client";

import { type PointerEvent, type ReactNode, useCallback, useMemo, useRef, useState } from "react";

import type { Dictionary } from "@/app/[lang]/dictionaries";
import { SectionState } from "@/components/SectionState";
import { useAssistantOn } from "@/components/assistant/PageContext";
import road from "@/components/hadahan/LifeRoad.module.css";
import { RoadArrows } from "@/components/hadahan/RoadArrows";
import { askAssistant } from "@/lib/assistant/panel";
import { type CoupleText, drawCoupleRoad } from "@/lib/coupleDraw";
import {
  type Couple,
  type CoupleStop,
  ROLES,
  type Role,
  ageOf,
  bothFull,
  buildCouple,
  coupleHasToday,
  coupleYear,
  fetchCoupleJourney,
  mistOf,
  periodOf,
  phaseAt,
  qualityOf,
} from "@/lib/coupleJourney";
import { type Labels, fill } from "@/lib/hadahan";
import type { Locale } from "@/lib/i18n";
import { ROAD_YEARS, roadWord, stopBeside, stopNear } from "@/lib/journey";
import type { PorondamRequest } from "@/lib/porondam";
import { type RoadFonts, useRoadTravel } from "@/lib/useRoadTravel";
import { useSection } from "@/lib/useSection";

import styles from "./CoupleRoad.module.css";

export type CoupleRoadText = {
  /** What only the couple's road says. */
  text: Dictionary["porondam"]["road"];
  /** The words it shares with the life road on the hadahan page. */
  words: Dictionary["hadahan"]["result"]["road"];
};

type Props = CoupleRoadText & {
  lang: Locale;
  labels: Labels;
  request: PorondamRequest;
  brideName: string;
  groomName: string;
  /** On a saved match: says the road is worked out today, not when it was saved. */
  note?: ReactNode;
};

/** What the card and the header show. It changes only when the road passes a stop or a period. */
type View = { key: string; at: number; stop: CoupleStop | null };

const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));

/**
 * The couple's road: both life roads side by side, apart before today and together after it.
 * It needs a birth time for both people, so a birth star only match does not show it.
 */
export function CoupleRoad({ lang, text, words, labels, request, brideName, groomName, note }: Props) {
  const full = bothFull(request);
  const section = useSection(fetchCoupleJourney, request, lang, full);
  const bride = section.status === "ready" ? section.value.bride : null;
  const groom = section.status === "ready" ? section.value.groom : null;

  const couple = useMemo(
    () =>
      bride &&
      groom &&
      buildCouple(bride, groom, {
        today: { title: text.todayTitle, text: text.todayText },
        bothMist: { title: text.bothMistTitle, text: text.bothMistText, helps: text.bothMistHelps },
      }),
    [bride, groom, text],
  );

  if (!full) return null;
  if (section.status !== "ready") {
    return (
      <SectionState id="couple-road" title={text.title} status={section.status} t={words.load} onRetry={section.retry} height="tall" />
    );
  }
  if (!bride || !groom || !couple) return null;
  return (
    <CoupleView
      text={text}
      words={words}
      labels={labels}
      couple={couple}
      names={{ bride: brideName, groom: groomName }}
      provisional={bride.provisional || groom.provisional}
      note={note}
    />
  );
}

function CoupleView({
  text,
  words,
  labels,
  couple,
  names,
  provisional,
  note,
}: CoupleRoadText & {
  labels: Labels;
  couple: Couple;
  names: Record<Role, string>;
  provisional: boolean;
  note?: ReactNode;
}) {
  const marker = useRef<HTMLDivElement>(null);
  const map = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<View>(() => viewAt(couple, couple.open));
  const canAsk = useAssistantOn();
  // The ribbon runs from the start of the road to the elder's hundredth year.
  const span = ROAD_YEARS - couple.start;
  const share = (at: number) => `${(clamp((at - couple.start) / span, 0, 1) * 100).toFixed(3)}%`;
  const planet = (lord: string) => labels.planet[lord].name;

  const draw = useCallback(
    (context: CanvasRenderingContext2D, width: number, height: number, at: number, fonts: RoadFonts) => {
      const canvasText: CoupleText = {
        fonts,
        names,
        sky: (_role, lord) => fill(words.period, { planet: labels.planet[lord].name }),
        short: (stop) =>
          stop.kind === "period" && stop.lord
            ? labels.planet[stop.lord].name
            : stop.kind === "both_mist"
              ? text.bothMistShort
              : (words.short[stop.kind as keyof typeof words.short] ?? ""),
      };
      // On a wide stage the card covers the left, so the roads sit to the right of it.
      const centre = width > 720 ? Math.min(0.62, (400 + (width - 400) / 2) / width) : 0.5;
      return drawCoupleRoad(context, width, height, couple, at, canvasText, centre);
    },
    [couple, labels, names, text, words],
  );
  const onMove = useCallback(
    (at: number) => {
      if (marker.current) marker.current.style.left = `${(clamp((at - couple.start) / span, 0, 1) * 100).toFixed(3)}%`;
      const next = viewAt(couple, at);
      setView((current) => (current.key === next.key ? current : next));
    },
    [couple, span],
  );
  // Where the viewer is and where they are heading, in years from the elder's birth.
  const { stage, canvas, title, target, go, dragging, onKey, stageHandlers } = useRoadTravel({
    start: couple.open,
    min: couple.start,
    max: couple.last,
    draw,
    onMove,
  });

  const seek = (event: PointerEvent<HTMLDivElement>) => {
    const box = map.current?.getBoundingClientRect();
    if (box) go(couple.start + clamp((event.clientX - box.left) / box.width, 0, 1) * span);
  };

  const at = view.at;
  const stop = view.stop;
  const year = coupleYear(couple, at);
  const { phase, tone: phaseTone } = phaseAt(couple, at);
  const onward = stop?.kind === "onward";
  const people = ROLES.map((role) => {
    const quality = roadWord(qualityOf(couple, role, at));
    const period = fill(words.period, { planet: planet(periodOf(couple, role, at).lord) });
    const misty = mistOf(couple, role, at) > 0.5;
    return {
      role,
      name: names[role],
      age: Math.floor(ageOf(couple, role, at)),
      tone: quality.tone,
      word: words.words[quality.word],
      detail: misty ? fill(text.inMist, { period }) : period,
    };
  });

  // The card with no stop near: how the two roads stand beside each other here.
  const hardRole: Role | null = phase === "bride_hard" ? "bride" : phase === "groom_hard" ? "groom" : null;
  const standing = hardRole
    ? {
        title: fill(text.phases.one_hard.title, { name: names[hardRole] }),
        text: fill(text.phases.one_hard.text, { other: names[hardRole === "bride" ? "groom" : "bride"] }),
      }
    : text.phases[phase as "both_good" | "both_hard" | "steady"];
  const tone = stop ? stop.tone : phaseTone;
  const pill =
    stop?.kind === "today" ? words.here : stop ? (stop.who === "both" ? text.together : names[stop.who]) : words.tones[tone];

  const ask = (question: string) =>
    askAssistant(
      fill(text.askContext, {
        year,
        brideMain: planet(periodOf(couple, "bride", at).lord),
        groomMain: planet(periodOf(couple, "groom", at).lord),
        question,
      }),
    );

  // The good and hard line for each person, across the ribbon.
  const waves = useMemo(
    () =>
      ROLES.map((role, row) => {
        const points: string[] = [];
        for (let i = 0; i <= 300; i++) {
          const quality = qualityOf(couple, role, couple.start + (span * i) / 300);
          points.push(`${((i * 10) / 3).toFixed(1)},${(row * 30 + 18 - quality * 7).toFixed(1)}`);
        }
        return points.join(" ");
      }),
    [couple, span],
  );

  return (
    <section className={`rise ${road.panel}`} aria-labelledby="couple-road-title" data-card="couple-road">
      <div className={road.head}>
        <div className={road.headText}>
          <h2 id="couple-road-title" ref={title} className={`display ${road.title}`}>
            {text.title}
          </h2>
          <p className="soft">{fill(text.lead, { bride: names.bride, groom: names.groom })}</p>
          {note}
        </div>
        <p className={road.age}>
          <b>{year}</b>
          <span>
            {fill(text.ages, {
              bride: names.bride,
              brideAge: people[0].age,
              groom: names.groom,
              groomAge: people[1].age,
            })}
          </span>
        </p>
      </div>

      <div
        ref={stage}
        className={dragging ? road.stageDragging : road.stage}
        tabIndex={0}
        role="group"
        aria-label={text.canvasLabel}
        {...stageHandlers}
      >
        <canvas ref={canvas} className={road.canvas} aria-hidden="true" />
        <div className={styles.nowRow} data-card="now">
          {people.map((person) => (
            <p key={person.role} className={`${styles.now} ${road[person.tone]}`} data-now={person.role}>
              <i />
              <small>{person.name}</small>
              <b>{person.word}</b>
            </p>
          ))}
        </div>

        <article className={road.card} aria-live="polite" data-card="stop">
          <div className={road.cardHead}>
            <span className={`${road.pill} ${stop?.kind === "today" ? road.you : road[tone]}`}>{pill}</span>
            <span className={road.when}>{stop ? coupleYear(couple, stop.y) : year}</span>
          </div>
          <h3 className={`display ${road.cardTitle}`}>{stop ? stop.title : standing.title}</h3>
          <p className="soft">{stop ? stop.text : standing.text}</p>
          {stop?.helps && (
            <p>
              <b className={road.helps}>{words.helps}</b> {stop.helps}
            </p>
          )}
          {!onward && (
            <ul className={styles.pair}>
              {people.map((person) => (
                <li key={person.role} data-person={person.role}>
                  <b>{fill(text.person, { name: person.name, age: person.age })}</b>
                  <span className={`${styles.word} ${road[person.tone]}`}>{person.word}</span>
                  <span className={styles.detail}>{person.detail}</span>
                </li>
              ))}
            </ul>
          )}
          {canAsk && !onward && (
            <div className={road.ask}>
              <p className={road.askLabel}>{words.ask}</p>
              <div className={road.chips}>
                {text.questions.map((question) => (
                  <button key={question} type="button" className={road.chip} onClick={() => ask(question)}>
                    {question}
                  </button>
                ))}
              </div>
            </div>
          )}
        </article>
      </div>

      <div className={road.controls}>
        <button
          type="button"
          className={road.button}
          onClick={() => go(stopBeside(couple, target.current, -1)?.y ?? couple.start)}
        >
          ‹ {words.prev}
        </button>
        {coupleHasToday(couple) && (
          <button type="button" className={road.buttonMain} onClick={() => go(couple.today)}>
            {words.today}
          </button>
        )}
        <button
          type="button"
          className={road.button}
          onClick={() => go(stopBeside(couple, target.current, 1)?.y ?? couple.last)}
        >
          {words.next} ›
        </button>
        <RoadArrows later={words.later} earlier={words.earlier} onMove={(years) => go(target.current + years)} />
      </div>

      <div className={styles.mapRow}>
        <div className={styles.names} aria-hidden="true">
          <span className={styles.nameBride}>{names.bride}</span>
          <span className={styles.nameGroom}>{names.groom}</span>
        </div>
        <div
          ref={map}
          className={`${road.map} ${styles.map}`}
          role="slider"
          tabIndex={0}
          aria-label={text.mapLabel}
          aria-valuemin={coupleYear(couple, couple.start)}
          aria-valuemax={coupleYear(couple, ROAD_YEARS)}
          aria-valuenow={year}
          onKeyDown={onKey}
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            seek(event);
          }}
          onPointerMove={(event) => {
            if (event.buttons) seek(event);
          }}
        >
          {ROLES.map((role) => {
            const offset = couple.offset[role];
            const row = role === "bride" ? styles.segBride : styles.segGroom;
            return couple.roads[role].periods
              .filter((item) => item.e + offset > couple.start && item.s + offset < ROAD_YEARS)
              .map((item) => (
                <div
                  key={`${role}-${item.start}`}
                  className={`${road.seg} ${styles.seg} ${row} ${road[`seg_${item.tone}`]}`}
                  style={{
                    left: share(item.s + offset),
                    right: `calc(100% - ${share(item.e + offset)})`,
                  }}
                >
                  {planet(item.lord)}
                </div>
              ));
          })}
          {ROLES.map((role) => {
            const offset = couple.offset[role];
            return couple.roads[role].eras
              .filter(([from, to]) => to + offset > couple.start && from + offset < ROAD_YEARS)
              .map(([from, to]) => (
                <div
                  key={`${role}-${from}`}
                  className={`${road.era} ${styles.era} ${role === "bride" ? styles.eraBride : ""}`}
                  style={{ left: share(from + offset), right: `calc(100% - ${share(to + offset)})` }}
                />
              ));
          })}
          <svg className={road.wave} viewBox="0 0 1000 60" preserveAspectRatio="none" aria-hidden="true">
            {waves.map((points, row) => (
              <polyline key={ROLES[row]} points={points} />
            ))}
          </svg>
          <div className={road.mapFade} />
          {coupleHasToday(couple) && <div className={road.todayMark} style={{ left: share(couple.today) }} />}
          <div ref={marker} className={road.marker} style={{ left: share(couple.open) }} />
        </div>
        <div className={`${road.scale} ${styles.scale}`} aria-hidden="true">
          {[0, 1, 2, 3, 4].map((mark) => (
            <span key={mark} style={{ left: `${mark * 25}%` }}>
              {coupleYear(couple, couple.start + (span * mark) / 4)}
            </span>
          ))}
        </div>
      </div>

      <div className={road.legend}>
        <span className={road.key}>
          <i className={road.keyGood} />
          {words.legendGood}
        </span>
        <span className={road.key}>
          <i className={road.keyMixed} />
          {words.legendMixed}
        </span>
        <span className={road.key}>
          <i className={road.keyCareful} />
          {words.legendCareful}
        </span>
        <span className={road.key}>
          <i className={road.keyMist} />
          {words.legendErashtaka}
        </span>
        <span className={`${road.key} ${styles.legendKey}`}>
          <i className={styles.keyThread} />
          {text.legendThread}
        </span>
      </div>
      <p className={road.small}>
        {text.note} {provisional && words.provisional}
      </p>
    </section>
  );
}

function viewAt(couple: Couple, at: number): View {
  const stop = stopNear(couple, at);
  const parts = ROLES.map((role) => {
    const { word } = roadWord(qualityOf(couple, role, at));
    const misty = mistOf(couple, role, at) > 0.5;
    // Whole years, so the ages in the header keep up while travelling.
    return `${Math.floor(ageOf(couple, role, at))}:${periodOf(couple, role, at).lord}:${word}:${misty}`;
  });
  const key = `${stop ? `s${stop.y}${stop.who}` : `p${phaseAt(couple, at).phase}`}:${coupleYear(couple, at)}:${parts.join(":")}`;
  return { key, at, stop };
}
