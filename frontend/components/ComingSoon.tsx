import Link from "next/link";

import type { Dictionary } from "@/app/[lang]/dictionaries";
import type { Locale } from "@/lib/i18n";

export function ComingSoon({
  lang,
  dict,
  title,
}: {
  lang: Locale;
  dict: Dictionary;
  title: string;
}) {
  return (
    <main id="main" className="container" style={{ paddingBlock: "64px 120px" }}>
      <div className="rise" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <p className="soft">{dict.soon.title}</p>
        <h1 className="display" style={{ fontSize: "clamp(36px, 5vw, 52px)", lineHeight: 1.15 }}>
          {title}
        </h1>
        <p className="soft">{dict.soon.text}</p>
        <Link href={`/${lang}`} className="btn btn-outline" style={{ alignSelf: "flex-start" }}>
          {dict.soon.back}
        </Link>
      </div>
    </main>
  );
}
