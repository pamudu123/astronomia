// The site with the AI switched on, for the browser tests in tests/e2e/ai.spec.ts.
//
// Whether the AI is on is decided when the pages are built (AGENT_URL, read by the layout), so
// these tests need a build of their own. It goes to .next-ai, beside the normal .next, so the
// other browser tests keep running with the AI off. The agent address points nowhere: the tests
// answer /api/explain themselves, in the browser.
//
// Usage: node scripts/e2e-ai-server.mjs <port>. Builds once if .next-ai is missing (CI builds it
// in its own step first), then starts the server.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const port = process.argv[2] ?? "3101";
const env = {
  ...process.env,
  NEXT_DIST_DIR: ".next-ai",
  AGENT_URL: "http://127.0.0.1:9/agent",
  // The stand-in Supabase (tests/e2e/supabase.ts): unlocking a report signs in as a guest.
  NEXT_PUBLIC_SUPABASE_URL: "https://supabase.e2e.test",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_e2e",
};
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const run = (args) => {
  const result = spawnSync(npm, args, { cwd: root, env, stdio: "inherit", shell: process.platform === "win32" });
  if (result.status !== 0) process.exit(result.status ?? 1);
};

if (!existsSync(join(root, ".next-ai", "BUILD_ID"))) run(["run", "build"]);
run(["run", "start", "--", "--port", port]);
