import { notFound } from "next/navigation";

import { HadahanApp } from "@/components/hadahan/HadahanApp";
import { hasLocale } from "@/lib/i18n";

import { getDictionary } from "../dictionaries";

export default async function HadahanPage({ params }: PageProps<"/[lang]/hadahan">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  return <HadahanApp lang={lang} t={dict.hadahan} share={dict.share} saveText={dict.saved} yearly={dict.yearly} kendara={dict.kendara} next={dict.next} remember={dict.remember} />;
}
