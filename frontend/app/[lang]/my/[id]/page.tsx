import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { SavedReportApp } from "@/components/account/SavedReportApp";
import { hasLocale } from "@/lib/i18n";

import { getDictionary } from "../../dictionaries";

export async function generateMetadata({ params }: PageProps<"/[lang]/my/[id]">): Promise<Metadata> {
  const { lang } = await params;
  const hidden: Metadata = { robots: { index: false, follow: false }, referrer: "no-referrer" };
  if (!hasLocale(lang)) return hidden;
  const dict = await getDictionary(lang);
  return { ...hidden, title: dict.saved.banner };
}

async function Saved({ params }: { params: PageProps<"/[lang]/my/[id]">["params"] }) {
  const { lang, id } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  return <SavedReportApp lang={lang} id={id} dict={dict} />;
}

/** One saved report. Only this browser's account can open it. */
export default function SavedReportPage({ params }: PageProps<"/[lang]/my/[id]">) {
  // The id is only known at request time, so the page streams in behind this boundary.
  return (
    <Suspense fallback={null}>
      <Saved params={params} />
    </Suspense>
  );
}
