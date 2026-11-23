import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PorondamApp } from "@/components/porondam/PorondamApp";
import { hasLocale } from "@/lib/i18n";

import { getDictionary } from "../dictionaries";

export async function generateMetadata({ params }: PageProps<"/[lang]/porondam">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const t = (await getDictionary(lang)).porondam;
  return {
    title: t.metaTitle,
    description: t.metaDescription,
    alternates: { canonical: `/${lang}/porondam`, languages: { si: "/si/porondam", en: "/en/porondam" } },
  };
}

export default async function PorondamPage({ params }: PageProps<"/[lang]/porondam">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  return <PorondamApp lang={lang} dict={dict} />;
}
