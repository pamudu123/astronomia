import Link from "next/link";

import { THEMES, type Theme } from "./themes";

type Page = "home" | "hadahan";

const PAGES: { id: Page; label: string; path: string }[] = [
  { id: "home", label: "Home", path: "" },
  { id: "hadahan", label: "Hadahan", path: "/hadahan" },
];

/** Sticky bar to jump between the 3 themes and the 2 pages while comparing. Not part of the site. */
export function LabBar({ lang, theme, page }: { lang: string; theme: Theme; page: Page }) {
  const base = `/${lang}/theme-lab`;
  return (
    <nav className="labBar" aria-label="Theme lab">
      <Link href={base} className="labChip">
        All themes
      </Link>
      <span className="labGroup">
        <span className="labLabel">Theme</span>
        {THEMES.map((item, index) => (
          <Link
            key={item.id}
            href={`${base}/${item.id}${page === "hadahan" ? "/hadahan" : ""}`}
            className="labChip"
            aria-current={item.id === theme.id ? "page" : undefined}
          >
            {index + 1}
          </Link>
        ))}
      </span>
      <span className="labGroup">
        <span className="labLabel">Page</span>
        {PAGES.map((item) => (
          <Link
            key={item.id}
            href={`${base}/${theme.id}${item.path}`}
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
