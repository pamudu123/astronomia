import type { Dictionary } from "@/app/[lang]/dictionaries";

import styles from "./LegalPage.module.css";

type Section = { title: string; body: string[] };
type Glance = { icon: string; title: string; text: string };

/** Small pictures for the "at a glance" cards. Decorative: the text says the same. */
function GlanceIcon({ name }: { name: string }) {
  const common = {
    width: 28,
    height: 28,
    viewBox: "0 0 28 28",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  switch (name) {
    case "account":
      return (
        <svg {...common}>
          <circle cx="14" cy="10" r="4.5" />
          <path d="M5.5 23c1.5-4.5 4.700-6.500 8.500-6.500S21 18.500 22.500 23M4 4l20 20" />
        </svg>
      );
    case "nothing":
      return (
        <svg {...common}>
          <path d="M5 9h18l-1.500 14h-15zM9 9V6.500A1.500 1.500 0 0 1 10.500 5h7A1.500 1.500 0 0 1 19 6.500V9" />
          <path d="M11 14l6 5M17 14l-6 5" />
        </svg>
      );
    case "share":
      return (
        <svg {...common}>
          <circle cx="20" cy="7" r="3" />
          <circle cx="8" cy="14" r="3" />
          <circle cx="20" cy="21" r="3" />
          <path d="M10.700 12.600l6.600-4.200M10.700 15.400l6.600 4.200" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <rect x="5" y="4" width="18" height="20" rx="2" />
          <path d="M9 10h10M9 14h10M9 18h6" />
        </svg>
      );
  }
}

type Props = {
  dict: Dictionary;
  page: { title: string; lead: string; sections: Section[]; glance?: Glance[] };
};

/** The privacy and terms pages: a lead, optional glance cards, then numbered sections. */
export function LegalPage({ dict, page }: Props) {
  return (
    <main id="main" className={`container ${styles.page}`}>
      <header className={`rise ${styles.head}`}>
        <span className={styles.draft}>{dict.legal.draft}</span>
        <h1 className={`display ${styles.title}`}>{page.title}</h1>
        <p className="soft">{page.lead}</p>
        <p className={styles.updated}>{dict.legal.updated}</p>
      </header>

      {page.glance && (
        <ul className={styles.glance}>
          {page.glance.map((item, index) => (
            <li key={item.title} className={`rise ${styles.card}`} style={{ animationDelay: `${0.06 * index}s` }}>
              <span className={styles.icon}>
                <GlanceIcon name={item.icon} />
              </span>
              <h2 className={styles.cardTitle}>{item.title}</h2>
              <p className="soft">{item.text}</p>
            </li>
          ))}
        </ul>
      )}

      <ol className={styles.sections}>
        {page.sections.map((section) => (
          <li key={section.title} className={styles.section}>
            <h2 className={`display ${styles.sectionTitle}`}>{section.title}</h2>
            {section.body.map((text) => (
              <p key={text}>{text}</p>
            ))}
          </li>
        ))}
      </ol>
      <p className={styles.updated}>{dict.legal.contactTodo}</p>
    </main>
  );
}
