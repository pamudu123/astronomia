/**
 * The private staging gate. When STAGING_PASSWORD is set, every page and API call needs it
 * (HTTP Basic auth: any user name, that password). Not set, as in local runs, means open.
 */

function sameText(a: string, b: string): boolean {
  // Compare every character, so the time taken does not hint at how much matched.
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

/** True when the Authorization header carries the staging password. */
export function stagingAllowed(authorization: string | null, password: string): boolean {
  if (!authorization?.startsWith("Basic ")) return false;
  let decoded: string;
  try {
    decoded = atob(authorization.slice(6).trim());
  } catch {
    return false;
  }
  const colon = decoded.indexOf(":");
  return colon >= 0 && sameText(decoded.slice(colon + 1), password);
}

/** Headers for server-side calls to the backend: the access key, when the backend needs one. */
export function backendHeaders(): Record<string, string> {
  const key = process.env.BACKEND_ACCESS_KEY;
  return key ? { "X-Access-Key": key } : {};
}
