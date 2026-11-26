/**
 * The AI name search on the baby names page (agent/app/names.py). On only when AGENT_URL is set,
 * like the chat. A fixed route, like app/api/explain: next.config.ts rewrites the rest of /api/*
 * to the backend.
 *
 * Only the letters, gender, length and the names already listed go to the agent: never a birth
 * date or anything else about the child (docs/09).
 */

// A free host may first need to wake the agent up.
export const maxDuration = 60;

// 16 letters and 200 names of up to 40 letters each, with room to spare.
const MAX_BODY = 30_000;
const GENDERS = new Set(["any", "boy", "girl"]);
const LENGTHS = new Set(["any", "short", "medium", "long"]);

function bad(message: string, status = 400): Response {
  return new Response(message, { status, headers: { "Content-Type": "text/plain" } });
}

const strings = (value: unknown, most: number, longest: number): value is string[] =>
  Array.isArray(value) &&
  value.length <= most &&
  value.every((item) => typeof item === "string" && item.length > 0 && item.length <= longest);

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
  const { letters, gender, length, already_shown: shown = [] } = (body ?? {}) as Record<string, unknown>;
  if (
    !strings(letters, 16, 4) ||
    letters.length === 0 ||
    !GENDERS.has(String(gender)) ||
    !LENGTHS.has(String(length)) ||
    !strings(shown, 200, 40)
  ) {
    return bad("Needs letters, gender and length.");
  }

  // Staging uses the backend's key for the agent too, as the chat route does.
  const accessKey = process.env.AGENT_ACCESS_KEY || process.env.BACKEND_ACCESS_KEY;
  let upstream: Response;
  try {
    upstream = await fetch(`${agentUrl.replace(/\/+$/, "")}/names`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(accessKey ? { "X-Access-Key": accessKey } : {}) },
      // Only these fields, so nothing else from the browser reaches the agent.
      body: JSON.stringify({ letters, gender, length, already_shown: shown }),
      signal: request.signal,
    });
  } catch {
    return bad("The assistant is not answering.", 502);
  }
  if (!upstream.ok) return bad("The assistant could not find names.", 502);
  return new Response(await upstream.text(), {
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}
