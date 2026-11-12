import type { MetadataRoute } from "next";

/** Shared links are never indexed. A private staging site is not indexed at all. */
export default function robots(): MetadataRoute.Robots {
  if (process.env.STAGING_PASSWORD) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }
  return { rules: { userAgent: "*", allow: "/", disallow: ["/si/s/", "/en/s/", "/api/"] } };
}
