"use client";

import { type KeyboardEvent, type PointerEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { Dictionary } from "@/app/[lang]/dictionaries";
import { useAssistantOn } from "@/components/assistant/PageContext";
import { askAssistant } from "@/lib/assistant/panel";
import { type BirthRequest, type Labels, fill, formatMonthYear } from "@/lib/hadahan";
import type { Locale } from "@/lib/i18n";
import {
  ROAD_YEARS,
  type Journey,
  type Road,
  type RoadStop,
  buildRoad,
  fetchJourney,
  mistAt,
  periodAt,
  qualityAt,
  roadWord,
  stopBeside,
  stopNear,
  subAt,
  withToday,
  yearAt,
} from "@/lib/journey";
import { type RoadText, drawRoad } from "@/lib/journeyDraw";

import styles from "./LifeRoad.module.css";

type Props = {
  lang: Locale;
  t: Dictionary["hadahan"]["result"];
  labels: Labels;
  request: BirthRequest;
};

/** What the card and the header show. It changes only when the road passes a stop or a period. */
type View = { key: string; age: number; stop: RoadStop | null };

const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));

/** The life road: the dasha periods as a road to travel along, the same length for everyone. */
export function LifeRoad({ lang, t, labels, request }: Props) {
  const text = t.road;
  const [journey, setJourney] = useState<Journey | null>(null);

  useEffect(() => {
    let current = true;
    fetchJourney(request, lang)
      .then((result) => {
        if (current && result.journey) setJourney(result.journey);
      })
      // The rest of the hadahan stands without this section.
      .catch(() => undefined);
    return () => {
      current = false;
    };
  }, [request, lang]);

  const road = useMemo(() => {
    if (!journey) return null;
    const base = buildRoad(journey);
    const now = periodAt(base, base.today);
    const line = fill(text.periodText, {
      planet: labels.planet[now.lord].name,
      house: labels.house[now.house - 1],
      theme: now.theme,
    });
    return withToday(base, text.today, line);
  }, [journey, labels, text]);

  if (!journey || !road) return null;
  return <RoadView lang={lang} t={t} labels={labels} road={road} provisional={journey.provisional} />;
}

