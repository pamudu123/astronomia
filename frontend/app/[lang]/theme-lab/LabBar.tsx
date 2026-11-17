import Link from "next/link";

import { LAB_PAGES } from "./pages";
import { THEMES, type Theme } from "./themes";

const href = (lang: string, theme: string, path: string[]) =>
  ["", lang, "theme-lab", theme, ...path].join("/");

/** Sticky bar to jump between the themes and pages while comparing. Not part of the site. */
export function LabBar({ lang, theme, page }: { lang: string; theme: Theme; page: string }) {
  const current = LAB_PAGES.find((item) => item.id === page);
  return (
    <nav className="labBar" aria-label="Theme lab">
      <Link href={`/${lang}/theme-lab`} className="labChip">
        All themes
      </Link>
      <span className="labGroup">
        <span className="labLabel">Theme</span>
        {THEMES.map((item) => (
          <Link
            key={item.id}
            href={href(lang, item.id, current?.path ?? [])}
            className="labChip"
            aria-current={item.id === theme.id ? "page" : undefined}
            title={item.name}
          >
            {item.letter}
          </Link>
        ))}
      </span>
      <span className="labGroup">
        <span className="labLabel">Page</span>
        {LAB_PAGES.map((item) => (
          <Link
            key={item.id}
            href={href(lang, theme.id, item.path)}
            className="labChip"
            aria-current={item.id === page ? "page" : undefined}
          >
            {item.label}
          </Link>
        ))}
      </span>
      <span className="labCurrent">
        <span className="labSwatches" aria-hidden="true">
          {theme.colors.map((color) => (
            <i key={color.hex} style={{ background: color.hex }} />
          ))}
        </span>{" "}
        {theme.name}
      </span>
    </nav>
  );
}
