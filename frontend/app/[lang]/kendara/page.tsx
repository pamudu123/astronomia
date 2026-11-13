import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { KendaraApp } from "@/components/kendara/KendaraApp";
import { hasLocale } from "@/lib/i18n";

import { getDictionary } from "../dictionaries";

export async function generateMetadata({ params }: PageProps<"/[lang]/kendara">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const t = (await getDictionary(lang)).kendara;
  return {
    title: t.metaTitle,
    description: t.metaDescription,
    alternates: { canonical: `/${lang}/kendara`, languages: { si: "/si/kendara", en: "/en/kendara" } },
  };
}

export default async function KendaraPage({ params }: PageProps<"/[lang]/kendara">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  return <KendaraApp lang={lang} dict={dict} />;
}
