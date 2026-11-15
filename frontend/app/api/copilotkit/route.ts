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

// The agent's name, shared with components/assistant/Assistant.tsx.
const AGENT_ID = "guide";

function createHandler(agentUrl: string) {
  const accessKey = process.env.AGENT_ACCESS_KEY;
  const runtime = new CopilotRuntime({
    agents: {
      [AGENT_ID]: new HttpAgent({
        url: agentUrl,
        headers: accessKey ? { "X-Access-Key": accessKey } : {},
      }),
    },
  });
  return createCopilotRuntimeHandler({ runtime, basePath: "/api/copilotkit", mode: "single-route" });
}

const agentUrl = process.env.AGENT_URL;
const handler = agentUrl ? createHandler(agentUrl) : null;

export async function POST(request: Request): Promise<Response> {
  if (!handler) return new Response("The assistant is off.", { status: 404 });
  return handler(request);
}
