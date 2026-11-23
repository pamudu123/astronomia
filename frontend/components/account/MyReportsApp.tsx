"use client";

import Image from "next/image";
import Link from "next/link";
import { type FormEvent, useEffect, useState } from "react";

import type { Dictionary } from "@/app/[lang]/dictionaries";
import { FULL_REPORT } from "@/components/paid/FullReport";
import {
  type Keep,
  type SavedItem,
  deleteEverything,
  deleteSaved,
  keepLabel,
  keepOf,
  keepReminder,
  listSaved,
  renameSaved,
} from "@/lib/account";
import { type Labels, fetchLabels, fill, formatDate } from "@/lib/hadahan";
import type { Locale } from "@/lib/i18n";

import { GoogleSignIn, useWho } from "./GoogleSignIn";
import styles from "./MyReports.module.css";

type View =
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "ok"; reports: SavedItem[]; labels: Labels; freeLimit: number; paidReports: boolean }
  | { kind: "wiped" };

type Props = { lang: Locale; dict: Dictionary };

/** My reports: every result saved by whoever is signed in on this browser, grouped by tool. */
export function MyReportsApp({ lang, dict }: Props) {
  const t = dict.saved;
  const [view, setView] = useState<View>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  const who = useWho();

  useEffect(() => {
    let current = true;
    Promise.all([listSaved(), fetchLabels(lang)])
      .then(([list, labels]) => {
        if (current) {
          const { reports, free_limit: freeLimit, paid_reports: paidReports } = list;
          setView({ kind: "ok", reports, labels, freeLimit, paidReports });
        }
      })
      .catch(() => {
        if (current) setView({ kind: "error" });
      });
    return () => {
      current = false;
    };
  }, [lang, attempt]);

  function retry() {
    setView({ kind: "loading" });
    setAttempt((count) => count + 1);
  }

  const head = (
    <header className={`rise ${styles.head}`}>
      <h1 className={`display ${styles.title}`}>{t.title}</h1>
      <p className="soft">{t.lead}</p>
    </header>
  );

  if (view.kind === "loading") {
    return (
      <main id="main" className={`container ${styles.page}`}>
        {head}
        <p role="status" className="soft">
          {t.loading}
        </p>
      </main>
    );
  }

  if (view.kind === "error") {
    return (
      <main id="main" className={`container ${styles.page}`}>
        {head}
        <div className={styles.empty}>
          <p role="alert">{t.unavailable}</p>
          <button type="button" className={`btn btn-outline lift ${styles.outline}`} onClick={retry}>
            {t.retry}
          </button>
        </div>
      </main>
    );
  }

  if (view.kind === "wiped" || view.reports.length === 0) {
    return (
      <main id="main" className={`container ${styles.page}`}>
        {head}
        <section className={`rise ${styles.empty}`} data-saved-empty>
          <Image src="/images/moon.png" alt="" width={160} height={160} className={styles.moon} />
          <h2 className={`display ${styles.groupTitle}`}>
            {view.kind === "wiped" ? t.deletedAll : t.emptyTitle}
          </h2>
          {view.kind !== "wiped" && <p className="soft">{t.emptyText}</p>}
          {view.kind === "wiped" && (
            <p className="soft" data-shares-separate>
              {t.sharesSeparate}
            </p>
          )}
          <div className={styles.links}>
            <Link href={`/${lang}/hadahan`} className="btn btn-primary lift">
              {t.makeHadahan}
            </Link>
            <Link href={`/${lang}/porondam`} className="btn btn-outline lift">
              {t.makePorondam}
            </Link>
          </div>
        </section>
        <GoogleSignIn lang={lang} t={t} who={who} hasReports={false} onSignedOut={retry} />
        {/* A Google account can be deleted with nothing saved in it. */}
        {view.kind === "ok" && who?.kind === "google" ? (
          <DeleteEverything t={t} google freeCount={null} onDone={() => setView({ kind: "wiped" })} />
        ) : (
          <p className={`soft ${styles.keepNote}`} data-keep-note>
            {t.keepNote}
          </p>
        )}
      </main>
    );
  }

  const { reports, labels, freeLimit, paidReports } = view;
  const update = (next: SavedItem[]) => setView({ ...view, reports: next });
  const now = new Date();
  const freeCount = reports.filter((item) => keepOf(item, now).kind === "free").length;
  const groups = [
    { id: "porondam", title: t.groupPorondam, items: reports.filter((item) => item.kind === "porondam") },
    { id: "hadahan", title: t.groupHadahan, items: reports.filter((item) => item.kind === "hadahan") },
  ].filter((group) => group.items.length > 0);

  return (
    <main id="main" className={`container ${styles.page}`}>
      {head}
      {groups.map((group) => (
        <section key={group.id} className={`rise ${styles.group}`} aria-labelledby={`group-${group.id}`}>
          <h2 id={`group-${group.id}`} className={`display ${styles.groupTitle}`}>
            {group.title}
          </h2>
          <ul className={styles.grid}>
            {group.items.map((item) => (
              <ReportCard
                key={item.id}
                lang={lang}
                dict={dict}
                labels={labels}
                item={item}
                keep={keepOf(item, now)}
                canKeep={paidReports}
                onRenamed={(title) =>
                  update(reports.map((other) => (other.id === item.id ? { ...other, title } : other)))
                }
                onDeleted={() => update(reports.filter((other) => other.id !== item.id))}
              />
            ))}
          </ul>
        </section>
      ))}
      <GoogleSignIn lang={lang} t={t} who={who} hasReports onSignedOut={retry} />
      {/* Deleting here never touches share links: say so where the delete buttons are. */}
      <p className={`soft ${styles.separate}`} data-shares-separate>
        {t.sharesSeparate}
      </p>
      <DeleteEverything
        t={t}
        google={who?.kind === "google"}
        freeCount={freeCount > 0 ? fill(t.freeCount, { count: freeCount, limit: freeLimit }) : null}
        onDone={() => setView({ kind: "wiped" })}
      />
    </main>
  );
}

