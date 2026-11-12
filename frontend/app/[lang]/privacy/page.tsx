import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { LegalPage } from "@/components/LegalPage";
import { hasLocale } from "@/lib/i18n";

import { getDictionary } from "../dictionaries";

export async function generateMetadata({ params }: PageProps<"/[lang]/privacy">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const dict = await getDictionary(lang);
  return { title: `${dict.privacy.title} · Astronomia` };
}

export default async function PrivacyPage({ params }: PageProps<"/[lang]/privacy">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  return <LegalPage dict={dict} page={dict.privacy} />;
}
