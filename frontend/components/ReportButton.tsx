"use client";

import { useState } from "react";

import { Download } from "@/components/Icons";
import {
  type ReportRequest,
  fetchReport,
  reportFileName,
  saveFile,
} from "@/lib/report";

import styles from "./ReportButton.module.css";

type Props = {
  request: ReportRequest;
  /** The AI chapters already read on the page, added to the PDF as its AI reading (docs/17). */
  reading?: () => { title: string; text: string }[];
  t: { download: string; preparing: string; downloadFailed: string };
  className?: string;
};

/** Downloads the PDF report of the result on the page. */
export function ReportButton({ request, reading, t, className = "" }: Props) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function download() {
    setBusy(true);
    setFailed(false);
    try {
      const chapters = reading?.() ?? [];
      const body = chapters.length ? { ...request, reading: chapters } : request;
      saveFile(await fetchReport(body), reportFileName(request));
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`${styles.wrap} ${className}`}>
      <button
        type="button"
        className={`btn btn-primary lift ${styles.button}`}
        onClick={download}
        disabled={busy}
        aria-busy={busy}
      >
        <Download />
        {busy ? t.preparing : t.download}
      </button>
      {failed && (
        <p role="alert" className={styles.error}>
          {t.downloadFailed}
        </p>
      )}
    </div>
  );
}
