import { HttpAgent } from "@ag-ui/client";
import { CopilotRuntime, createCopilotRuntimeHandler } from "@copilotkit/runtime/v2";

/**
 * The chat's server side: CopilotKit's runtime, passing each run to the agent service over
 * AG-UI (docs/14, section 8). The chat is on only when AGENT_URL is set.
 *
 * A fixed route in single-endpoint mode, on purpose: next.config.ts rewrites /api/* to the
 * backend before dynamic routes are matched, so a catch-all route here would never be reached.
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
    // default. Pass none: proxy.ts puts the backend's access key on every /api call, and the
    // agent needs only its own key, set above.
    forwardHeaders: { deny: ["authorization"], denyPrefixes: ["x-"] },
  });
  return createCopilotRuntimeHandler({ runtime, basePath: "/api/copilotkit", mode: "single-route" });
}

const agentUrl = process.env.AGENT_URL;
const handler = agentUrl ? createHandler(agentUrl) : null;

export async function POST(request: Request): Promise<Response> {
  if (!handler) return new Response("The assistant is off.", { status: 404 });
  return handler(request);
}
