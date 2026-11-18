import type { components } from "./api-types";

export type ReportRequest =
  | components["schemas"]["HadahanReport"]
  | components["schemas"]["PorondamReport"];

/** What the PDF takes: a report request, plus the AI chapters already read (docs/17). */
export type PdfRequest = components["schemas"]["HadahanPdf"] | components["schemas"]["PorondamPdf"];

/** The server works the report out again from these details, sent in a POST body. */
export async function fetchReport(body: PdfRequest | ReportRequest): Promise<Blob> {
  const response = await fetch("/api/v1/reports/pdf", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const error = new Error(`report failed: ${response.status}`) as Error & {
      status: number;
    };
    error.status = response.status;
    throw error;
  }
  return response.blob();
}

/** Hands a file to the browser's download, without putting anything in the page address. */
export function saveFile(file: Blob, fileName: string): void {
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.rel = "noopener";
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function reportFileName(body: ReportRequest): string {
  return `sidera-${body.kind}.pdf`;
}
