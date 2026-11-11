import { notFound } from "next/navigation";

import { ComingSoon } from "@/components/ComingSoon";
import { hasLocale } from "@/lib/i18n";

import { getDictionary } from "../dictionaries";

export default async function Page({ params }: PageProps<"/[lang]/plans">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  return <ComingSoon lang={lang} dict={dict} title={dict.nav.plans} />;
}
