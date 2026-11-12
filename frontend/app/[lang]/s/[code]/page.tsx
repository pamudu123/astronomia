import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { SharedApp } from "@/components/SharedApp";
import { fill } from "@/lib/hadahan";
import { type Locale, hasLocale } from "@/lib/i18n";
import { RASHI } from "@/lib/rashi";
import type { Shared } from "@/lib/share";

import { getDictionary } from "../../dictionaries";

const BACKEND = process.env.BACKEND_URL ?? "http://localhost:8000";

/** The share as the link preview needs it. Null when it is gone or the backend is away. */
async function loadShare(code: string, lang: Locale): Promise<Shared | null> {
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(code)) return null;
  try {
    const response = await fetch(`${BACKEND}/v1/shares/${code}?lang=${lang}`, { cache: "no-store" });
    return response.ok ? ((await response.json()) as Shared) : null;
  } catch {
    return null;
  }
}

const rashiName = (key: string, lang: Locale) => {
  const rashi = RASHI.find((r) => r.key === key);
  return rashi ? rashi[lang] : key;
};

/** The link preview (WhatsApp and others): a title, one line and the share picture. */
export async function generateMetadata({ params }: PageProps<"/[lang]/s/[code]">): Promise<Metadata> {
  const { lang, code } = await params;
  const hidden: Metadata = { robots: { index: false, follow: false }, referrer: "no-referrer" };
  if (!hasLocale(lang)) return hidden;
  const dict = await getDictionary(lang);
  const shared = await loadShare(code, lang);

  let title = dict.share.banner;
  let description = dict.share.goneText;
  if (shared?.hadahan) {
    const { name, result } = shared.hadahan;
    title = name ? fill(dict.hadahan.result.titleNamed, { name }) : dict.share.anonHadahan;
    description = fill(dict.share.metaHadahan, {
      lagna: rashiName(result.chart?.lagna.sign ?? "", lang),
      rashi: rashiName(result.chart?.moon.sign ?? "", lang),
    });
  } else if (shared?.porondam?.match) {
    const { bride, groom, match } = shared.porondam;
    title =
      bride?.name || groom?.name
        ? fill(dict.porondam.result.title, {
            bride: bride?.name || dict.porondam.form.bride,
            groom: groom?.name || dict.porondam.form.groom,
          })
        : dict.share.anonPorondam;
    description = `${fill(dict.share.summaryPorondam, {
      passed: match.score.passed,
      total: match.score.total,
    })}. ${match.summary_text}`;
  }

  return {
    ...hidden,
    title,
    description,
    openGraph: {
      title,
      description,
      images: [{ url: "/images/share-preview.jpg", width: 1200, height: 630 }],
    },
  };
}

async function Shared({ params }: { params: PageProps<"/[lang]/s/[code]">["params"] }) {
  const { lang, code } = await params;
  if (!hasLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  return <SharedApp lang={lang} code={code} dict={dict} />;
}

export default function SharedPage({ params }: PageProps<"/[lang]/s/[code]">) {
  // The code is only known at request time, so the page streams in behind this boundary.
  return (
    <Suspense fallback={null}>
      <Shared params={params} />
    </Suspense>
  );
}
