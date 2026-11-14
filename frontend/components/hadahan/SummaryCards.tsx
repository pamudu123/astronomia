import type { Dictionary } from "@/app/[lang]/dictionaries";
import { type Chart, type Labels, fill, formatDegree } from "@/lib/hadahan";
import type { Locale } from "@/lib/i18n";
import { RASHI } from "@/lib/rashi";

import styles from "./SummaryCards.module.css";

type Props = {
  lang: Locale;
  t: Dictionary["hadahan"]["result"];
  labels: Labels;
  chart: Chart;
};

const rashiImage = (key: string) => RASHI.find((r) => r.key === key)?.image ?? "";

/** Points on a circle, with 0 degrees at the top and angles growing anticlockwise. */
function polar(cx: number, cy: number, r: number, degrees: number): [number, number] {
  const radians = ((-90 - degrees) * Math.PI) / 180;
  return [cx + r * Math.cos(radians), cy + r * Math.sin(radians)];
}

/** One twelfth of a ring, as a closed path. */
function segment(index: number, outer: number, inner: number): string {
  const [a, b] = [index * 30, index * 30 + 30];
  const [x1, y1] = polar(60, 60, outer, a);
  const [x2, y2] = polar(60, 60, outer, b);
  const [x3, y3] = polar(60, 60, inner, b);
  const [x4, y4] = polar(60, 60, inner, a);
  const f = (n: number) => n.toFixed(2);
  // Angles grow anticlockwise on screen: the outer edge sweeps that way, the inner edge back.
  return `M${f(x1)} ${f(y1)}A${outer} ${outer} 0 0 0 ${f(x2)} ${f(y2)}L${f(x3)} ${f(y3)}A${inner} ${inner} 0 0 1 ${f(x4)} ${f(y4)}Z`;
}

/** The sky over the horizon, with the sign rising at the eastern point. */
function Horizon({ image, t }: { image: string; t: Props["t"] }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 240 124" className={styles.visual}>
      <path d="M40 96A80 80 0 0 1 200 96" className={styles.sky} />
      <path d="M40 96A80 80 0 0 1 58 45" className={styles.rise} markerEnd="url(#rise-arrow)" />
      <defs>
        <marker id="rise-arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto">
          <path d="M0 0L10 5L0 10Z" className={styles.arrow} />
        </marker>
      </defs>
      <line x1="10" y1="96" x2="230" y2="96" className={styles.horizon} />
      {image && <image href={image} x="66" y="50" width="44" height="44" />}
      <circle cx="40" cy="96" r="6" className={styles.point} />
      <text x="40" y="116" className={styles.label}>
        {t.east}
      </text>
      <text x="120" y="116" className={styles.labelSoft}>
        {t.horizon}
      </text>
      <text x="200" y="116" className={styles.label}>
        {t.west}
      </text>
    </svg>
  );
}

/** The zodiac as twelve parts, with the Moon's part lit and the Moon where it stood. */
function MoonRing({ index, degree, image }: { index: number; degree: number; image: string }) {
  const [mx, my] = polar(60, 60, 44, index * 30 + degree);
  return (
    <svg aria-hidden="true" viewBox="0 0 120 120" className={styles.ring}>
      {Array.from({ length: 12 }, (_, i) => i)
        .filter((i) => i !== index)
        .map((i) => (
          <path key={i} d={segment(i, 54, 34)} className={styles.segment} />
        ))}
      {/* Drawn last, so its gold edge is not covered by its neighbours. */}
      <path d={segment(index, 54, 34)} className={styles.segmentOn} />
      {image && <image href={image} x="38" y="38" width="44" height="44" />}
      <path
        d={`M${mx.toFixed(2)} ${(my - 7).toFixed(2)}A7 7 0 0 0 ${mx.toFixed(2)} ${(my + 7).toFixed(2)}A9.5 9.5 0 0 1 ${mx.toFixed(2)} ${(my - 7).toFixed(2)}Z`}
        className={styles.moon}
      />
    </svg>
  );
}

