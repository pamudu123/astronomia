import type { BrowserContext, Page, Request } from "@playwright/test";

/**
 * A stand-in Supabase Auth for the browser tests. The test build points the site at this
 * address (NEXT_PUBLIC_SUPABASE_URL in .github/workflows/frontend.yml), and Playwright answers
 * its calls, so no test ever reaches a real Supabase project.
 */
export const SUPABASE = "https://supabase.e2e.test";

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "GET, POST, PUT, DELETE, OPTIONS",
};

function base64url(value: object): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

/** A token shaped like Supabase's: the site only passes it on, so it need not be signed. */
export function fakeToken(userId: string, anonymous = true): string {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const claims = { sub: userId, aud: "authenticated", role: "authenticated", is_anonymous: anonymous, exp };
  return `${base64url({ alg: "ES256", typ: "JWT", kid: "e2e" })}.${base64url(claims)}.c2lnbmF0dXJl`;
}

function session(userId: string, anonymous: boolean, email?: string) {
  const now = Math.floor(Date.now() / 1000);
  return {
    access_token: fakeToken(userId, anonymous),
    token_type: "bearer",
    expires_in: 3600,
    expires_at: now + 3600,
    refresh_token: `refresh-${userId}`,
    user: {
      id: userId,
      aud: "authenticated",
      role: "authenticated",
      is_anonymous: anonymous,
      email: email ?? "",
      app_metadata: anonymous ? {} : { provider: "google", providers: ["google"] },
      user_metadata: {},
      identities: [],
      created_at: new Date().toISOString(),
    },
  };
}

export type StandIn = {
  /** Every call the site made to Supabase Auth, as "METHOD /path". */
  calls: string[];
  /** How many anonymous sign ins Supabase was asked for. */
  guests: () => number;
};

export const GOOGLE_USER = "00000000-0000-4000-8000-0000000000aa";
export const GOOGLE_EMAIL = "nimali@example.com";

/**
 * Answers Supabase Auth's calls for one page or a whole browser context. With `google:
 * "return"`, Google's page sends the browser straight back to the site with a code, which
 * signs in as GOOGLE_USER.
 */
export async function standInSupabase(
  target: Page | BrowserContext,
  { google = "stay" }: { google?: "stay" | "return" } = {},
): Promise<StandIn> {
  const calls: string[] = [];
  let guests = 0;
  await target.route(`${SUPABASE}/**`, async (route) => {
    const request: Request = route.request();
    const url = new URL(request.url());
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
    calls.push(`${request.method()} ${url.pathname}`);
    const json = (status: number, body: unknown) =>
      route.fulfill({ status, headers: CORS, contentType: "application/json", body: JSON.stringify(body) });
    if (url.pathname === "/auth/v1/signup") {
      guests += 1;
      return json(200, session(`00000000-0000-4000-8000-00000000000${guests}`, true));
    }
    if (url.pathname === "/auth/v1/logout") return route.fulfill({ status: 204, headers: CORS });
    if (url.pathname === "/auth/v1/token") {
      const grant = url.searchParams.get("grant_type");
      if (grant === "pkce") return json(200, session(GOOGLE_USER, false, GOOGLE_EMAIL));
      const body = (request.postDataJSON() ?? {}) as { refresh_token?: string };
      const userId = (body.refresh_token ?? "").replace(/^refresh-/, "");
      return json(200, session(userId, userId !== GOOGLE_USER));
    }
    if (url.pathname === "/auth/v1/authorize" && google === "return") {
      const back = new URL(url.searchParams.get("redirect_to") ?? "/");
      back.searchParams.set("code", "e2e-code");
      return route.fulfill({ status: 302, headers: { location: back.toString() } });
    }
    if (url.pathname === "/auth/v1/user/identities/authorize") {
      // Linking Google: Supabase answers with Google's address. Here, a page of the stand-in.
      return json(200, { url: `${SUPABASE}/google?${url.searchParams}` });
    }
    if (url.pathname === "/auth/v1/authorize" || url.pathname === "/google") {
      return route.fulfill({ status: 200, contentType: "text/html", body: "<p>Google</p>" });
    }
    return json(404, { error: "not_found" });
  });
  return { calls, guests: () => guests };
}
