"use client";

import { useState } from "react";

import { Download } from "@/components/Icons";
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

/** Downloads the PDF report of the result on the page. */
export function ReportButton({ request, reading, aiNotice = false, t, className = "" }: Props) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  // While the reading is written: chapters ready of all.
  const [writing, setWriting] = useState<{ done: number; total: number } | null>(null);
  // The AI notice, shown under the button before the first chapter goes to the AI.
  const [asking, setAsking] = useState(false);

  async function download() {
    setBusy(true);
    setFailed(false);
    try {
      const chapters = reading
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
        : t.download;

  return (
    <div className={`${styles.wrap} ${className}`}>
      <button
        type="button"
        className={`btn btn-primary lift ${styles.button}`}
        onClick={() => (aiNotice ? setAsking(true) : download())}
        disabled={busy}
        aria-busy={busy}
      >
        <Download />
        <span aria-live="polite">{label}</span>
      </button>
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
