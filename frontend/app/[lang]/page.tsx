import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ArrowRight, Eye, Globe, Lock } from "@/components/Icons";
import { Starfield } from "@/components/Starfield";
import { ZodiacWheel } from "@/components/ZodiacWheel";
import { fill } from "@/lib/hadahan";
import { hasLocale } from "@/lib/i18n";
import { FEATURED_YEAR } from "@/lib/nakath";
import { RASHI } from "@/lib/rashi";

import { getDictionary } from "./dictionaries";
import styles from "./home.module.css";

const TRUST_ICONS = [<Eye key="eye" />, <Lock key="lock" size={28} color="var(--gold)" />, <Globe key="globe" />];

export default async function HomePage({ params }: PageProps<"/[lang]">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = await getDictionary(lang);

  const tools = [
    { ...dict.tools.hadahan, href: `/${lang}/hadahan`, image: "/images/card-hadahan.jpg" },
    { ...dict.tools.porondam, href: `/${lang}/porondam`, image: "/images/card-porondam.jpg" },
  ];

  return (
    <main id="main">
      <div className={styles.heroWrap}>
        <Image
          src="/images/hero-sky.jpg"
          alt=""
          fill
          priority
          sizes="100vw"
          className={styles.heroSky}
        />
        <div className={styles.heroShade} aria-hidden="true" />
        <div className={styles.heroFade} aria-hidden="true" />
        <Starfield />

        <section className={`container ${styles.hero}`}>
          <div className={styles.heroText}>
            <p className={`rise sinhala ${styles.eyebrow}`}>{dict.hero.eyebrow}</p>
            <h1 className={`rise display ${styles.heroTitle}`} style={{ animationDelay: ".1s" }}>
              {dict.hero.title}
            </h1>
            <p className={`rise ${styles.heroLead}`} style={{ animationDelay: ".2s" }}>
              {dict.hero.lead}
            </p>
            <div className={`rise ${styles.actions}`} style={{ animationDelay: ".3s" }}>
              <Link href={`/${lang}/hadahan`} className="btn btn-primary lift">
                {dict.hero.ctaHadahan}
                <ArrowRight />
              </Link>
              <Link href={`/${lang}/porondam`} className="btn btn-outline lift">
                {dict.hero.ctaPorondam}
              </Link>
            </div>
            <p className={`rise soft ${styles.privacy}`} style={{ animationDelay: ".4s" }}>
              <Lock />
              {dict.hero.privacy}
            </p>
          </div>
          <div className={`rise ${styles.heroWheel}`} style={{ animationDelay: ".2s" }}>
            <ZodiacWheel label={dict.hero.wheelLabel} />
          </div>
        </section>
      </div>

      <section className={`container ${styles.section}`} aria-labelledby="tools-title">
        <div className={styles.sectionHead}>
          <h2 id="tools-title" className={`display ${styles.sectionTitle}`}>
            {dict.tools.title}
          </h2>
          <p className="soft">{dict.tools.lead}</p>
        </div>
        <div className={styles.toolGrid}>
          {tools.map((tool) => (
            <Link key={tool.href} href={tool.href} className={`lift ${styles.toolCard}`}>
              <Image
                src={tool.image}
                alt=""
                width={640}
                height={400}
                sizes="(max-width: 700px) 100vw, 560px"
                className={styles.toolImage}
              />
              <div className={styles.toolHead}>
                <span className={`sinhala ${styles.toolLabel}`}>{tool.label}</span>
                <h3 className={`display ${styles.toolTitle}`}>{tool.title}</h3>
              </div>
              <ul className={styles.toolList}>
                {tool.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <span className={styles.toolCta}>
                {tool.cta}
                <ArrowRight />
              </span>
            </Link>
          ))}
        </div>
        <Link href={`/${lang}/porondam/stars`} className={styles.toolMore}>
          {dict.porondam.stars.homeLink}
          <ArrowRight />
        </Link>
        <Link href={`/${lang}/avurudu/${FEATURED_YEAR}`} className={styles.toolMore} data-link="avurudu">
          {fill(dict.avurudu.homeLink, { year: FEATURED_YEAR })}
          <ArrowRight />
        </Link>
        <Link href={`/${lang}/nakath`} className={styles.toolMore} data-link="nakath">
          {dict.nakath.homeLink}
          <ArrowRight />
        </Link>
      </section>

      <section className={`container ${styles.sectionTight}`} aria-labelledby="rashi-title">
        <div className={styles.sectionHead}>
          <h2 id="rashi-title" className={`display ${styles.sectionTitle}`}>
            {dict.rashi.title}
          </h2>
          <p className="soft">{dict.rashi.lead}</p>
        </div>
        <ul className={styles.rashiGrid}>
          {RASHI.map((rashi) => (
            <li key={rashi.key} className={`lift ${styles.rashi}`}>
              <Image
                src={rashi.image}
                alt=""
                width={96}
                height={96}
                unoptimized={rashi.image.endsWith(".svg")}
              />
              <span className={styles.rashiName}>{rashi.en}</span>
              <span className={`sinhala ${styles.rashiSinhala}`}>{rashi.si}</span>
            </li>
          ))}
        </ul>
      </section>

      <section id="how" className={styles.howBand} aria-labelledby="how-title">
        <div className={`container ${styles.how}`}>
          <h2 id="how-title" className={`display ${styles.sectionTitle}`}>
            {dict.how.title}
          </h2>
          <ol className={styles.steps}>
            {dict.how.steps.map((step, index) => (
              <li key={step.title} className={styles.step}>
                <span className={styles.stepNumber} aria-hidden="true">
                  {index + 1}
                </span>
                <h3 className={styles.stepTitle}>{step.title}</h3>
                <p className="soft">{step.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className={`container ${styles.trust}`}>
        {dict.trust.map((item, index) => (
          <div key={item.title} className={styles.trustItem}>
            {TRUST_ICONS[index]}
            <div>
              <h3 className={styles.trustTitle}>{item.title}</h3>
              <p className="soft">{item.text}</p>
            </div>
          </div>
        ))}
      </section>
    </main>
  );
}
