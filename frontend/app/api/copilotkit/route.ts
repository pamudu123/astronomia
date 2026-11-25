import { HttpAgent } from "@ag-ui/client";
import { CopilotRuntime, createCopilotRuntimeHandler } from "@copilotkit/runtime/v2";

import {
  TURN_HEADER,
  addressOf,
  askBackend,
  browserCookie,
  browserOf,
  chatKey,
  readRun,
  turnCookie,
  turnOf,
} from "@/lib/chatLimits";

/**
 * The chat's server side: CopilotKit's runtime, passing each run to the agent service over
 * AG-UI (docs/14, section 8). The chat is on only when AGENT_URL is set.
 *
 * A fixed route in single-endpoint mode, on purpose: next.config.ts rewrites /api/* to the
 * backend before dynamic routes are matched, so a catch-all route here would never be reached.
 *
 * Chat limits (docs/21): before a question goes to the agent, the backend is asked whether this
 * browser or account may ask it (lib/chatLimits.ts). A refusal comes back as JSON with the
 * reason and a date, and nothing reaches the agent. An allowed question goes on with its id,
 * which the agent takes up with the backend once and then reports the cost against. The
 * follow-up buttons go with the same id, kept in a short cookie.
 */

// No usage reports from the CopilotKit runtime (privacy, docs/14 section 11).
process.env.COPILOTKIT_TELEMETRY_DISABLED ??= "true";

// An answer streams for a few seconds, but an agent on a free host may first need to wake up.
// 60 seconds is the most every Vercel plan allows.
export const maxDuration = 60;

// The agents' names, shared with components/assistant/Chat.tsx: the guide answers; the
// suggester writes the follow-up questions shown under each answer (agent/app/suggest.py).
const AGENT_ID = "guide";
const SUGGEST_ID = "suggest";
// A run carries the conversation and the page's summary; the agent refuses more than 512 KB.
const MAX_BODY = 500_000;

function createHandler(agentUrl: string) {
  // Staging uses the backend's key for the agent too (render.yaml). AGENT_ACCESS_KEY is for
  // an agent with a key of its own.
  const accessKey = process.env.AGENT_ACCESS_KEY || process.env.BACKEND_ACCESS_KEY;
  const headers: Record<string, string> = accessKey ? { "X-Access-Key": accessKey } : {};
  const runtime = new CopilotRuntime({
    agents: {
      [AGENT_ID]: new HttpAgent({ url: agentUrl, headers }),
      // The agent service serves the suggester beside the guide, at /agent/suggest.
      [SUGGEST_ID]: new HttpAgent({ url: `${agentUrl.replace(/\/+$/, "")}/suggest`, headers }),
    },
    // CopilotKit passes the browser's `authorization` and `x-*` headers on to the agent by
    // default. Pass only the question id, which this route sets itself: proxy.ts puts the
    // backend's access key and the sign in on every /api call, and the agent needs neither.
    forwardHeaders: { allow: [TURN_HEADER] },
  });
  return createCopilotRuntimeHandler({ runtime, basePath: "/api/copilotkit", mode: "single-route" });
}

const agentUrl = process.env.AGENT_URL;
const handler = agentUrl ? createHandler(agentUrl) : null;

function json(body: string, status: number): Response {
  return new Response(body, { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
}

export async function POST(request: Request): Promise<Response> {
  if (!handler) return new Response("The assistant is off.", { status: 404 });

  const raw = await request.text();
  if (raw.length > MAX_BODY) return json(JSON.stringify({ detail: "too large" }), 413);
  const headers = new Headers(request.headers);
  headers.delete(TURN_HEADER); // only this route names the question
  const cookies: string[] = [];

  if (chatKey()) {
    const call = readRun(raw);
    const browser = browserOf(request);
    if (call?.method === "agent/run" && call.agentId === AGENT_ID) {
      let asked: Response;
      try {
        asked = await askBackend("/v1/chat/turns", request, {
          browser: browser.id,
          address: addressOf(request),
          length: call.longest,
        });
      } catch {
        return json(JSON.stringify({ detail: "chat limits unavailable" }), 502);
      }
      if (asked.status === 413 || asked.status === 429) {
        const refused = json(await asked.text(), asked.status);
        if (browser.fresh) refused.headers.append("Set-Cookie", browserCookie(browser.id));
        return refused;
      }
      if (!asked.ok) return json(JSON.stringify({ detail: "chat limits unavailable" }), 502);
      const { turn } = (await asked.json()) as { turn: string };
      headers.set(TURN_HEADER, turn);
      cookies.push(turnCookie(turn));
    } else if (call?.method === "agent/suggest" || (call?.method === "agent/run" && call.agentId === SUGGEST_ID)) {
      // In single-route mode CopilotKit asks for the buttons as a run of the suggester.
      const turn = turnOf(request);
      if (turn) headers.set(TURN_HEADER, turn);
    }
    if (browser.fresh) cookies.push(browserCookie(browser.id));
  }

  const forwarded = new Request(request.url, { method: "POST", headers, body: raw, signal: request.signal });
  const response = await handler(forwarded);
  if (!cookies.length) return response;
  const withCookies = new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: new Headers(response.headers),
  });
  for (const value of cookies) withCookies.headers.append("Set-Cookie", value);
  return withCookies;
}
