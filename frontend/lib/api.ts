import type { paths } from "./api-types";
import { backendHeaders } from "./staging";

/**
 * Calls to the backend go through /api, which next.config forwards to the FastAPI app.
 * On the server, the backend is called directly.
 */
const base =
  typeof window === "undefined" ? (process.env.BACKEND_URL ?? "http://localhost:8000") : "/api";

export type Meta =
  paths["/v1/meta"]["get"]["responses"]["200"]["content"]["application/json"];

export async function getMeta(): Promise<Meta> {
  const response = await fetch(`${base}/v1/meta`, {
    headers: typeof window === "undefined" ? backendHeaders() : {},
  });
  if (!response.ok) throw new Error(`meta request failed: ${response.status}`);
  return (await response.json()) as Meta;
}
