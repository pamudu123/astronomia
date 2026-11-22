import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CreditsPage } from "@/components/CreditsPage";
import { hasLocale } from "@/lib/i18n";

import { getDictionary } from "../dictionaries";

export async function generateMetadata({ params }: PageProps<"/[lang]/credits">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const dict = await getDictionary(lang);
  return { title: `${dict.credits.title} · Sidera`, description: dict.credits.metaDescription };
}

export default async function Credits({ params }: PageProps<"/[lang]/credits">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  return <CreditsPage lang={lang} dict={dict} />;
}
