import type { Metadata, Viewport } from "next";
import { DM_Sans, JetBrains_Mono, Marcellus, Noto_Sans_Sinhala, Noto_Serif_Sinhala } from "next/font/google";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { Assistant } from "@/components/assistant/Assistant";
import { PaidTextProvider } from "@/components/paid/ReportAccess";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { type Locale, hasLocale, locales } from "@/lib/i18n";
import { THEME_SCRIPT } from "@/lib/theme";

import "../globals.css";
import { type Dictionary, getDictionary } from "./dictionaries";

const marcellus = Marcellus({ weight: "400", subsets: ["latin"], variable: "--font-marcellus" });
const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-dm-sans" });
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains" });
const notoSansSinhala = Noto_Sans_Sinhala({
  subsets: ["sinhala"],
  variable: "--font-sans-sinhala",
});
const notoSerifSinhala = Noto_Serif_Sinhala({
  subsets: ["sinhala"],
  variable: "--font-serif-sinhala",
});

const fontVariables = [marcellus, dmSans, jetbrainsMono, notoSansSinhala, notoSerifSinhala]
  .map((font) => font.variable)
  .join(" ");

/** The phone browser's bar follows the device theme. */
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f1ea" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export async function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export async function generateMetadata({ params }: LayoutProps<"/[lang]">): Promise<Metadata> {
  const { lang } = await params;
  if (!hasLocale(lang)) return {};
  const dict = await getDictionary(lang);
  return {
    metadataBase: new URL(process.env.SITE_URL ?? "http://localhost:3000"),
    title: dict.meta.title,
    description: dict.meta.description,
    alternates: { languages: { si: "/si", en: "/en" } },
    openGraph: {
      title: dict.meta.title,
      description: dict.meta.description,
      images: [{ url: "/images/share-preview.jpg", width: 1200, height: 630 }],
    },
  };
}

/** The AI chat wraps the page only when the agent is configured (AGENT_URL): that is its off switch. */
function Page({ lang, dict, children }: { lang: Locale; dict: Dictionary; children: ReactNode }) {
  if (!process.env.AGENT_URL) return children;
  return (
    <Assistant lang={lang} t={dict.assistant} tools={dict.allTools}>
      {children}
    </Assistant>
  );
}

export default async function RootLayout({ children, params }: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = await getDictionary(lang);

  return (
    // The theme script sets data-theme on <html> before React takes over, hence suppressHydrationWarning.
    <html lang={lang} className={fontVariables} suppressHydrationWarning>
      <head>
        {/* Applies a saved light or dark choice before the page paints, so it never flashes. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        <a className="skip-link" href="#main">
          {dict.nav.skip}
        </a>
        <PaidTextProvider value={dict.paid}>
          <Page lang={lang} dict={dict}>
            <SiteHeader lang={lang} dict={dict} />
            {children}
            <SiteFooter lang={lang} dict={dict} />
          </Page>
        </PaidTextProvider>
      </body>
    </html>
  );
}
