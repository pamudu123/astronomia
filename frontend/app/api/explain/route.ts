/**
 * One chapter of a full reading, or an explain button's text (docs/17), written by the agent
 * service and streamed back as plain text. On only when AGENT_URL is set, like the chat.
 *
 * A fixed route, like app/api/copilotkit: next.config.ts rewrites /api/* to the backend
 * before dynamic routes are matched.
 */

// A chapter takes a few seconds; an agent on a free host may first need to wake up.
export const maxDuration = 60;

// A full match result as the page sends it is about 6 KB.
const MAX_BODY = 50_000;
const LANGUAGES = new Set(["en", "si"]);

function bad(message: string, status = 400): Response {
  return new Response(message, { status, headers: { "Content-Type": "text/plain" } });
}

export async function POST(request: Request): Promise<Response> {
  const agentUrl = process.env.AGENT_URL;
  if (!agentUrl) return bad("The assistant is off.", 404);

  const raw = await request.text();
  if (raw.length > MAX_BODY) return bad("Too large.", 413);
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return bad("Not JSON.");
  }
  const { id, language, facts } = (body ?? {}) as Record<string, unknown>;
  if (typeof id !== "string" || !LANGUAGES.has(String(language)) || !facts || typeof facts !== "object") {
    return bad("Needs id, language and facts.");
  }

  // Staging uses the backend's key for the agent too, as the chat route does.
  const accessKey = process.env.AGENT_ACCESS_KEY || process.env.BACKEND_ACCESS_KEY;
  let upstream: Response;
  try {
    upstream = await fetch(`${agentUrl.replace(/\/+$/, "")}/explain`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(accessKey ? { "X-Access-Key": accessKey } : {}) },
      // Only the three fields, so nothing else from the browser reaches the agent.
      body: JSON.stringify({ id, language, facts }),
      signal: request.signal,
    });
  } catch {
    return bad("The assistant is not answering.", 502);
  }
  if (!upstream.ok || !upstream.body) return bad("The assistant could not write this.", 502);
  return new Response(upstream.body, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}
