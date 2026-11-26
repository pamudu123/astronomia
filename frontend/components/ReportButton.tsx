"use client";

import { useContext, useId, useState } from "react";

import { Download } from "@/components/Icons";
import { BuyButton } from "@/components/paid/BuyInvite";
import { PaidText } from "@/components/paid/ReportAccess";
import { useReportVersion } from "@/components/paid/ReportStatus";
import { AiNotice } from "@/components/assistant/AiNotice";
import { fill } from "@/lib/hadahan";
import {
  type ReportRequest,
  fetchReport,
  reportFileName,
  saveFile,
} from "@/lib/report";

import styles from "./ReportButton.module.css";

type Chapter = { id?: string; title: string; text: string };

type Props = {
  request: ReportRequest;
  /**
   * The AI chapters to print as the report's reading (docs/17). On the paid report this first
   * writes the chapters not written yet, telling `progress` how many are ready.
   */
  reading?: (progress: (done: number, total: number) => void) => Promise<Chapter[]> | Chapter[];
  /** True when the PDF will send chapters to the AI and its notice is not yet accepted. */
  aiNotice?: boolean;
  t: { download: string; preparing: string; downloadFailed: string; writingReading?: string };
  className?: string;
};

/**
 * Downloads the PDF report of the result on the page. While the report is the free version, it
 * says so, and asks first: the free PDF now, or the full version from the buying page.
 */
export function ReportButton({ request, reading, aiNotice = false, t, className = "" }: Props) {
  const paidText = useContext(PaidText);
  const free = useReportVersion() === "free" && paidText !== null;
  // The free PDF or the full version, asked when the button is pressed on the free version.
  const [choosing, setChoosing] = useState(false);
  const choiceId = useId();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  // While the reading is written: chapters ready of all.
  const [writing, setWriting] = useState<{ done: number; total: number } | null>(null);
  // The AI notice, shown under the button before the first chapter goes to the AI.
  const [asking, setAsking] = useState(false);

  async function download() {
    setBusy(true);
    setFailed(false);
    setChoosing(false);
    try {
      // The free PDF prints no AI reading, so none is written for it.
      const chapters = reading && !free
        ? await reading((done, total) => setWriting(done < total ? { done, total } : null))
        : [];
      setWriting(null);
      const body = chapters.length ? { ...request, reading: chapters } : request;
      saveFile(await fetchReport(body), reportFileName(request));
    } catch {
      setFailed(true);
    } finally {
      setWriting(null);
      setBusy(false);
    }
  }

  const label =
    writing && t.writingReading
      ? fill(t.writingReading, { done: writing.done, total: writing.total })
      : busy
        ? t.preparing
        : free && paidText
          ? paidText.pdfFree
          : t.download;

  return (
    <div className={`${styles.wrap} ${className}`}>
      <button
        type="button"
        className={`btn ${free ? "btn-outline" : "btn-primary"} lift ${styles.button}`}
        onClick={() => (free ? setChoosing(!choosing) : aiNotice ? setAsking(true) : download())}
        disabled={busy}
        aria-busy={busy}
        aria-expanded={free ? choosing : undefined}
        aria-controls={free ? choiceId : undefined}
        data-pdf={free ? "free" : "full"}
      >
        <Download />
        <span aria-live="polite">{label}</span>
      </button>
      {free && choosing && paidText && (
        <div id={choiceId} className={styles.choice} role="group" aria-label={paidText.pdfChoiceTitle} data-pdf-choice>
          <p className={styles.choiceTitle}>{paidText.pdfChoiceTitle}</p>
          <div className={styles.option}>
            <button type="button" className="btn btn-outline lift" onClick={() => void download()}>
              <Download />
              {paidText.pdfChoiceFree}
            </button>
            <p className={styles.note}>{paidText.pdfChoiceFreeNote}</p>
          </div>
          <div className={styles.option}>
            <BuyButton label={paidText.pdfChoiceFull} className="btn btn-primary lift" />
            <p className={styles.note}>{paidText.pdfChoiceFullNote}</p>
          </div>
        </div>
      )}
      {asking && aiNotice && (
        <AiNotice
          onAccept={() => {
            setAsking(false);
            void download();
          }}
        />
      )}
      {failed && (
        <p role="alert" className={styles.error}>
          {t.downloadFailed}
        </p>
      )}
    </div>
  );
}
