import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ArrowRight } from "@/components/Icons";
import styles from "@/components/tools/Tools.module.css";
import { fill } from "@/lib/hadahan";
import { hasLocale } from "@/lib/i18n";
import { FEATURED_YEAR } from "@/lib/nakath";
import { YEARS } from "@/lib/yearly";

import { getDictionary } from "../dictionaries";

export async function generateMetadata({ params }: PageProps<"/[lang]/tools">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const t = (await getDictionary(lang)).allTools;
  return {
    title: t.metaTitle,
    description: t.metaDescription,
    alternates: { canonical: `/${lang}/tools`, languages: { si: "/si/tools", en: "/en/tools" } },
  };
}

type Need = "nothing" | "birth" | "two" | "paper";
type Item = "hadahan" | "forecast" | "changes" | "porondam" | "stars" | "kuja" | "wedding" | "babyNames" | "firstLetters" | "nakath" | "litha" | "avurudu" | "kendara";
type Group = "chart" | "marriage" | "baby" | "daily" | "newYear" | "old";

/** Every tool, grouped by what people are planning. Paths are without the language. */
const GROUPS: { id: Group; tools: { item: Item; path: string; need: Need }[] }[] = [
  {
    id: "chart",
    tools: [
      { item: "hadahan", path: "/hadahan", need: "birth" },
      { item: "forecast", path: `/forecast/${YEARS[0]}`, need: "nothing" },
      { item: "changes", path: "/changes", need: "nothing" },
    ],
  },
  {
    id: "marriage",
    tools: [
      { item: "porondam", path: "/porondam", need: "two" },
      { item: "stars", path: "/porondam/stars", need: "nothing" },
      { item: "kuja", path: "/hadahan", need: "birth" },
      { item: "wedding", path: "/porondam", need: "two" },
    ],
  },
  {
    id: "baby",
    tools: [
      { item: "babyNames", path: "/baby-names", need: "nothing" },
      { item: "firstLetters", path: "/first-letters", need: "birth" },
    ],
  },
  {
    id: "daily",
    tools: [
      { item: "nakath", path: "/nakath", need: "nothing" },
      { item: "litha", path: "/litha", need: "nothing" },
    ],
  },
  { id: "newYear", tools: [{ item: "avurudu", path: `/avurudu/${FEATURED_YEAR}`, need: "nothing" }] },
  { id: "old", tools: [{ item: "kendara", path: "/kendara", need: "paper" }] },
];

export default async function ToolsPage({ params }: PageProps<"/[lang]/tools">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const t = (await getDictionary(lang)).allTools;

  return (
    <main id="main" className={`container ${styles.page}`}>
      <div className={`rise ${styles.head}`}>
        <h1 className={`display ${styles.title}`}>{t.title}</h1>
        <p className="soft">{t.lead}</p>
      </div>

      <nav className={styles.chips} aria-label={t.planning}>
        <span className={styles.chipsLabel}>{t.planning}</span>
        {GROUPS.map((group) => (
          <a key={group.id} href={`#${group.id}`} className={styles.chip}>
            {t.groups[group.id]}
          </a>
        ))}
      </nav>

      {GROUPS.map((group) => (
        <section key={group.id} id={group.id} className={styles.group} aria-labelledby={`${group.id}-title`}>
          <h2 id={`${group.id}-title`} className={`display ${styles.groupTitle}`}>
            {t.groups[group.id]}
          </h2>
          <div className={styles.grid}>
            {group.tools.map((tool) => {
              const item = t.items[tool.item];
              return (
                <Link key={tool.item} href={`/${lang}${tool.path}`} className={`lift ${styles.card}`} data-tool={tool.item}>
                  <span className={styles.cardTop}>
                    <span className={`display ${styles.cardName}`}>{fill(item.name, { year: YEARS[0] })}</span>
                  </span>
                  <span className="soft">{item.text}</span>
                  <span className={styles.cardFoot}>
                    {/* Said only when the tool needs something; most need nothing at all. */}
                    {tool.need === "nothing" ? (
                      <span />
                    ) : (
                      <span className={styles.need}>
                        {t.need}: <strong>{t.needs[tool.need]}</strong>
                      </span>
                    )}
                    <ArrowRight size={16} />
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      ))}

      <section className={styles.hidden} aria-labelledby="hidden-title">
        <h2 id="hidden-title" className={`display ${styles.groupTitle}`}>
          {t.hiddenTitle}
        </h2>
        <ul className={styles.hiddenList}>
          {t.hidden.map((entry) => (
            <li key={entry.title}>
              <strong>{entry.title}</strong>
              <span className="soft">{entry.text}</span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
