import "server-only";

import { chatKey } from "./chatLimits";
import { isReportChapter } from "./entitlements";
import { backendHeaders } from "./staging";

/**
 * The AI chapters a paid report keeps (docs/17, section 6a; backend/app/api/chapters.py), on the
 * website's server: the AI route asks here before it has a chapter written, and keeps a chapter
 * once the AI has finished it. Only this server holds CHAT_KEY, so a visitor cannot put words of
 * their own into a report. Without CHAT_KEY (local runs) nothing is kept on the server.
 *
 * A report nobody paid for, and the other pages' chapters, keep nothing.
 */

const BACKEND = process.env.BACKEND_URL ?? "http://localhost:8000";

type Asked = { request: Request; id: string; language: string; report: unknown };

/** The call's headers, or null when there can be nothing kept: no report, or nobody signed in. */
function headersFor({ request, id, report }: Asked): Record<string, string> | null {
  const authorization = request.headers.get("authorization") ?? "";
  if (!isReportChapter(id) || !report || typeof report !== "object") return null;
  if (!authorization.startsWith("Bearer ")) return null;
  return { ...backendHeaders(), authorization, "Content-Type": "application/json" };
}

/**
 * The chapter this report already keeps, or null when it has none yet.
 * Throws when the backend cannot say: writing the chapter again then could change it.
 */
export async function keptChapter(asked: Asked, send: typeof fetch = fetch): Promise<string | null> {
  const headers = headersFor(asked);
  if (!headers) return null;
  const response = await send(`${BACKEND}/v1/reports/chapters`, {
    method: "POST",
    headers,
    body: JSON.stringify({ report: asked.report, language: asked.language }),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`kept chapters: ${response.status}`);
  const { chapters } = (await response.json()) as { chapters: Record<string, string> };
  return chapters[asked.id] ?? null;
}

/** Keeps a finished chapter. A report that was not paid for keeps nothing (402). */
export async function keepChapter(asked: Asked, text: string, send: typeof fetch = fetch): Promise<void> {
  const headers = headersFor(asked);
  const key = chatKey();
  if (!headers || !key || !text.trim()) return;
  try {
    const response = await send(`${BACKEND}/v1/reports/chapters/keep`, {
      method: "POST",
      headers: { ...headers, "X-Chat-Key": key },
      body: JSON.stringify({ report: asked.report, language: asked.language, id: asked.id, text }),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok && response.status !== 402) console.error(`keeping a chapter failed: ${response.status}`);
  } catch {
    console.error("keeping a chapter failed: the backend is not answering");
  }
}

/** Passes the AI's text on as it comes, and keeps it once it is complete (never half of it). */
export function keepingStream(asked: Asked, send: typeof fetch = fetch): TransformStream<Uint8Array, Uint8Array> {
  const decoder = new TextDecoder();
  let text = "";
  return new TransformStream({
    transform(chunk, controller) {
      text += decoder.decode(chunk, { stream: true });
      controller.enqueue(chunk);
    },
    async flush() {
      await keepChapter(asked, text + decoder.decode(), send);
    },
  });
}
