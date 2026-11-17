import { notFound } from "next/navigation";

import { hasLocale } from "@/lib/i18n";

import { LabBar } from "../../LabBar";
import "../../theme-lab.css";
import { LAB_PAGES, findPage } from "../../pages";
import { THEMES, findTheme } from "../../themes";

export const metadata = { title: "Colour theme lab", robots: { index: false, follow: false } };

export function generateStaticParams() {
  return THEMES.flatMap((theme) => LAB_PAGES.map((page) => ({ theme: theme.id, page: page.path })));
}

/** A real page of the site (home, hadahan, porondam ...) shown in one colour theme. */
export default async function ThemedPage({ params, searchParams }: PageProps<"/[lang]/theme-lab/[theme]/[[...page]]">) {
  const { lang, theme: id, page: path = [] } = await params;
  const theme = findTheme(id);
  const entry = findPage(path);
  if (!hasLocale(lang) || !theme || !entry) notFound();

  const { default: Page } = await entry.load();
  return (
    <div data-lab-theme={theme.id} data-lab-hero={theme.hero}>
      <LabBar lang={lang} theme={theme} page={entry.id} />
      <Page params={Promise.resolve({ lang })} searchParams={searchParams} />
    </div>
  );
}
