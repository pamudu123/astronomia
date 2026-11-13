import "server-only";

import { backendHeaders } from "./staging";

const BACKEND = process.env.BACKEND_URL ?? "http://localhost:8000";

/**
 * A GET to the backend from the server, so the answer is in the page a search engine reads.
 * Null when the backend is away: the browser then asks for it itself.
 */
export async function backendJson<T>(path: string): Promise<T | null> {
  try {
    const response = await fetch(`${BACKEND}${path}`, {
      cache: "no-store",
      headers: backendHeaders(),
      signal: AbortSignal.timeout(5000),
    });
    return response.ok ? ((await response.json()) as T) : null;
  } catch {
    return null;
  }
}
