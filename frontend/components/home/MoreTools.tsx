import Link from "next/link";
import { connection } from "next/server";
import { type ReactNode, Suspense } from "react";

import type { Dictionary } from "@/app/[lang]/dictionaries";
import { ArrowRight } from "@/components/Icons";
import { localDate } from "@/components/changes/text";
import { backendJson } from "@/lib/backend";
import { FEATURED, findChange } from "@/lib/changes";
import { fill } from "@/lib/hadahan";
import type { Locale } from "@/lib/i18n";
import { COLOMBO, FEATURED_YEAR, type Panchanga, SRI_LANKA, panchangaPath, todayIn } from "@/lib/nakath";
import { YEARS } from "@/lib/yearly";

import styles from "./MoreTools.module.css";

type Props = { lang: Locale; dict: Dictionary };

type ToolLink = { href: string; label: string; detail?: string; id: string };
type Group = { title: string; icon: ReactNode; links: ToolLink[] };

/** The everyday tools on the home page: today's nakath, then the other tools in groups. */
export function MoreTools({ lang, dict }: Props) {
  const t = dict.more;
  const featured = findChange(FEATURED);

  const groups: Group[] = [
    {
      title: t.times,
      icon: <ClockIcon />,
      links: [
        { id: "nakath", href: `/${lang}/nakath`, label: dict.nakath.title },
        {
          id: "avurudu",
          href: `/${lang}/avurudu/${FEATURED_YEAR}`,
          label: dict.avurudu.footer,
          detail: String(FEATURED_YEAR),
        },
        { id: "litha", href: `/${lang}/litha`, label: dict.litha.indexTitle },
        { id: "first-letters", href: `/${lang}/first-letters`, label: dict.firstLetters.title },
      ],
    },
    {
      title: t.family,
      icon: <FamilyIcon />,
      links: [
        { id: "baby-names", href: `/${lang}/baby-names`, label: dict.babyNames.homeLink },
        { id: "stars", href: `/${lang}/porondam/stars`, label: dict.porondam.stars.homeLink },
      ],
    },
    {
      title: t.year,
      icon: <PlanetIcon />,
      links: [
        ...(featured
          ? [
              {
                id: "changes",
                href: `/${lang}/changes/${featured.id}`,
                label: dict.changes.kind[featured.kind],
                detail: localDate(featured, lang),
              },
            ]
          : []),
        { id: "forecast", href: `/${lang}/forecast/${YEARS[0]}`, label: fill(dict.yearly.footer, { year: YEARS[0] }) },
      ],
    },
    {
      title: t.old,
      icon: <ScrollIcon />,
      links: [{ id: "kendara", href: `/${lang}/kendara`, label: dict.kendara.title }],
    },
  ];

  return (
    <section id="more" className={`container ${styles.section}`} aria-labelledby="more-title">
      <div className={styles.head}>
        <h2 id="more-title" className={`display ${styles.title}`}>
          {t.title}
        </h2>
        <p className="soft">{t.lead}</p>
      </div>

      <Suspense fallback={<TodayShell lang={lang} dict={dict} />}>
        <Today lang={lang} dict={dict} />
      </Suspense>

      <div className={styles.grid}>
        {groups.map((group) => (
          <div key={group.title} className={styles.card}>
            <h3 className={styles.cardHead}>
              {group.icon}
              <span className={`display ${styles.cardTitle}`}>{group.title}</span>
            </h3>
            <ul className={styles.links}>
              {group.links.map((link) => (
                <li key={link.id}>
                  <Link href={link.href} className={styles.link} data-link={link.id}>
                    <span>{link.label}</span>
                    <span className={styles.linkEnd}>
                      {link.detail && <span className={`mono ${styles.detail}`}>{link.detail}</span>}
                      <ArrowRight size={16} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <Link href={`/${lang}/tools`} className={`btn btn-outline lift ${styles.allTools}`} data-link="tools">
        {t.allTools}
        <ArrowRight />
      </Link>
    </section>
  );
}

/** Today depends on the moment of the request, so it is worked out then (Colombo, like the nakath page). */
async function Today({ lang, dict }: Props) {
  await connection();
  const day = todayIn(SRI_LANKA);
  const data = await backendJson<Panchanga>(panchangaPath(day, { placeId: COLOMBO }, lang));
  return <TodayShell lang={lang} dict={dict} data={data} />;
}

/** The today strip. Without data (loading, or the backend is away) it is a link to the nakath page. */
function TodayShell({ lang, dict, data }: Props & { data?: Panchanga | null }) {
  const t = dict.more;
  const n = dict.nakath;
  const facts = data
    ? [
        {
          key: "rahu",
          label: n.rahu,
          value: data.rahu_kalaya ? `${data.rahu_kalaya.start.clock} – ${data.rahu_kalaya.end.clock}` : "—",
        },
        { key: "nakatha", label: n.nakatha, value: data.nakatha[0]?.name ?? "—" },
        { key: "thithi", label: n.thithi, value: data.thithi[0]?.name ?? "—" },
        {
          key: "sun",
          label: `${n.sunrise} · ${n.sunset}`,
          value: data.sunrise && data.sunset ? `${data.sunrise.clock} · ${data.sunset.clock}` : "—",
        },
      ]
    : null;

  return (
    <Link href={`/${lang}/nakath`} className={`lift ${styles.today}`} data-card="today">
      <span className={styles.todayHead}>
        <span className={`display ${styles.todayTitle}`}>{t.today}</span>
        <span className={styles.todayPlace}>
          {[t.todayPlace, data?.weekday_name].filter(Boolean).join(" · ")}
        </span>
      </span>
      {facts ? (
        <span className={styles.facts}>
          {facts.map((fact) => (
            <span key={fact.key} className={styles.fact} data-fact={fact.key}>
              <span className={styles.factLabel}>{fact.label}</span>
              <span className={`mono ${styles.factValue}`}>{fact.value}</span>
            </span>
          ))}
        </span>
      ) : (
        <span className="soft">{t.todayMissing}</span>
      )}
      <span className={styles.todayCta}>
        {t.todayAll}
        <ArrowRight size={16} />
      </span>
    </Link>
  );
}

const iconProps = {
  "aria-hidden": true,
  width: 22,
  height: 22,
  viewBox: "0 0 22 22",
  fill: "none",
  stroke: "var(--gold)",
  strokeWidth: 1.5,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

function ClockIcon() {
  return (
    <svg {...iconProps}>
      <circle cx="11" cy="11" r="8" />
      <path d="M11 6.5V11l3 2" />
    </svg>
  );
}

function FamilyIcon() {
  return (
    <svg {...iconProps}>
      <circle cx="7.5" cy="6.5" r="2.5" />
      <circle cx="15" cy="8.5" r="2" />
      <path d="M3 18c0-3 2-5 4.5-5s4.5 2 4.5 5M12 18c0-2.3 1.3-4 3-4s3 1.7 3 4" />
    </svg>
  );
}

function PlanetIcon() {
  return (
    <svg {...iconProps}>
      <circle cx="11" cy="11" r="5" />
      <ellipse cx="11" cy="11" rx="9.5" ry="3.5" transform="rotate(-20 11 11)" />
    </svg>
  );
}

function ScrollIcon() {
  return (
    <svg {...iconProps}>
      <path d="M6 4h10v14H6z" />
      <path d="M6 4a2 2 0 0 0-2 2v1h2M16 18a2 2 0 0 0 2-2v-1h-2M9 8h4M9 11h4M9 14h2" />
    </svg>
  );
}
