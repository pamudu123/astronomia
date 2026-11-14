/**
 * Why a call to the backend failed, so a page can say something useful instead of one
 * generic "please try again" (QA report AST-02 to AST-04).
 */

/** Long enough for a sleeping free-tier backend to wake and answer a long search. */
export const SEARCH_TIMEOUT_MS = 90_000;

export class RequestError extends Error {
  constructor(
    readonly status: number,
    readonly detail: string | null,
  ) {
    super(`request failed: ${status}${detail ? ` (${detail})` : ""}`);
    this.name = "RequestError";
  }
}

/** Throws a RequestError carrying the backend's own reason when the answer is not 2xx. */
export async function ensureOk(response: Response): Promise<Response> {
  if (response.ok) return response;
  let detail: string | null = null;
  try {
    const body = (await response.json()) as { detail?: unknown };
    if (typeof body.detail === "string") detail = body.detail;
  } catch {
    // not JSON: a proxy or platform error page
  }
  throw new RequestError(response.status, detail);
}

/**
 * - unavailable: the service did not answer, timed out, or is missing the route (an old deploy)
 * - place: the chosen place is not known to the backend
 * - invalid: the backend refused the details as given
 * - failed: anything else
 */
export type Failure = "unavailable" | "place" | "invalid" | "failed";

export function failureOf(caught: unknown): Failure {
  if (caught instanceof RequestError) {
    if (caught.status === 404) return caught.detail === "unknown place" ? "place" : "unavailable";
    if (caught.status === 400 || caught.status === 422) return "invalid";
    // 401 is the access key between the frontend and backend, not the visitor's fault.
    if (caught.status === 401 || caught.status === 408 || caught.status >= 502) return "unavailable";
    return "failed";
  }
  // fetch rejects with a TypeError when the network fails, and a DOMException on timeout.
  if (caught instanceof TypeError) return "unavailable";
  if (caught instanceof DOMException && (caught.name === "TimeoutError" || caught.name === "AbortError")) {
    return "unavailable";
  }
  return "failed";
}

/** The message for a failure, from a block of text that has one for each kind. */
export function failureText(
  caught: unknown,
  t: { failed: string; unavailable: string; invalid: string; place: string },
): string {
  return t[failureOf(caught)];
}
