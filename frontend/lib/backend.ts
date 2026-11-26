import "server-only";

import { backendHeaders } from "./staging";

const BACKEND = process.env.BACKEND_URL ?? "http://localhost:8000";

/**
 * A GET to the backend from the server, so the answer is in the page a search engine reads.
 * Null when the backend is away: the browser then asks for it itself.
 *
 * With keepSeconds a good answer is kept that long and given at once, even while the backend
 * sleeps; an older one is still given while a new one is fetched. Only for answers that are the
 * same for everyone. Failures are never kept.
 */
export async function backendJson<T>(path: string, keepSeconds?: number): Promise<T | null> {
  try {
    const response = await fetch(`${BACKEND}${path}`, {
      ...(keepSeconds ? { next: { revalidate: keepSeconds } } : { cache: "no-store" as const }),
      headers: backendHeaders(),
      signal: AbortSignal.timeout(5000),
    });
    return response.ok ? ((await response.json()) as T) : null;
  } catch {
    return null;
  }
}
