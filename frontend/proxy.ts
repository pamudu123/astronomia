import { NextResponse, type NextRequest } from "next/server";

import { hasLocale, pickLocale } from "@/lib/i18n";
import { stagingAllowed } from "@/lib/staging";

const NOINDEX = "noindex, nofollow";

/**
 * 1. On a private staging site, ask for the staging password first.
 * 2. Calls to /api go on to the backend, with its access key when it needs one.
 * 3. Every page lives under /si or /en. Anything else is sent to the visitor's language.
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
    const headers = new Headers(request.headers);
    headers.delete("authorization"); // the staging password stays here
    const key = process.env.BACKEND_ACCESS_KEY;
    if (key) headers.set("X-Access-Key", key);
    return NextResponse.next({ request: { headers } });
  }

  const first = pathname.split("/")[1] ?? "";
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