/** The name a saved report goes by: its own name, or the names in it. */
export function savedTitle(item: SavedItem, dict: Dictionary): string {
  if (item.title) return item.title;
  if (item.hadahan) {
    const { name } = item.hadahan;
    return name ? fill(dict.hadahan.result.titleNamed, { name }) : dict.share.anonHadahan;
  }
  const match = item.porondam;
  if (!match || (!match.bride && !match.groom)) return dict.share.anonPorondam;
  return fill(dict.porondam.result.title, {
    bride: match.bride || dict.porondam.form.bride,
    groom: match.groom || dict.porondam.form.groom,
  });
}

function summaryOf(item: SavedItem, dict: Dictionary, labels: Labels): string {
  if (item.hadahan) {
    const { lagna, rashi, nakshatra } = item.hadahan;
    return fill(dict.share.summaryHadahan, {
      lagna: labels.rashi[lagna]?.name ?? lagna,
      rashi: labels.rashi[rashi]?.name ?? rashi,
      star: labels.nakshatra[nakshatra] ?? nakshatra,
    });
  }
  const match = item.porondam!;
  const score = fill(dict.share.summaryPorondam, { passed: match.passed, total: match.total });
  return match.mode === "quick" ? `${score} · ${dict.saved.quick}` : score;
}

type CardProps = {
  lang: Locale;
  dict: Dictionary;
  labels: Labels;
  item: SavedItem;
  keep: Keep;
  canKeep: boolean; // "Get the full report" is offered
  onRenamed: (title: string) => void;
  onDeleted: () => void;
};

