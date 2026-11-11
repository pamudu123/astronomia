import { NextResponse, type NextRequest } from "next/server";

import { hasLocale, pickLocale } from "@/lib/i18n";

/** Every page lives under /si or /en. Anything else is sent to the visitor's language. */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const first = pathname.split("/")[1] ?? "";
  if (hasLocale(first)) return;

  const locale = pickLocale(request.headers.get("accept-language"));
  request.nextUrl.pathname = `/${locale}${pathname === "/" ? "" : pathname}`;
  return NextResponse.redirect(request.nextUrl);
}

export const config = {
  // Skip Next.js internals, the API, images and any file with an extension.
  matcher: ["/((?!_next|api|images|.*\\..*).*)"],
};
