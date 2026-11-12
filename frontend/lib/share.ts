import type { components } from "./api-types";
import type { Locale } from "./i18n";
import type { ReportRequest } from "./report";

/** The same body as the PDF report. The dialog adds the "hide names" choice. */
export type ShareRequest = ReportRequest;
export type ShareCreated = components["schemas"]["ShareCreated"];
export type Shared = components["schemas"]["ShareOut"];

function failed(response: Response): Error & { status: number } {
  const error = new Error(`share request failed: ${response.status}`) as Error & { status: number };
  error.status = response.status;
  return error;
}

/** Birth details go in the POST body. The link holds only a random code. */
export async function createShare(
  body: ShareRequest & { hide_names: boolean },
): Promise<ShareCreated> {
  const response = await fetch("/api/v1/shares", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw failed(response);
  const created = (await response.json()) as ShareCreated;
  rememberDeleteToken(created.code, created.delete_token);
  return created;
}

export async function fetchShare(code: string, lang: Locale): Promise<Shared> {
  const response = await fetch(`/api/v1/shares/${encodeURIComponent(code)}?lang=${lang}`);
  if (!response.ok) throw failed(response);
  return (await response.json()) as Shared;
}

export async function deleteShare(code: string, token: string): Promise<void> {
  const response = await fetch(`/api/v1/shares/${encodeURIComponent(code)}`, {
    method: "DELETE",
    headers: { "X-Delete-Token": token },
  });
  // Already gone counts as deleted.
  if (!response.ok && response.status !== 404) throw failed(response);
  forgetDeleteToken(code);
}

export function shareUrl(origin: string, lang: Locale, code: string): string {
  return `${origin}/${lang}/s/${code}`;
}

export function whatsappHref(text: string, url: string): string {
  return `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`;
}

// The delete token stays on the device that made the link: it is the only way to delete it.
// It holds no birth details. Storage can be unavailable (private mode), so every access is guarded.
const tokenKey = (code: string) => `astronomia.share.${code}`;

function rememberDeleteToken(code: string, token: string): void {
  try {
    localStorage.setItem(tokenKey(code), token);
  } catch {
    // Without storage the link still works. It just cannot be deleted from a later visit.
  }
}

export function deleteTokenFor(code: string): string | null {
  try {
    return localStorage.getItem(tokenKey(code));
  } catch {
    return null;
  }
}

function forgetDeleteToken(code: string): void {
  try {
    localStorage.removeItem(tokenKey(code));
  } catch {
    // Nothing to forget.
  }
}
