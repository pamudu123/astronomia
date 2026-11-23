import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { BuyApp } from "@/components/paid/BuyApp";
import { hasLocale } from "@/lib/i18n";

import { getDictionary } from "../dictionaries";

export async function generateMetadata({ params }: PageProps<"/[lang]/buy">): Promise<Metadata> {
  const { lang } = await params;
  const hidden: Metadata = { robots: { index: false, follow: false }, referrer: "no-referrer" };
  if (!hasLocale(lang)) return hidden;
  const dict = await getDictionary(lang);
  return { ...hidden, title: dict.buy.title };
}

/** The buying page. Private to this tab, so never indexed. */
export default async function BuyPage({ params }: PageProps<"/[lang]/buy">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  return <BuyApp lang={lang} t={dict.buy} paid={dict.paid} />;
}
