import { notFound } from "next/navigation";

import HomePage from "@/app/[lang]/page";
import { hasLocale } from "@/lib/i18n";

import { LabBar } from "../LabBar";
import "../theme-lab.css";
import { THEMES, findTheme } from "../themes";

export const metadata = { title: "Colour theme lab: Home", robots: { index: false, follow: false } };

export function generateStaticParams() {
  return THEMES.map((theme) => ({ theme: theme.id }));
}

/** The real home page, re-coloured. */
export default async function ThemedHome({ params, searchParams }: PageProps<"/[lang]/theme-lab/[theme]">) {
  const { lang, theme: id } = await params;
  const theme = findTheme(id);
  if (!hasLocale(lang) || !theme) notFound();

  return (
    <div data-lab-theme={theme.id}>
      <LabBar lang={lang} theme={theme} page="home" />
      <HomePage params={Promise.resolve({ lang })} searchParams={searchParams} />
    </div>
  );
}
