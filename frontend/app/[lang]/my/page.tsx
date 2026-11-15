import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { MyReportsApp } from "@/components/account/MyReportsApp";
import { hasLocale } from "@/lib/i18n";

import { getDictionary } from "../dictionaries";

export async function generateMetadata({ params }: PageProps<"/[lang]/my">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const dict = await getDictionary(lang);
  return { title: dict.saved.title, robots: { index: false, follow: false } };
}

/** My reports. Private to this browser, so never indexed. */
export default async function MyReportsPage({ params }: PageProps<"/[lang]/my">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  return <MyReportsApp lang={lang} dict={dict} />;
}
