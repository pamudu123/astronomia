import { notFound } from "next/navigation";

import HadahanPage from "@/app/[lang]/hadahan/page";
import { hasLocale } from "@/lib/i18n";

import { LabBar } from "../../LabBar";
import "../../theme-lab.css";
import { THEMES, findTheme } from "../../themes";

export const metadata = { title: "Colour theme lab: Hadahan", robots: { index: false, follow: false } };

export function generateStaticParams() {
  return THEMES.map((theme) => ({ theme: theme.id }));
}

/** The real hadahan page, re-coloured. */
export default async function ThemedHadahan({ params, searchParams }: PageProps<"/[lang]/theme-lab/[theme]/hadahan">) {
  const { lang, theme: id } = await params;
  const theme = findTheme(id);
  if (!hasLocale(lang) || !theme) notFound();

  return (
    <div data-lab-theme={theme.id}>
      <LabBar lang={lang} theme={theme} page="hadahan" />
      <HadahanPage params={Promise.resolve({ lang })} searchParams={searchParams} />
    </div>
  );
}
