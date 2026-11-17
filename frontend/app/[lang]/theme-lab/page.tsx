import Link from "next/link";
import { notFound } from "next/navigation";

import { hasLocale } from "@/lib/i18n";

import "./theme-lab.css";
import { LAB_PAGES } from "./pages";
import { THEMES } from "./themes";

export const metadata = { title: "Colour theme lab", robots: { index: false, follow: false } };

/** Hex colour to a black or white label, whichever reads better on it. */
function labelOn(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return (r * 299 + g * 587 + b * 114) / 1000 > 140 ? "#111" : "#fff";
}

export default async function ThemeLabIndex({ params }: PageProps<"/[lang]/theme-lab">) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();

  return (
    <main id="main" className="container labIndex">
      <div>
        <h1 className="display" style={{ fontSize: 40, lineHeight: 1.2 }}>
          Colour theme lab
        </h1>
        <p className="soft" style={{ marginTop: 8, maxWidth: 640 }}>
          The current design with the blue swapped for black, five ways. Option 0 is the site as it is now. Only
          colours change; layout, fonts and text stay the same. Nothing else in the site is touched.
        </p>
      </div>
      <div className="labGrid">
        {THEMES.map((theme) => {
          const [base, second, accent] = theme.colors.map((color) => color.hex);
          const style = {
            "--tc-bg": base,
            "--tc-ink": second,
            "--tc-soft": `${second}b3`,
            "--tc-accent": accent,
            "--tc-on": labelOn(accent),
            "--tc-line": `${second}33`,
          } as React.CSSProperties;
          return (
            <section key={theme.id} className="labCard" style={style}>
              <div>
                <p style={{ fontSize: 13, letterSpacing: "0.08em", textTransform: "uppercase" }}>{theme.letter === "0" ? "For comparison" : `Sample ${theme.letter}`}</p>
                <h2 className="display">{theme.name}</h2>
              </div>
              <div className="labColors">
                {theme.colors.map((color) => (
                  <div
                    key={color.hex}
                    className="labColor"
                    style={{
                      background: color.hex,
                      color: labelOn(color.hex),
                      border: "1px solid rgb(255 255 255 / 18%)",
                    }}
                  >
                    <b>{color.name}</b>
                    <span className="mono">{color.hex}</span>
                  </div>
                ))}
              </div>
              <p>{theme.mood}</p>
              <div className="labLinks">
                {LAB_PAGES.map((page, index) => (
                  <Link
                    key={page.id}
                    className={index === 0 ? "labBtn" : "labBtn labBtnGhost"}
                    href={["", lang, "theme-lab", theme.id, ...page.path].join("/")}
                  >
                    {page.label}
                  </Link>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </main>
  );
}