function RoadView({
  lang,
  t,
  labels,
  road,
  provisional,
}: Omit<Props, "request"> & { road: Road; provisional: boolean }) {
  const text = t.road;
  const stage = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const marker = useRef<HTMLDivElement>(null);
  const map = useRef<HTMLDivElement>(null);
  // Where the viewer is and where they are heading, in years of age. Kept outside React so
  // moving along the road does not re-render the page on every frame.
  const pos = useRef(road.today);
  const target = useRef(road.today);
  const frame = useRef(0);
  const drag = useRef<{ x: number; y: number } | null>(null);
  const [view, setView] = useState<View>(() => viewAt(road, road.today));
  const [dragging, setDragging] = useState(false);
  const canAsk = useAssistantOn();

  const paint = useCallback(() => {
    const element = canvas.current;
    const holder = stage.current;
    if (!element || !holder) return;
    // The canvas fills the stage on a laptop and sits above the card on a phone.
    const { width, height } = element.getBoundingClientRect();
    if (width < 1 || height < 1) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    if (element.width !== Math.round(width * ratio) || element.height !== Math.round(height * ratio)) {
      element.width = Math.round(width * ratio);
      element.height = Math.round(height * ratio);
    }
    const context = element.getContext("2d");
    if (!context) return;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    const words: RoadText = {
      fonts: {
        display: title.current ? getComputedStyle(title.current).fontFamily : "serif",
        body: getComputedStyle(holder).fontFamily,
      },
      planet: (lord) => labels.planet[lord],
      sky: (lord) => fill(text.period, { planet: labels.planet[lord].name }),
      short: (kind) => text.short[kind as keyof typeof text.short] ?? "",
    };
    // On a wide stage the card covers the left, so the road sits to the right of it.
    const centre = width > 720 ? Math.min(0.62, (400 + (width - 400) / 2) / width) : 0.5;
    const blur = drawRoad(context, width, height, road, pos.current, words, centre);
    element.style.filter = blur ? `blur(${blur}px)` : "none";
    if (marker.current) marker.current.style.left = `${(pos.current / ROAD_YEARS) * 100}%`;
    const next = viewAt(road, pos.current);
    setView((current) => (current.key === next.key ? current : next));
  }, [road, labels, text]);

  const go = useCallback(
    (age: number) => {
      target.current = clamp(age, 0, road.last);
      const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const tick = () => {
        const gap = target.current - pos.current;
        if (still || Math.abs(gap) < 0.003) {
          pos.current = target.current;
          frame.current = 0;
        } else {
          pos.current += gap * 0.12;
          frame.current = requestAnimationFrame(tick);
        }
        paint();
      };
      if (!frame.current) frame.current = requestAnimationFrame(tick);
    },
    [road, paint],
  );

  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    const observer = new ResizeObserver(paint);
    observer.observe(element);
    // The web fonts can arrive after the first paint.
    void document.fonts?.ready.then(paint);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame.current);
      frame.current = 0;
    };
  }, [paint]);

  const onKey = (event: KeyboardEvent<HTMLElement>) => {
    const step = event.shiftKey ? 5 : 0.5;
    if (event.key === "ArrowUp" || event.key === "ArrowRight") go(target.current + step);
    else if (event.key === "ArrowDown" || event.key === "ArrowLeft") go(target.current - step);
    else if (event.key === "Home") go(0);
    else if (event.key === "End") go(road.last);
    else return;
    event.preventDefault();
  };

  // Dragging the road: left or up moves forward. Vertical swipes on a phone still scroll the page.
  const onDown = (event: PointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest("[data-card]")) return;
    drag.current = { x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
  };
  const onMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    go(target.current + (drag.current.x - event.clientX + (drag.current.y - event.clientY)) * 0.02);
    drag.current = { x: event.clientX, y: event.clientY };
  };
  const onUp = () => {
    drag.current = null;
    setDragging(false);
  };

  const seek = (event: PointerEvent<HTMLDivElement>) => {
    const box = map.current?.getBoundingClientRect();
    if (box) go(clamp((event.clientX - box.left) / box.width, 0, 1) * ROAD_YEARS);
  };

  const age = view.age;
  const period = periodAt(road, age);
  const sub = subAt(road, age);
  const stop = view.stop;
  const planet = (lord: string) => labels.planet[lord].name;
  const quality = roadWord(qualityAt(road, age));
  const misty = mistAt(road, age) > 0.5;
  const word = misty && quality.tone !== "careful" ? fill(text.misty, { word: text.words[quality.word] }) : text.words[quality.word];
  const year = yearAt(road, age);
  const tone = stop ? stop.tone : period.tone;
  const onward = stop?.kind === "onward";

  const ask = (question: string) =>
    askAssistant(
      fill(text.askContext, { year, age: Math.floor(age), main: planet(period.lord), sub: planet(sub.lord), question }),
    );

  // The good and hard line across the whole life, for the ribbon under the road.
  const wave = useMemo(() => {
    const points: string[] = [];
    for (let i = 0; i <= 400; i++) {
      points.push(`${i * 2.5},${(27 - qualityAt(road, (ROAD_YEARS * i) / 400) * 10).toFixed(1)}`);
    }
    return points.join(" ");
  }, [road]);

  return (
    <section className={`rise ${styles.panel}`} aria-labelledby="road-title" data-card="road">
      <div className={styles.head}>
        <div className={styles.headText}>
          <h2 id="road-title" ref={title} className={`display ${styles.title}`}>
            {text.title}
          </h2>
          <p className="soft">{text.lead}</p>
        </div>
        <p className={styles.age}>
          <b>{Math.floor(age)}</b>
          <span>
            {text.age} · {year}
          </span>
        </p>
      </div>

      <div
        ref={stage}
        className={dragging ? styles.stageDragging : styles.stage}
        tabIndex={0}
        role="group"
        aria-label={text.canvasLabel}
        onKeyDown={onKey}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      >
        <canvas ref={canvas} className={styles.canvas} aria-hidden="true" />
        <p className={`${styles.roadNow} ${styles[quality.tone]}`} data-card="now">
          <i />
          <small>{text.roadNow}</small>
          <b>{word}</b>
        </p>

        <article className={styles.card} aria-live="polite" data-card="stop">
          <div className={styles.cardHead}>
            <span className={`${styles.pill} ${stop?.kind === "today" ? styles.you : styles[tone]}`}>
              {stop?.kind === "today" ? text.here : text.tones[tone]}
            </span>
            <span className={styles.when}>
              {stop
                ? fill(text.when, { year: yearAt(road, stop.y), age: Math.floor(stop.y) })
                : fill(text.years, { from: yearAt(road, period.s), to: yearAt(road, Math.min(period.e, ROAD_YEARS)) })}
            </span>
          </div>
          <h3 className={`display ${styles.cardTitle}`}>
            {stop ? stop.title : fill(text.period, { planet: planet(period.lord) })}
          </h3>
          <p className="soft">
            {stop
              ? stop.text
              : fill(text.periodText, {
                  planet: planet(period.lord),
                  house: labels.house[period.house - 1],
                  theme: period.theme,
                })}
            {!stop && misty && ` ${text.mistText}`}
          </p>
          {stop?.helps && (
            <p>
              <b className={styles.helps}>{text.helps}</b> {stop.helps}
            </p>
          )}
          {!onward && (
            <p className={styles.sub}>
              <b>
                {fill(text.sub, {
                  main: planet(period.lord),
                  sub: planet(sub.lord),
                  from: formatMonthYear(sub.start, lang),
                  to: formatMonthYear(sub.end, lang),
                })}
              </b>{" "}
              {fill(text.subText, {
                sub: planet(sub.lord),
                house: labels.house[sub.house - 1],
                theme: sub.theme,
              })}
            </p>
          )}
          {canAsk && !onward && (
            <div className={styles.ask}>
              <p className={styles.askLabel}>{text.ask}</p>
              <div className={styles.chips}>
                {text.questions.map((question) => (
                  <button key={question} type="button" className={styles.chip} onClick={() => ask(question)}>
                    {question}
                  </button>
                ))}
              </div>
            </div>
          )}
        </article>
      </div>

      <div className={styles.controls}>
        <button type="button" className={styles.button} onClick={() => go(stopBeside(road, target.current, -1)?.y ?? 0)}>
          ‹ {text.prev}
        </button>
        <button type="button" className={styles.buttonMain} onClick={() => go(road.today)}>
          {text.today}
        </button>
        <button
          type="button"
          className={styles.button}
          onClick={() => go(stopBeside(road, target.current, 1)?.y ?? road.last)}
        >
          {text.next} ›
        </button>
        <span className={styles.hint}>{text.hint}</span>
      </div>

      <div>
        <div
          ref={map}
          className={styles.map}
          role="slider"
          tabIndex={0}
          aria-label={text.mapLabel}
          aria-valuemin={0}
          aria-valuemax={ROAD_YEARS}
          aria-valuenow={Math.floor(age)}
          onKeyDown={onKey}
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            seek(event);
          }}
          onPointerMove={(event) => {
            if (event.buttons) seek(event);
          }}
        >
          {road.periods.map((item) => (
            <div
              key={item.start}
              className={`${styles.seg} ${styles[`seg_${item.tone}`]}`}
              style={{
                left: `${(item.s / ROAD_YEARS) * 100}%`,
                width: `${((Math.min(item.e, ROAD_YEARS) - item.s) / ROAD_YEARS) * 100}%`,
              }}
            >
              {planet(item.lord)}
            </div>
          ))}
          {road.eras.map(([from, to]) => (
            <div
              key={from}
              className={styles.era}
              style={{ left: `${(from / ROAD_YEARS) * 100}%`, width: `${((Math.min(to, ROAD_YEARS) - from) / ROAD_YEARS) * 100}%` }}
            />
          ))}
          <svg className={styles.wave} viewBox="0 0 1000 46" preserveAspectRatio="none" aria-hidden="true">
            <polyline points={wave} />
          </svg>
          <div className={styles.mapFade} />
          <div className={styles.todayMark} style={{ left: `${(road.today / ROAD_YEARS) * 100}%` }} />
          <div ref={marker} className={styles.marker} style={{ left: `${(road.today / ROAD_YEARS) * 100}%` }} />
        </div>
        <div className={styles.scale} aria-hidden="true">
          {[0, 20, 40, 60, 80, 100].map((mark) => (
            <span key={mark} style={{ left: `${mark}%` }}>
              {mark === 0 ? `${text.age} 0` : mark}
            </span>
          ))}
        </div>
      </div>

      <div className={styles.legend}>
        <span className={styles.key}>
          <i className={styles.keyGood} />
          {text.legendGood}
        </span>
        <span className={styles.key}>
          <i className={styles.keyMixed} />
          {text.legendMixed}
        </span>
        <span className={styles.key}>
          <i className={styles.keyCareful} />
          {text.legendCareful}
        </span>
        <span className={styles.key}>
          <i className={styles.keyMist} />
          {text.legendErashtaka}
        </span>
        <span className={styles.key}>
          <i className={styles.keyLine} />
          {text.legendLine}
        </span>
      </div>
      <p className={styles.small}>
        {text.note} {provisional && text.provisional}
      </p>
    </section>
  );
}

function viewAt(road: Road, age: number): View {
  const stop = stopNear(road, age);
  const sub = subAt(road, age);
  const { word } = roadWord(qualityAt(road, age));
  const misty = mistAt(road, age) > 0.5;
  // Whole years, so the age and year in the header keep up while travelling.
  const key = `${stop ? `s${stop.y}` : `p${sub.s}`}:${Math.floor(age)}:${yearAt(road, age)}:${word}:${misty}`;
  return { key, age, stop };
}
