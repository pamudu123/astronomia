"use client";

import {
  type ReactNode,
  createContext,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import type { Dictionary } from "@/app/[lang]/dictionaries";
import { acknowledge, acknowledged, subscribe } from "@/lib/assistant/notice";
import type { Locale } from "@/lib/i18n";

import styles from "./AiNotice.module.css";

/**
 * The AI notice (lib/assistant/notice.ts): the reviewed words, a link to the privacy page and
 * "I understand". `AiNoticeGate` shows it in place of anything that would send to the AI, and
 * mounts that only once the notice is acknowledged, so nothing is sent before.
 */

type Words = Dictionary["assistant"]["notice"];

/** Set by the Assistant, with the other AI words. Without it the AI is off. */
export const NoticeText = createContext<{ t: Words; lang: Locale } | null>(null);

/** True once the notice is acknowledged in this browser (or, with storage blocked, this visit). */
export function useAiAcknowledged(): boolean {
  return useSyncExternalStore(subscribe, acknowledged, () => false);
}

export function AiNotice({ onAccept }: { onAccept?: () => void }) {
  const words = useContext(NoticeText);
  const box = useRef<HTMLElement>(null);
  const title = useId();
  const text = useId();
  // It appears after a tap ("Explain this", opening the chat): bring it to the screen reader
  // and the keyboard at once.
  useEffect(() => {
    box.current?.focus({ preventScroll: true });
  }, []);
  if (!words) return null;
  const { t, lang } = words;

  return (
    <section
      ref={box}
      className={styles.notice}
      aria-labelledby={title}
      aria-describedby={text}
      tabIndex={-1}
      data-ai-notice
    >
      <h3 id={title} className={styles.title}>
        <span aria-hidden="true" className={styles.spark}>
          ✦
        </span>{" "}
        {t.title}
      </h3>
      <p id={text} className={styles.text}>
        {t.text}
      </p>
      <div className={styles.actions}>
        <button
          type="button"
          className={styles.accept}
          onClick={() => {
            acknowledge();
            onAccept?.();
          }}
        >
          {t.accept}
        </button>
        {/* A new tab, so the result on this page (and an open chat) is still there afterwards. */}
        <a className={styles.link} href={`/${lang}/privacy`} target="_blank" rel="noopener">
          {t.privacy}
          <span className="visually-hidden"> {t.newTab}</span>
        </a>
      </div>
    </section>
  );
}

/**
 * Shows the notice until it is acknowledged, then what it guards. Focus moves to that content
 * when this notice's "I understand" was pressed, so the keyboard isn't left on a removed button.
 */
export function AiNoticeGate({ children }: { children: ReactNode }) {
  const ok = useAiAcknowledged();
  const [accepted, setAccepted] = useState(false);
  const after = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (accepted) after.current?.focus({ preventScroll: true });
  }, [accepted]);
  if (!ok) return <AiNotice onAccept={() => setAccepted(true)} />;
  if (!accepted) return children;
  return (
    <div ref={after} tabIndex={-1} className={styles.after}>
      {children}
    </div>
  );
}