function ReportCard({ lang, dict, labels, item, keep, canKeep, onRenamed, onDeleted }: CardProps) {
  const t = dict.saved;
  const [mode, setMode] = useState<"view" | "rename" | "confirm">("view");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [draft, setDraft] = useState(item.title);
  const title = savedTitle(item, dict);
  const href = `/${lang}/my/${item.id}`;
  const inputId = `rename-${item.id}`;
  const reminder = keepReminder(keep, t);

  async function act(action: () => Promise<void>, after: () => void) {
    setBusy(true);
    setFailed(false);
    try {
      await action();
      after();
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  function rename(event: FormEvent) {
    event.preventDefault();
    const next = draft.trim();
    void act(
      () => renameSaved(item.id, next),
      () => {
        onRenamed(next);
        setMode("view");
      },
    );
  }

  return (
    <li className={styles.card} data-saved-report={item.kind}>
      <Link href={href} className={styles.cardTitle}>
        {title}
      </Link>
      <span className={styles.summary}>{summaryOf(item, dict, labels)}</span>
      <span className={styles.date}>{fill(t.savedOn, { date: formatDate(item.created_at, lang) })}</span>
      <span className={`${styles.keep} ${keep.kind === "paid" ? styles.keepPaid : ""}`} data-keep={keep.kind}>
        {keepLabel(keep, t)}
      </span>
      {reminder && (
        <div className={styles.reminder} data-keep-reminder>
          <p>{reminder}</p>
          {canKeep && (
            <Link href={`${href}#${FULL_REPORT}`} className={`btn btn-primary lift ${styles.open}`}>
              {t.keep}
            </Link>
          )}
        </div>
      )}

      {mode === "rename" ? (
        <form className={styles.renameForm} onSubmit={rename}>
          <label htmlFor={inputId} className={styles.renameLabel}>
            {t.renameLabel}
          </label>
          <input
            id={inputId}
            className={styles.renameInput}
            value={draft}
            maxLength={80}
            placeholder={savedTitle({ ...item, title: "" }, dict)}
            onChange={(event) => setDraft(event.target.value)}
            autoFocus
          />
          <div className={styles.actions}>
            <button type="submit" className={styles.textButton} disabled={busy}>
              {t.renameSave}
            </button>
            <button type="button" className={styles.textButton} onClick={() => setMode("view")}>
              {t.cancel}
            </button>
          </div>
        </form>
      ) : (
        <div className={styles.actions}>
          {mode === "confirm" ? (
            <>
              <span className={styles.confirm}>{t.deleteConfirm}</span>
              <button
                type="button"
                className={`${styles.textButton} ${styles.danger}`}
                disabled={busy}
                onClick={() => act(() => deleteSaved(item.id), onDeleted)}
              >
                {busy ? t.deleting : t.deleteYes}
              </button>
              <button type="button" className={styles.textButton} onClick={() => setMode("view")}>
                {t.cancel}
              </button>
            </>
          ) : (
            <>
              <Link href={href} className={`btn btn-primary lift ${styles.open}`}>
                {t.openReport}
              </Link>
              <button
                type="button"
                className={styles.textButton}
                onClick={() => {
                  setDraft(item.title);
                  setMode("rename");
                }}
              >
                {t.rename}
              </button>
              <button
                type="button"
                className={`${styles.textButton} ${styles.danger}`}
                onClick={() => setMode("confirm")}
              >
                {t.delete}
              </button>
            </>
          )}
        </div>
      )}
      {failed && (
        <p role="alert" className={styles.error}>
          {t.actionFailed}
        </p>
      )}
    </li>
  );
}

type DeleteProps = { t: Dictionary["saved"]; google: boolean; freeCount: string | null; onDone: () => void };

function DeleteEverything({ t, google, freeCount, onDone }: DeleteProps) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function wipe() {
    setBusy(true);
    setFailed(false);
    try {
      await deleteEverything();
      onDone();
    } catch {
      setFailed(true);
      setBusy(false);
    }
  }

  return (
    <footer className={styles.foot}>
      <p className="soft" data-keep-note>
        {t.keepNote}
      </p>
      {freeCount && <p className="soft">{freeCount}</p>}
      <p className="soft">{google ? t.googleKept : t.browserOnly}</p>
      {confirming ? (
        <div className={styles.actions}>
          <span className={styles.confirm}>{google ? t.deleteAccountConfirm : t.deleteAllConfirm}</span>
          <button type="button" className={`${styles.textButton} ${styles.danger}`} disabled={busy} onClick={wipe}>
            {busy ? t.deleting : google ? t.deleteAccountYes : t.deleteAllYes}
          </button>
          <button type="button" className={styles.textButton} onClick={() => setConfirming(false)}>
            {t.cancel}
          </button>
        </div>
      ) : (
        <button type="button" className={`${styles.textButton} ${styles.danger}`} onClick={() => setConfirming(true)}>
          {google ? t.deleteAccount : t.deleteAll}
        </button>
      )}
      {failed && (
        <p role="alert" className={styles.error}>
          {t.actionFailed}
        </p>
      )}
    </footer>
  );
}
