import Link from "next/link";
import type { ReactNode } from "react";

import { ArrowRight } from "./Icons";
import styles from "./NextSteps.module.css";

export type Step = { id: string; href: string; label: string };

/** Where to go after a result: the tools that build on what was just worked out. */
export function NextSteps({ title, steps, children }: { title: string; steps: Step[]; children?: ReactNode }) {
  return (
    <section className={styles.next} aria-labelledby="next-title" data-card="next">
      <h2 id="next-title" className={`display ${styles.title}`}>
        {title}
      </h2>
      <ul className={styles.list}>
        {steps.map((step) => (
          <li key={step.id}>
            <Link href={step.href} className={`lift ${styles.step}`} data-step={step.id}>
              <span>{step.label}</span>
              <ArrowRight size={16} />
            </Link>
          </li>
        ))}
      </ul>
      {children}
    </section>
  );
}
