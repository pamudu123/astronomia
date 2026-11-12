"use client";

import Image from "next/image";
import { useId, useRef, useState } from "react";

import type { Dictionary } from "@/app/[lang]/dictionaries";
import { ShareIcon } from "@/components/Icons";
import { fill, formatDate } from "@/lib/hadahan";
import type { Locale } from "@/lib/i18n";
import {
  type ShareCreated,
  type ShareRequest,
  createShare,
  deleteShare,
  shareUrl,
  whatsappHref,
} from "@/lib/share";

import styles from "./ShareButton.module.css";

type Props = {
  lang: Locale;
  t: Dictionary["share"];
  request: ShareRequest;
  /** The title with names, and without them for when names are hidden. */
  title: string;
  anonTitle: string;
  summary: string;
  hasNames: boolean;
};

type Step =
  | { kind: "options" }
  | { kind: "creating" }
  | { kind: "created"; share: ShareCreated; url: string }
  | { kind: "deleted" };

/** The Share button and its dialog. Nothing is saved until "Create link" is pressed. */
export function ShareButton({ lang, t, request, title, anonTitle, summary, hasNames }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [step, setStep] = useState<Step>({ kind: "options" });
  const [hideNames, setHideNames] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const shownTitle = hideNames || !hasNames ? anonTitle : title;

  function open() {
    if (step.kind === "deleted") setStep({ kind: "options" });
    setError(null);
    setCopied(false);
    dialog.current?.showModal();
  }

  async function create() {
    setStep({ kind: "creating" });
    setError(null);
    try {
      const share = await createShare({ ...request, hide_names: hideNames });
      setStep({ kind: "created", share, url: shareUrl(window.location.origin, lang, share.code) });
    } catch {
      setStep({ kind: "options" });
      setError(t.failed);
    }
  }

  async function copy(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      // Without clipboard access the link can still be selected in the box.
    }
  }

  async function remove(share: ShareCreated) {
    setDeleting(true);
    setError(null);
    try {
      await deleteShare(share.code, share.delete_token);
      setStep({ kind: "deleted" });
    } catch {
      setError(t.deleteFailed);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <button type="button" className={`btn btn-outline lift ${styles.trigger}`} onClick={open}>
        <ShareIcon />
        {t.button}
      </button>

      <dialog ref={dialog} className={styles.dialog} aria-labelledby={titleId}>
        <div className={styles.head}>
          <h2 id={titleId} className={`display ${styles.title}`}>
            {t.title}
          </h2>
          <button
            type="button"
            className={styles.close}
            aria-label={t.close}
            onClick={() => dialog.current?.close()}
          >
            <svg aria-hidden="true" width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M4 4l10 10M14 4L4 14" />
            </svg>
          </button>
        </div>

        <div className={styles.preview} data-share-preview>
          <Image src="/images/share-preview.jpg" alt="" width={1200} height={630} className={styles.previewImage} />
          <div className={styles.previewText}>
            <span className={styles.previewTitle}>{shownTitle}</span>
            <span className="soft">{summary}</span>
          </div>
        </div>

        {(step.kind === "options" || step.kind === "creating") && (
          <>
            {hasNames && (
              <label className={styles.switch}>
                <span>{t.hideNames}</span>
                <input
                  type="checkbox"
                  checked={hideNames}
                  onChange={(event) => setHideNames(event.target.checked)}
                  disabled={step.kind === "creating"}
                />
              </label>
            )}
            <p className={styles.note}>{t.saveNote}</p>
            <button
              type="button"
              className={`btn btn-primary ${styles.wide}`}
              onClick={create}
              disabled={step.kind === "creating"}
            >
              {step.kind === "creating" ? t.creating : t.create}
            </button>
          </>
        )}

        {step.kind === "created" && (
          <>
            <div className={styles.field}>
              <label htmlFor={`${titleId}-link`} className={styles.label}>
                {t.link}
              </label>
              <div className={styles.linkRow}>
                <input
                  id={`${titleId}-link`}
                  className={styles.linkInput}
                  type="text"
                  readOnly
                  value={step.url}
                  onFocus={(event) => event.target.select()}
                />
                <button type="button" className={styles.copy} onClick={() => copy(step.url)}>
                  {copied ? t.copied : t.copy}
                </button>
              </div>
            </div>
            <a
              className={`btn btn-primary ${styles.wide}`}
              href={whatsappHref(fill(t.whatsappText, { title: shownTitle }), step.url)}
              target="_blank"
              rel="noopener noreferrer"
            >
              <svg aria-hidden="true" width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 2.5a7.5 7.5 0 0 0-6.4 11.4L2.5 17.5l3.7-1A7.5 7.5 0 1 0 10 2.5z" />
              </svg>
              {t.whatsapp}
            </a>
            <p className={styles.note}>{fill(t.openUntil, { date: formatDate(step.share.expires_at, lang) })}</p>
            <button
              type="button"
              className={styles.delete}
              onClick={() => remove(step.share)}
              disabled={deleting}
            >
              {deleting ? t.deleting : t.delete}
            </button>
          </>
        )}

        {step.kind === "deleted" && (
          <p role="status" className={styles.note}>
            {t.deleted}
          </p>
        )}

        {error && (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        )}
      </dialog>
    </>
  );
}
