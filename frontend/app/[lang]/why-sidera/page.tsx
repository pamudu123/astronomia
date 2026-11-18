import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ArrowRight } from "@/components/Icons";
import { Starfield } from "@/components/Starfield";
import { CalcCard } from "@/components/why/CalcCard";
import { PillarArt } from "@/components/why/PillarArt";
import { WhyIcon } from "@/components/why/WhyIcons";
import { ARTICLES } from "@/lib/articles";
import { fill } from "@/lib/hadahan";
import { hasLocale } from "@/lib/i18n";

import { getDictionary } from "../dictionaries";
import styles from "./why.module.css";

const STEP_ICONS = ["calendar", "maths", "ai", "share"];

export async function generateMetadata({ params }: PageProps<"/[lang]/why-sidera">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const dict = await getDictionary(lang);
  return { title: `${dict.whyPage.eyebrow} · Sidera`, description: dict.whyPage.meta };
}

export default async function WhySideraPage({ params }: PageProps<"/[lang]/why-sidera">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  const page = dict.whyPage;
  // The credit keeps "ppworks" in bold wherever the language puts it.
  const [credit, creditAfter] = page.builtBy.split("{name}");

  const actions = (
    <>
      <Link href={`/${lang}/hadahan`} className="btn btn-primary lift">
        {page.ctaHadahan}
        <ArrowRight />
      </Link>
      <Link href={`/${lang}/porondam`} className="btn btn-outline lift">
        {page.ctaPorondam}
      </Link>
    </>
  );

  return (
    <main id="main">
      {/* 1. Hero */}
      <div className={styles.heroWrap}>
        <Image src="/images/hero-sky.jpg" alt="" fill priority sizes="100vw" className={styles.heroSky} />
        <div className={styles.heroShade} aria-hidden="true" />
        <Starfield />
        <section className={`container ${styles.hero}`}>
          <div className={styles.heroText}>
            <p className={`rise ${styles.eyebrow}`}>{page.eyebrow}</p>
            <h1 className={`rise display ${styles.title}`} style={{ animationDelay: ".1s" }}>
              {page.title}
            </h1>
            <p className={`rise ${styles.lead}`} style={{ animationDelay: ".2s" }}>
              {page.lead}
            </p>
            <ul className={`rise ${styles.badges}`} style={{ animationDelay: ".25s" }}>
              {page.badges.map((badge) => (
                <li key={badge} className={styles.badge}>
                  {badge}
                </li>
              ))}
            </ul>
            <div className={`rise ${styles.actions}`} style={{ animationDelay: ".3s" }}>
              {actions}
            </div>
          </div>
          <div className={`rise ${styles.heroCard}`} style={{ animationDelay: ".2s" }}>
            <CalcCard lang={lang} copy={page.calc} />
          </div>
        </section>
      </div>

      {/* 2. Three pillars, maths first */}
      <section className={`container ${styles.section}`} aria-labelledby="pillars-title">
        <h2 id="pillars-title" className={`display ${styles.sectionTitle}`}>
          {page.pillarsTitle}
        </h2>
        <ul className={styles.pillars}>
          {page.pillars.map((pillar) => (
            <li
              key={pillar.title}
              className={`${styles.reveal} ${styles.pillar} ${pillar.icon === "maths" ? styles.pillarLead : ""}`}
            >
              <div className={styles.pillarArt}>
                <PillarArt name={pillar.icon} />
              </div>
              <h3 className={`display ${styles.pillarTitle}`}>{pillar.title}</h3>
              <p className="soft">{pillar.text}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* 3. The groundwork: how the layers combine for one reading */}
      <section className={styles.band} aria-labelledby="ground-title">
        <div className={`container ${styles.section}`}>
          <header className={styles.sectionHead}>
            <h2 id="ground-title" className={`display ${styles.sectionTitle}`}>
              {page.groundTitle}
            </h2>
            <p className="soft">{page.groundLead}</p>
          </header>
          <ol className={styles.layers}>
            {page.layers.map((layer, index) => (
              <li key={layer.title} className={`${styles.reveal} ${styles.layer}`}>
                <span className={styles.layerIcon}>
                  <WhyIcon name={layer.icon} />
                </span>
                <h3 className={styles.cardTitle}>
                  <span className={styles.layerNumber}>{index + 1}.</span> {layer.title}
                </h3>
                <p className="soft">{layer.text}</p>
              </li>
            ))}
          </ol>
          <ul className={styles.facts}>
            {page.facts.map((fact) => (
              <li key={fact.label} className={styles.fact}>
                <span className={`display ${styles.factValue}`}>{fact.value}</span>
                <span className="soft">{fact.label}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* 4. Journey */}
      <section className={`container ${styles.section}`} aria-labelledby="journey-title">
        <h2 id="journey-title" className={`display ${styles.sectionTitle}`}>
          {page.journeyTitle}
        </h2>
        <ol className={styles.journey}>
          {page.steps.map((step, index) => (
            <li key={step.title} className={styles.step}>
              <span className={styles.stepIcon}>
                <WhyIcon name={STEP_ICONS[index]} />
                <span className={styles.stepNumber} aria-hidden="true">
                  {index + 1}
                </span>
              </span>
              <h3 className={styles.cardTitle}>{step.title}</h3>
              <p className="soft">{step.text}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* 5. Tools */}
      <section className={styles.band} aria-labelledby="tools-title">
        <div className={`container ${styles.section}`}>
          <h2 id="tools-title" className={`display ${styles.sectionTitle}`}>
            {page.toolsTitle}
          </h2>
          <ul className={styles.cards}>
            {page.tools.map((tool) => (
              <li key={tool.title}>
                <Link href={`/${lang}/${tool.href}`} className={`lift ${styles.card}`}>
                  <h3 className={styles.cardTitle}>{tool.title}</h3>
                  <p className="soft">{tool.text}</p>
                  <span className={styles.cardCta} aria-hidden="true">
                    <ArrowRight size={16} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* 6. Articles: hidden until the first one is added in lib/articles.ts */}
      {ARTICLES.length > 0 && (
        <section className={`container ${styles.section}`} aria-labelledby="articles-title">
          <header className={styles.sectionHead}>
            <h2 id="articles-title" className={`display ${styles.sectionTitle}`}>
              {page.articlesTitle}
            </h2>
            <p className="soft">{page.articlesLead}</p>
          </header>
          <ul className={styles.cards}>
            {ARTICLES.map((article) => (
              <li key={article.href}>
                <Link href={`/${lang}/${article.href}`} className={`lift ${styles.card}`}>
                  <span className={styles.meta}>
                    {article.category[lang]} · {fill(page.minutes, { minutes: article.minutes })}
                  </span>
                  <h3 className={styles.cardTitle}>{article.title[lang]}</h3>
                  <p className="soft">{article.summary[lang]}</p>
                  <span className={styles.cardCta} aria-hidden="true">
                    <ArrowRight size={16} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 7. Closing */}
      <section className={`container ${styles.closing}`}>
        <h2 className={`display ${styles.sectionTitle}`}>{page.closing}</h2>
        <div className={styles.actions}>{actions}</div>
        <p className={styles.note}>{page.disclaimer}</p>
      </section>

      {/* 8. A small credit */}
      <p className={styles.credit}>
        {credit}
        <strong>ppworks</strong>
        {creditAfter}
      </p>
    </main>
  );
}
