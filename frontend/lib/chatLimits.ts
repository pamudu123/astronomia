import "server-only";

import { backendHeaders } from "./staging";

/**
 * The chat limits on the website's server (docs/21). The backend keeps the rules and counts;
 * the AI service refuses any run the backend did not allow. This side names the asker:
 *
 * - the browser, by a random id in an httpOnly cookie made here (clearing it gives a new one:
 *   accepted for 2 free questions a week, docs/18);
 * - the network address, as Vercel reports it (the backend keeps only a keyed hash of it);
 * - the account, by the sign in token the site's /api forward turned into `Authorization`.
 *
 * Only this server holds CHAT_KEY, so only it can ask the backend for a question. Without
 * CHAT_KEY (local runs) the chat runs without limits, as before.
 */

const BACKEND = process.env.BACKEND_URL ?? "http://localhost:8000";

export const BROWSER_COOKIE = "sidera_chat";
export const TURN_COOKIE = "sidera_chat_turn";
/** How the question id travels from this server to the AI service. */
export const TURN_HEADER = "x-sidera-turn";
const ID = /^[A-Za-z0-9-]{8,64}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const YEAR = 365 * 24 * 3600;
// The follow-up buttons are written right after the answer (backend: 30 minutes).
const TURN_SECONDS = 30 * 60;

export function chatKey(): string {
  return process.env.CHAT_KEY ?? "";
}

export function readCookie(request: Request, name: string): string | null {
  for (const part of (request.headers.get("cookie") ?? "").split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return decodeURIComponent(value.join("="));
  }
  return null;
}

/** This browser's chat id, and whether it was just made (and needs its cookie set). */
export function browserOf(request: Request): { id: string; fresh: boolean } {
  const found = readCookie(request, BROWSER_COOKIE);
  if (found && ID.test(found)) return { id: found, fresh: false };
  return { id: crypto.randomUUID(), fresh: true };
}

/** The visitor's address. On Vercel both headers are set by Vercel itself, not the browser. */
export function addressOf(request: Request): string {
  const real = request.headers.get("x-real-ip")?.trim();
  if (real) return real.slice(0, 100);
  return (request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim().slice(0, 100);
}

/** The question id kept for the follow-up buttons, if it looks like one. */
export function turnOf(request: Request): string | null {
  const turn = readCookie(request, TURN_COOKIE);
  return turn && UUID.test(turn) ? turn : null;
}

export function cookie(name: string, value: string, maxAge: number, path = "/"): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${name}=${encodeURIComponent(value)}; Max-Age=${maxAge}; Path=${path}; HttpOnly; SameSite=Lax${secure}`;
}

export const browserCookie = (id: string) => cookie(BROWSER_COOKIE, id, YEAR);
export const turnCookie = (turn: string) => cookie(TURN_COOKIE, turn, TURN_SECONDS, "/api/copilotkit");

/** A call to the backend's chat endpoints, with the chat key and the visitor's sign in. */
export function askBackend(
  path: "/v1/chat/status" | "/v1/chat/turns",
  request: Request,
  body: Record<string, unknown>,
  send: typeof fetch = fetch,
): Promise<Response> {
  const authorization = request.headers.get("authorization") ?? "";
  return send(`${BACKEND}${path}`, {
    method: "POST",
    headers: {
      ...backendHeaders(),
      "Content-Type": "application/json",
      "X-Chat-Key": chatKey(),
      ...(authorization.startsWith("Bearer ") ? { authorization } : {}),
    },
    body: JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
}

type Content = string | { type?: string; text?: string }[] | undefined;

function textOf(content: Content): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.map((part) => (typeof part?.text === "string" ? part.text : "")).join("");
  return "";
}

export type RunCall = { method: string; agentId: string | null; longest: number };

/**
 * What a CopilotKit single-route call is: its method ("agent/run", "agent/suggest", ...), the
 * agent, and the longest message the person wrote in it (code points, as the backend counts).
 */
export function readRun(raw: string): RunCall | null {
  let envelope: unknown;
  try {
    envelope = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!envelope || typeof envelope !== "object") return null;
  const { method, params, body } = envelope as { method?: unknown; params?: { agentId?: unknown }; body?: unknown };
  if (typeof method !== "string") return null;
  const agentId = typeof params?.agentId === "string" ? params.agentId : null;
  const messages = (body as { messages?: unknown } | undefined)?.messages;
  let longest = 0;
  if (Array.isArray(messages)) {
    for (const message of messages as { role?: unknown; content?: Content }[]) {
      if (message?.role === "user") longest = Math.max(longest, Array.from(textOf(message.content)).length);
    }
  }
  return { method, agentId, longest };
}
