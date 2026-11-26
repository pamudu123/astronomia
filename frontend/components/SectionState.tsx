"use client";

import { useEffect, useRef } from "react";

import styles from "./SectionState.module.css";

type Props = {
  /** Names the section in the page: "road", "forecast", ... */
  id: string;
  title: string;
  status: "loading" | "failed";
  t: { loading: string; failed: string; retry: string };
  onRetry: () => void;
  /** Roughly the height of the finished section, so the page does not jump when it arrives. */
  height: "short" | "medium" | "long" | "tall";
};

/** Stands in for a section of a result while it loads, or says that it could not load. */
export function SectionState({ id, title, status, t, onRetry, height }: Props) {
  const box = useRef<HTMLElement>(null);
  const retried = useRef(false);

  // The pressed button is gone while the section loads again, so keep the visitor's place.
  useEffect(() => {
    if (status === "loading" && retried.current) box.current?.focus({ preventScroll: true });
  }, [status]);

  return (
    <section
      ref={box}
      tabIndex={-1}
      aria-label={title}
      aria-busy={status === "loading"}
      className={status === "loading" ? `${styles.panel} ${styles[height]}` : styles.panel}
      data-section={id}
      data-status={status}
    >
      <p className={`display ${styles.title}`}>{title}</p>
      <div className={styles.line} role="status">
        {status === "loading" ? t.loading : t.failed}
        {status === "failed" && (
          <button
            type="button"
            className={styles.retry}
            aria-label={`${t.retry}: ${title}`}
            onClick={() => {
              retried.current = true;
              onRetry();
            }}
          >
            {t.retry}
          </button>
        )}
      </div>
      {status === "loading" && <div aria-hidden="true" className={styles.shape} />}
    </section>
  );
}
