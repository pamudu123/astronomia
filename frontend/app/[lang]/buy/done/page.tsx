import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { PaymentDoneApp } from "@/components/paid/PaymentDoneApp";
import { hasLocale } from "@/lib/i18n";

import { getDictionary } from "../../dictionaries";

export async function generateMetadata({ params }: PageProps<"/[lang]/buy/done">): Promise<Metadata> {
  const { lang } = await params;
  const hidden: Metadata = { robots: { index: false, follow: false }, referrer: "no-referrer" };
  if (!hasLocale(lang)) return hidden;
  const dict = await getDictionary(lang);
  return { ...hidden, title: dict.buy.waitingTitle };
}

/** Where a payment sends the buyer back to. */
export default async function PaymentDonePage({ params }: PageProps<"/[lang]/buy/done">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  return <PaymentDoneApp lang={lang} t={dict.buy} />;
}
