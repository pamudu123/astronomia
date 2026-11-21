/** What the site's /api forward (proxy.ts) sends on to the backend. */

// A JWT: three base64url parts. Anything else is not passed on.
const TOKEN = /^[\w-]+\.[\w-]+\.[\w-]+$/;

/**
 * The headers a call to /api goes on to the backend with. The staging password stays here. The
 * visitor's Supabase access token, sent by the page in X-Sidera-Token (lib/account.ts), goes on
 * as `Authorization: Bearer`, which the backend checks. The backend's access key is added.
 */
export function forwardedHeaders(incoming: Headers): Headers {
  const headers = new Headers(incoming);
  const token = headers.get("x-sidera-token")?.trim() ?? "";
  headers.delete("authorization");
  headers.delete("x-sidera-token");
  if (token.length <= 8192 && TOKEN.test(token)) headers.set("authorization", `Bearer ${token}`);
  const key = process.env.BACKEND_ACCESS_KEY;
  if (key) headers.set("X-Access-Key", key);
  return headers;
}
