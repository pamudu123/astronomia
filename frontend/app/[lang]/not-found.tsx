import type { Metadata } from "next";

import { NotFoundPage } from "@/components/NotFoundPage";
import { defaultLocale, hasLocale } from "@/lib/i18n";

import { getDictionary } from "./dictionaries";

type Props = { params?: Promise<{ lang?: string }> };

/** Next.js does not promise params here, only passes the segment's; without them it is in English. */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const lang = (await params)?.lang ?? "";
  const t = (await getDictionary(hasLocale(lang) ? lang : defaultLocale)).notFound;
  // No alternates: the layout's point at the home page.
  return { title: t.metaTitle, description: t.text, alternates: null };
}

export default function NotFound() {
  return <NotFoundPage />;
}
