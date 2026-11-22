import { NextResponse, type NextRequest } from "next/server";

import { forwardedHeaders } from "@/lib/forward";
import { hasLocale, pickLocale } from "@/lib/i18n";
import { stagingAllowed } from "@/lib/staging";

const NOINDEX = "noindex, nofollow";

/** A share page (/en/s/<code>): the code in its address must stay private. */
const SHARE_PAGE = /^\/(?:en|si)\/s\/[^/]+\/?$/;

/**
 * Share pages are not indexed, not kept by a shared cache or CDN, and never send their address
 * (with the code) to another site as a referrer.
 */
const SHARE_HEADERS: Record<string, string> = {
  "X-Robots-Tag": NOINDEX,
  "Cache-Control": "private, no-store, max-age=0",
  "Referrer-Policy": "no-referrer",
};

/**
 * 1. On a private staging site, ask for the staging password first.
 * 2. Calls to /api go on to the backend, with the visitor's sign in and the backend's access key.
 * 3. Every page lives under /si or /en. Anything else is sent to the visitor's language.
 * 4. Share pages get private headers (SHARE_HEADERS).
 */
export function proxy(request: NextRequest) {
  const password = process.env.STAGING_PASSWORD;
  if (password && !stagingAllowed(request.headers.get("authorization"), password)) {
    return new NextResponse("This is a private staging site.", {
      status: 401,
      headers: {
        "WWW-Authenticate": 'Basic realm="Astronomia staging", charset="UTF-8"',
        "X-Robots-Tag": NOINDEX,
      },
    });
  }

  const { pathname } = request.nextUrl;
  if (pathname.startsWith("/api/")) {
    return NextResponse.next({ request: { headers: forwardedHeaders(request.headers) } });
  }

  const first = pathname.split("/")[1] ?? "";
  if (SHARE_PAGE.test(pathname)) {
    const response = NextResponse.next();
    for (const [name, value] of Object.entries(SHARE_HEADERS)) response.headers.set(name, value);
    return response;
  }
  if (hasLocale(first)) {
    if (!password) return;
    const response = NextResponse.next();
    response.headers.set("X-Robots-Tag", NOINDEX);
    return response;
  }

  const locale = pickLocale(request.headers.get("accept-language"));
  request.nextUrl.pathname = `/${locale}${pathname === "/" ? "" : pathname}`;
  return NextResponse.redirect(request.nextUrl);
}

export const config = {
  // Skip Next.js internals, images and any file with an extension. The API is included,
  // so the staging gate and the backend key cover it too.
  matcher: ["/((?!_next|images|.*\\..*).*)"],
};
