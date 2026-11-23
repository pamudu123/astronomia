import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { HadahanApp } from "@/components/hadahan/HadahanApp";
import { hasLocale } from "@/lib/i18n";

import { getDictionary } from "../dictionaries";

export async function generateMetadata({ params }: PageProps<"/[lang]/hadahan">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const t = (await getDictionary(lang)).hadahan;
  return {
    title: t.metaTitle,
    description: t.metaDescription,
    alternates: { canonical: `/${lang}/hadahan`, languages: { si: "/si/hadahan", en: "/en/hadahan" } },
  };
}

export default async function HadahanPage({ params }: PageProps<"/[lang]/hadahan">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  return <HadahanApp lang={lang} t={dict.hadahan} share={dict.share} saveText={dict.saved} yearly={dict.yearly} kendara={dict.kendara} next={dict.next} remember={dict.remember} />;
}
