"use client";

import Image from "next/image";
import type { ReactNode } from "react";

import { type ChapterId } from "@/lib/assistant/explain";
import { CHAPTER_VISUAL, WHEEL, barLayout, point, wheelLayout } from "@/lib/assistant/visuals";
import { type AnyHadahan, type Chart, type Dasha, type Kuja, type Labels, fill } from "@/lib/hadahan";
import { type Porondam, isCounted } from "@/lib/porondam";
import { RASHI } from "@/lib/rashi";

import styles from "./ChapterDiagram.module.css";
import { useExplainText } from "./PageContext";

type Words = NonNullable<ReturnType<typeof useExplainText>>["diagram"];

/**
 * The diagram under an AI chapter's short answer (docs/17): a flow, the sky wheel, the houses,
 * the life periods bar, the Mars check, or for a match the two people, the factor ring and
 * the serious checks. The PDF report prints the same diagram for the same chapter.
 */

const r2 = (value: number) => Math.round(value * 100) / 100;
const imageOf = (sign: string) => RASHI.find((r) => r.key === sign)?.image ?? "";

function Arrow() {
  return (
    <svg className={styles.arrow} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Cards joined by arrows. Each card: a small label, the value and a note. */
function Flow({ cards }: { cards: { label: string; value: string; note?: ReactNode; image?: string; tone?: string }[] }) {
  return (
    <ol className={styles.flow}>
      {cards.map((card, index) => (
        <li key={index} className={styles.flowItem}>
          <div className={styles.card} data-tone={card.tone}>
            {card.image && <Image src={card.image} alt="" width={40} height={40} unoptimized={card.image.endsWith(".svg")} className={styles.cardArt} />}
            <p className={styles.eyebrow}>{card.label}</p>
            <p className={styles.value}>{card.value}</p>
            {card.note && <div className={styles.note}>{card.note}</div>}
          </div>
          {index < cards.length - 1 && <Arrow />}
        </li>
      ))}
    </ol>
  );
}

function SkyWheel({ chart, labels, t }: { chart: Chart; labels: Labels; t: Words }) {
  const layout = wheelLayout(
    chart.lagna.longitude,
    chart.planets.map((p) => ({ key: p.body, label: labels.planet[p.body]?.short ?? p.body, longitude: p.longitude })),
  );
  const sector = (() => {
    const a = layout.lagnaStart;
    const [x1, y1] = point(a, 146);
    const [x2, y2] = point(a + 30, 146);
    const [x3, y3] = point(a + 30, 118);
    const [x4, y4] = point(a, 118);
    return `M${r2(x1)} ${r2(y1)} A146 146 0 0 0 ${r2(x2)} ${r2(y2)} L${r2(x3)} ${r2(y3)} A118 118 0 0 1 ${r2(x4)} ${r2(y4)} Z`;
  })();
  const [lx, ly] = point(180, 146);
  return (
    <figure className={styles.wheelFigure}>
      <svg className={styles.wheel} viewBox={`0 0 ${WHEEL} ${WHEEL}`} role="img" aria-label={t.wheelNote}>
        <path d={sector} className={styles.lagnaSector} />
        {[146, 118, 64].map((radius) => (
          <circle key={radius} cx="150" cy="150" r={radius} className={radius === 64 ? styles.ringSoft : styles.ring} />
        ))}
        {layout.signs.map((sign) => {
          const [ax, ay] = point(sign.edge, 64);
          const [bx, by] = point(sign.edge, 146);
          const [gx, gy] = point(sign.middle, 132);
          const [hx, hy] = point(sign.middle, 73);
          return (
            <g key={sign.key}>
              <line x1={r2(ax)} y1={r2(ay)} x2={r2(bx)} y2={r2(by)} className={styles.spoke} />
              <image href={sign.image} x={r2(gx - 9)} y={r2(gy - 9)} width="18" height="18" />
              <text x={r2(hx)} y={r2(hy + 2.6)} className={styles.houseNumber}>
                {sign.house}
              </text>
            </g>
          );
        })}
        <line x1="150" y1="150" x2={r2(lx)} y2={r2(ly)} className={styles.lagnaLine} />
        {layout.planets.map((planet) => {
          const [dx, dy] = point(planet.angle, 106);
          const [ax, ay] = point(planet.angle, 102);
          const [bx, by] = point(planet.labelAngle, 94);
          const [tx, ty] = point(planet.labelAngle, 84);
          const moon = planet.key === "moon";
          return (
            <g key={planet.key} className={moon ? styles.moon : styles.planet}>
              <line x1={r2(ax)} y1={r2(ay)} x2={r2(bx)} y2={r2(by)} className={styles.leader} />
              <circle cx={r2(dx)} cy={r2(dy)} r={moon ? 3.2 : 2.4} />
              <text x={r2(tx)} y={r2(ty + 3)} className={styles.planetLabel}>
                {planet.label}
              </text>
            </g>
          );
        })}
      </svg>
      <figcaption className={styles.caption}>{t.wheelNote}</figcaption>
    </figure>
  );
}

function Houses({ chart, labels, t, on = [] }: { chart: Chart; labels: Labels; t: Words; on?: number[] }) {
  const first = chart.lagna.sign_number - 1;
  return (
    <ol className={styles.houses}>
      {Array.from({ length: 12 }, (_, i) => {
        const sign = RASHI[(first + i) % 12];
        const planets = chart.planets.filter((p) => p.house === i + 1).map((p) => labels.planet[p.body]?.name ?? p.body);
        return (
          <li key={i} className={styles.house} data-lagna={i === 0 || undefined} data-on={on.includes(i + 1) || undefined}>
            <Image src={sign.image} alt="" width={26} height={26} unoptimized={sign.image.endsWith(".svg")} className={styles.houseArt} />
            <p className={styles.eyebrow}>{fill(t.house, { number: i + 1 })}</p>
            <p className={styles.value}>{labels.rashi[sign.key]?.name ?? sign.key}</p>
            {planets.length > 0 && <p className={styles.housePlanets}>{planets.join(" · ")}</p>}
          </li>
        );
      })}
    </ol>
  );
}

function PeriodsBar({
  dasha,
  birth,
  labels,
  t,
  saved,
}: {
  dasha: Dasha;
  birth: string;
  labels: Labels;
  t: Words;
  saved?: ReactNode;
}) {
  const main = dasha.current[0];
  const layout = barLayout(
    birth,
    dasha.periods.map((p) => ({
      label: labels.planet[p.lord]?.name ?? p.lord,
      start: p.start,
      end: p.end,
      now: Boolean(main && p.start === main.start),
    })),
  );
  return (
    <figure className={styles.barFigure}>
      <div className={styles.bar}>
        {layout.segments.map((segment, i) => (
          <span
            key={i}
            className={styles.segment}
            data-now={segment.now || undefined}
            data-alt={i % 2 === 1 || undefined}
            data-short={segment.width < 11 || undefined}
            style={{ left: `${segment.left}%`, width: `${segment.width}%` }}
            title={segment.label}
          >
            {segment.width >= 5.2 ? segment.label : ""}
          </span>
        ))}
        {/* A saved report's running period is the one of that day, so today is not marked on it. */}
        {layout.today != null && !saved && (
          <span className={styles.today} style={{ left: `${layout.today}%` }}>
            {t.today}
          </span>
        )}
      </div>
      <div className={styles.ages} aria-hidden="true">
        {layout.ages.map((age) => (
          <span key={age.age} style={{ left: `${age.left}%` }}>
            {age.age}
          </span>
        ))}
      </div>
      <figcaption className={styles.caption}>{t.barNote}</figcaption>
    </figure>
  );
}

function MarsFlow({ kuja, labels, t }: { kuja: Kuja; labels: Labels; t: Words }) {
  const applying = kuja.cancellations.filter((c) => c.applies);
  const status = !kuja.present ? t.kujaAbsent : kuja.reduced ? t.kujaReduced : t.kujaPresent;
  return (
    <Flow
      cards={[
        {
          label: t.marsWhere,
          value: "",
          note: (
            <ul className={styles.points}>
              {kuja.points.map((p) => (
                <li key={p.point} data-counts={p.counts || undefined}>
                  {fill(t.marsPoint, { point: labels.point[p.point] ?? p.point, house: p.house })}{" "}
                  <span className={styles.soft}>· {p.counts ? t.counts : t.notCounts}</span>
                </li>
              ))}
            </ul>
          ),
        },
        {
          label: t.marsRules,
          value: fill(t.marsRulesCount, { count: applying.length, total: kuja.cancellations.length }),
          note: applying.map((c) => labels.kuja_rule[c.id] ?? c.id).join(" · "),
        },
        { label: t.marsResult, value: status, tone: kuja.present ? "attention" : "good" },
      ]}
    />
  );
}

/** The chart chapter's diagram, or nothing for a chapter without one or a result without the data. */
export function ChartDiagram({
  id,
  result,
  labels,
  birth,
  saved,
}: {
  id: ChapterId;
  /** Only the parts drawn, so a shared result (with less in it) fits too. */
  result: Pick<AnyHadahan, "chart" | "dasha" | "kuja">;
  labels: Labels;
  birth?: string | null;
  /** On a saved report: the line saying this was worked out on the day it was saved. */
  saved?: ReactNode;
}) {
  const t = useExplainText()?.diagram;
  const found = CHAPTER_VISUAL[id];
  const { chart, dasha, kuja } = result;
  if (!t || !found || !chart) return null;
  const sign = (key: string) => labels.rashi[key]?.name ?? key;
  const planet = (key: string) => labels.planet[key]?.name ?? key;
  switch (found.visual) {
    case "pillars": {
      const [main, sub] = dasha?.current ?? [];
      return (
        <>
          {saved}
        <Flow
          cards={[
            { label: t.lagna, value: sign(chart.lagna.sign), note: t.pillarLagna, image: imageOf(chart.lagna.sign) },
            { label: t.rashi, value: sign(chart.moon.sign), note: t.pillarRashi, image: imageOf(chart.moon.sign) },
            {
              label: t.nakath,
              value: fill(t.starPada, { star: labels.nakshatra[chart.moon.nakshatra] ?? chart.moon.nakshatra, pada: chart.moon.pada }),
              note: t.pillarStar,
            },
            ...(main
              ? [
                  {
                    label: t.period,
                    value: sub ? fill(t.periodNow, { main: planet(main.lord), sub: planet(sub.lord) }) : planet(main.lord),
                    note: t.pillarPeriod,
                  },
                ]
              : []),
          ]}
        />
        </>
      );
    }
    case "wheel":
      return <SkyWheel chart={chart} labels={labels} t={t} />;
    case "houses":
      return <Houses chart={chart} labels={labels} t={t} on={found.houses} />;
    case "periods":
      return dasha ? (
        <>
          {saved}
          <PeriodsBar dasha={dasha} birth={birth || dasha.periods[0]?.start} labels={labels} t={t} saved={saved} />
        </>
      ) : null;
    case "mars":
      return kuja ? <MarsFlow kuja={kuja} labels={labels} t={t} /> : null;
    default:
      return null;
  }
}

/** The match chapter's diagram. */
export function MatchDiagram({ id, result, labels }: { id: ChapterId; result: Porondam; labels: Labels }) {
  const t = useExplainText()?.diagram;
  const found = CHAPTER_VISUAL[id];
  const { match, bride, groom, kuja } = result;
  if (!t || !found || !match || !bride || !groom) return null;
  switch (found.visual) {
    case "people":
      return (
        <div className={styles.duo}>
          {[
            [bride, t.bride],
            [groom, t.groom],
          ].map(([person, role], index) => {
            const who = person as typeof bride;
            return (
              <div key={index} className={styles.person}>
                <span className={styles.medallion}>
                  <Image src={imageOf(who.rashi)} alt="" width={72} height={72} unoptimized={imageOf(who.rashi).endsWith(".svg")} />
                </span>
                <p className={styles.eyebrow}>{role as string}</p>
                <p className={styles.value}>{who.name || (role as string)}</p>
                <p className={styles.soft}>
                  {fill(t.starPada, { star: labels.nakshatra[who.nakshatra] ?? who.nakshatra, pada: who.pada })} ·{" "}
                  {labels.rashi[who.rashi]?.name ?? who.rashi}
                </p>
              </div>
            );
          })}
        </div>
      );
    case "ring": {
      const count = match.factors.length;
      const gap = 2.4;
      return (
        <div className={styles.ringRow}>
          <svg className={styles.factorRing} viewBox="0 0 300 300" role="img" aria-label={fill(t.score, { passed: match.score.passed, total: match.score.total })}>
            {match.factors.map((factor, index) => {
              const a0 = 90 - (index * 360) / count - gap / 2;
              const a1 = 90 - ((index + 1) * 360) / count + gap / 2;
              const [x1, y1] = point(a0, 140);
              const [x2, y2] = point(a1, 140);
              const [x3, y3] = point(a1, 112);
              const [x4, y4] = point(a0, 112);
              const state = !isCounted(factor) ? "off" : factor.passed ? "pass" : "fail";
              return (
                <path
                  key={factor.id}
                  data-state={state}
                  className={styles.factorSegment}
                  d={`M${r2(x1)} ${r2(y1)} A140 140 0 0 1 ${r2(x2)} ${r2(y2)} L${r2(x3)} ${r2(y3)} A112 112 0 0 0 ${r2(x4)} ${r2(y4)} Z`}
                >
                  <title>{labels.porondam_factor[factor.id]?.name ?? factor.id}</title>
                </path>
              );
            })}
            <text x="150" y="160" className={styles.ringCount}>
              {match.score.passed}
            </text>
            <text x="150" y="188" className={styles.ringOf}>
              / {match.score.total}
            </text>
          </svg>
          <div>
            <p className={styles.value}>{fill(t.score, { passed: match.score.passed, total: match.score.total })}</p>
            <p className={styles.legend} data-state="pass">{t.pass}</p>
            <p className={styles.legend} data-state="fail">{t.fail}</p>
            <p className={styles.legend} data-state="off">{t.notCounted}</p>
          </div>
        </div>
      );
    }
    case "checks": {
      const status = (k: { present: boolean; reduced: boolean }) =>
        !k.present ? t.kujaAbsent : k.reduced ? t.kujaReduced : t.kujaPresent;
      return (
        <div className={styles.checks}>
          {match.hard_checks.map((factor) => (
            <div key={factor.id} className={styles.check} data-state={factor.passed ? "pass" : "fail"}>
              <span className={styles.checkMark} aria-hidden="true">
                {factor.passed ? "✓" : "!"}
              </span>
              <p className={styles.value}>{labels.porondam_factor[factor.id]?.name ?? factor.id}</p>
              <p className={styles.soft}>{labels.porondam_factor[factor.id]?.meaning}</p>
              <p className={styles.checkResult}>{factor.passed ? t.pass : t.fail}</p>
            </div>
          ))}
          <div className={styles.check} data-state="mars">
            <span className={styles.checkMark} aria-hidden="true">
              ♂
            </span>
            <p className={styles.value}>{t.kuja}</p>
            {kuja ? (
              <>
                <p className={styles.soft}>
                  {t.bride}: {status(kuja.bride)}
                </p>
                <p className={styles.soft}>
                  {t.groom}: {status(kuja.groom)}
                </p>
              </>
            ) : (
              <p className={styles.soft}>{t.kujaQuick}</p>
            )}
          </div>
        </div>
      );
    }
    default:
      return null;
  }
}
