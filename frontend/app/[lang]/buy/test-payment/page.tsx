import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { TestPaymentApp } from "@/components/paid/TestPaymentApp";
import { hasLocale } from "@/lib/i18n";

import { getDictionary } from "../../dictionaries";

export async function generateMetadata({ params }: PageProps<"/[lang]/buy/test-payment">): Promise<Metadata> {
  const { lang } = await params;
  const hidden: Metadata = { robots: { index: false, follow: false }, referrer: "no-referrer" };
  if (!hasLocale(lang)) return hidden;
  const dict = await getDictionary(lang);
  return { ...hidden, title: dict.buy.test.title };
}

/** The stand-in payment page, until a payment provider is connected. */
export default async function TestPaymentPage({ params }: PageProps<"/[lang]/buy/test-payment">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  return <TestPaymentApp lang={lang} t={dict.buy} />;
}
