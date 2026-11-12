"""Turn report HTML into PDF bytes with WeasyPrint.

WeasyPrint shapes text with Pango and HarfBuzz, which joins Sinhala letters correctly.
Reports may only load the bundled fonts: no files elsewhere on the server, and no web
addresses, whatever ends up in the HTML.
"""

from pathlib import Path
from typing import Any

from weasyprint import CSS, HTML
from weasyprint.text.fonts import FontConfiguration
from weasyprint.urls import URLFetcher, URLFetcherResponse, URLFetchingError

REPORTS_DIR = Path(__file__).resolve().parent
FONTS_DIR = REPORTS_DIR / "fonts"

# (family, weight, file). The families match the website's.
FONT_FILES = (
    ("DM Sans", 400, "DMSans-Regular.ttf"),
    ("DM Sans", 500, "DMSans-Medium.ttf"),
    ("DM Sans", 600, "DMSans-SemiBold.ttf"),
    ("Marcellus", 400, "Marcellus-Regular.ttf"),
    ("Noto Sans Sinhala", 400, "NotoSansSinhala-Regular.ttf"),
    ("Noto Sans Sinhala", 500, "NotoSansSinhala-Regular.ttf"),
    ("Noto Sans Sinhala", 600, "NotoSansSinhala-SemiBold.ttf"),
)


def _font_faces() -> str:
    return "\n".join(
        f'@font-face {{ font-family: "{family}"; font-weight: {weight}; '
        f'src: url("{(FONTS_DIR / name).as_uri()}"); }}'
        for family, weight, name in FONT_FILES
    )


class BundledFontsOnly(URLFetcher):  # type: ignore[misc]  # WeasyPrint has no type information
    """Serves the bundled font files and refuses every other address."""

    def fetch(self, url: str, headers: Any = None) -> URLFetcherResponse:
        allowed = {(FONTS_DIR / name).as_uri(): FONTS_DIR / name for _, _, name in FONT_FILES}
        path = allowed.get(url)
        if path is None:
            raise URLFetchingError(f"reports may not load {url[:80]}")
        return URLFetcherResponse(url, path.read_bytes(), {"Content-Type": "font/ttf"})


def html_to_pdf(html: str, stylesheet: str = "") -> bytes:
    """Render a complete HTML document to PDF. The stylesheet is added after the fonts."""
    font_config = FontConfiguration()
    fetcher = BundledFontsOnly()
    styles = [
        CSS(string=_font_faces(), font_config=font_config, url_fetcher=fetcher),
        CSS(string=stylesheet, font_config=font_config, url_fetcher=fetcher),
    ]
    document = HTML(string=html, base_url=FONTS_DIR.as_uri() + "/", url_fetcher=fetcher)
    pdf: bytes = document.write_pdf(stylesheets=styles, font_config=font_config)
    return pdf