/** All 27 stars, the birth star lit, opened out into its four quarters. */
function StarQuarters({ index, pada }: { index: number; pada: number }) {
  const step = 224 / 27;
  const tickX = 8 + step * index + step / 2;
  const boxes = [0, 1, 2, 3].map((i) => 8 + i * 57);
  return (
    <svg aria-hidden="true" viewBox="0 0 240 92" className={styles.visual}>
      {Array.from({ length: 27 }, (_, i) => (
        <rect
          key={i}
          x={8 + step * i + 1}
          y={i === index ? 4 : 10}
          width={step - 2}
          height={i === index ? 20 : 10}
          rx="1.5"
          className={i === index ? styles.tickOn : styles.tick}
        />
      ))}
      <path d={`M${tickX - step / 2} 26L8 50H236L${tickX + step / 2} 26Z`} className={styles.zoom} />
      {boxes.map((x, i) => (
        <g key={i}>
          <rect x={x} y="52" width="53" height="34" rx="6" className={i + 1 === pada ? styles.quarterOn : styles.quarter} />
          <text x={x + 26.5} y="74" className={i + 1 === pada ? styles.quarterTextOn : styles.quarterText}>
            {i + 1}
          </text>
        </g>
      ))}
    </svg>
  );
}

/**
 * The first thing a reader sees: three plain answers, each with a small drawing of what it
 * measures. The traditional term sits beside the everyday one (QA report, section D).
 */
export function SummaryCards({ lang, t, labels, chart }: Props) {
  const { lagna, moon } = chart;
  const sign = (key: string) => labels.rashi[key];
  const signLine = (key: string, degree: number) =>
    lang === "en" ? `${sign(key).western} · ${formatDegree(degree)}` : formatDegree(degree);

  const cards = [
    {
      id: "lagna",
      title: t.risingTitle,
      term: t.risingTerm,
      visual: <Horizon image={rashiImage(lagna.sign)} t={t} />,
      value: sign(lagna.sign).name,
      sub: signLine(lagna.sign, lagna.degree),
      fact: fill(t.signOf, { n: lagna.sign_number }),
      text: t.lagnaText,
    },
    {
      id: "rashi",
      title: t.moonTitle,
      term: t.moonTerm,
      visual: <MoonRing index={moon.sign_number - 1} degree={moon.degree} image={rashiImage(moon.sign)} />,
      value: sign(moon.sign).name,
      sub: signLine(moon.sign, moon.degree),
      fact: fill(t.signOf, { n: moon.sign_number }),
      text: t.rashiText,
    },
    {
      id: "nakath",
      title: t.starTitle,
      term: t.starTerm,
      visual: <StarQuarters index={moon.nakshatra_number - 1} pada={moon.pada} />,
      value: labels.nakshatra[moon.nakshatra],
      sub: fill(t.quarterOf, { pada: moon.pada }),
      fact: fill(t.starOf, { n: moon.nakshatra_number }),
      text: t.nakathText,
    },
  ];

  return (
    <section className={styles.section} aria-labelledby="glance-title">
      <h2 id="glance-title" className={`display ${styles.heading}`}>
        {t.glance}
      </h2>
      <div className={styles.cards}>
        {cards.map((card, index) => (
          <article
            key={card.id}
            className={`rise ${styles.card}`}
            style={{ animationDelay: `${0.1 * (index + 1)}s` }}
            data-card={card.id}
          >
            <header className={styles.head}>
              <h3 className={styles.title}>{card.title}</h3>
              <span className={styles.term}>{card.term}</span>
            </header>
            {card.visual}
            <div className={styles.value}>
              <span className={`display ${styles.name}`}>{card.value}</span>
              <span className={styles.sub}>{card.sub}</span>
              <span className={styles.fact}>{card.fact}</span>
            </div>
            <p className={styles.text}>{card.text}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
