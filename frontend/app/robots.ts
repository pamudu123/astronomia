import type { MetadataRoute } from "next";

/** Shared links are never indexed. A private staging site is not indexed at all. */
export default function robots(): MetadataRoute.Robots {
  if (process.env.STAGING_PASSWORD) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }
  const site = (process.env.SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/si/s/", "/en/s/", "/api/"] },
    sitemap: `${site}/sitemap.xml`,
  };
}
