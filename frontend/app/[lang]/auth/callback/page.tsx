import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AuthCallback } from "@/components/account/AuthCallback";
import { hasLocale } from "@/lib/i18n";

import { getDictionary } from "../../dictionaries";

export async function generateMetadata({ params }: PageProps<"/[lang]/auth/callback">): Promise<Metadata> {
  const { lang } = await params;
  const hidden: Metadata = { robots: { index: false, follow: false }, referrer: "no-referrer" };
  if (!hasLocale(lang)) return hidden;
  const dict = await getDictionary(lang);
  return { ...hidden, title: dict.saved.callbackTitle };
}

/** Where Google sends the browser back to, through Supabase (docs/19). Finishes the sign in. */
export default async function AuthCallbackPage({ params }: PageProps<"/[lang]/auth/callback">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  return <AuthCallback lang={lang} t={dict.saved} />;
}
