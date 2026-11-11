import { notFound } from "next/navigation";

import { PorondamApp } from "@/components/porondam/PorondamApp";
import { hasLocale } from "@/lib/i18n";

import { getDictionary } from "../dictionaries";

export default async function PorondamPage({ params }: PageProps<"/[lang]/porondam">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  return <PorondamApp lang={lang} dict={dict} />;
}
