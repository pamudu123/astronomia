/**
 * What is left of the Astro chat for this browser and account, in plain numbers (docs/21).
 * 204 when the chat runs without limits (no CHAT_KEY, as in local runs).
 *
 * A fixed route, like app/api/copilotkit: next.config.ts rewrites /api/* to the backend before
 * dynamic routes are matched.
 */
import { addressOf, askBackend, browserOf, chatKey } from "@/lib/chatLimits";

export async function GET(request: Request): Promise<Response> {
  if (!chatKey()) return new Response(null, { status: 204 });
  // A browser without the cookie has asked nothing yet: its id does not matter until it asks.
  const { id } = browserOf(request);
  let upstream: Response;
  try {
    upstream = await askBackend("/v1/chat/status", request, { browser: id, address: addressOf(request) });
  } catch {
    return new Response("The chat limits are not answering.", { status: 502 });
  }
  if (!upstream.ok) return new Response("The chat limits are not answering.", { status: 502 });
  return new Response(await upstream.text(), {
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}
