"""The artwork a PDF report prints (art/README.md): the covers, the section banners, the chapter
and rashi pictures, and the sign symbols.

Raster pictures go in by file address, which the report's URL fetcher allows for these files
only (app/reports/pdf.py). The line drawings are inlined as SVG, so they need no fetching and
stay sharp at any size. All of them are our own files, never text from a request.
"""

import re
from functools import cache
from pathlib import Path

from markupsafe import Markup

from app.engine.zodiac import RASHI

ART_DIR = Path(__file__).resolve().parent / "art"

# The picture at the top of each AI chapter: the same as the website's
# (frontend/lib/assistant/chapterArt.ts). The wedding chapter's is its own.
CHAPTER_ART: dict[str, str] = {
    "match.people": "people",
    "match.factors": "factors",
    "match.checks": "checks",
    "match.mars": "mars",
    "match.styles": "styles",
    "match.summary": "summary",
    "match.combinations": "combinations",
    "match.lords": "planets",
    "match.years": "periods",
    "match.wedding": "wedding",
    "chart.summary": "summary",
    "chart.combinations": "combinations",
    "chart.saturn": "saturn",
    "chart.ahead": "ahead",
    "chart.nature": "nature",
    "chart.planets": "planets",
    "chart.houses": "houses",
    "chart.work": "work",
    "chart.love": "love",
    "chart.family": "family",
    "chart.studies": "studies",
    "chart.abroad": "abroad",
    "chart.periods": "periods",
    "chart.mars": "mars",
    "chart.care": "care",
}
DEFAULT_ART = "summary"
SECTIONS = ("sky", "houses", "periods", "kuja", "match", "checks", "reading")


def _rashi_file(sign: str, folder: str, suffix: str) -> Path:
    number = RASHI.index(sign) + 1
    return ART_DIR / folder / f"rashi-{number:02d}-{sign}{suffix}"


def art_files() -> dict[str, Path]:
    """Every raster picture a report may load, by its file address."""
    files = [
        *sorted(ART_DIR.glob("*.jpg")),
        *sorted((ART_DIR / "chapters").glob("*.jpg")),
        *sorted((ART_DIR / "sections").glob("*.jpg")),
        *sorted((ART_DIR / "rashi").glob("*.webp")),
    ]
    return {path.as_uri(): path for path in files}


def cover_uri(name: str) -> str:
    """A full page: "cover-hadahan", "cover-porondam" or "back-cover"."""
    return (ART_DIR / f"{name}.jpg").as_uri()


def section_uris() -> dict[str, str]:
    """The banner of each main part of the report."""
    return {name: (ART_DIR / "sections" / f"{name}.jpg").as_uri() for name in SECTIONS}


def chapter_uri(chapter_id: str | None) -> str:
    """The chapter's picture."""
    name = CHAPTER_ART.get(chapter_id or "", DEFAULT_ART)
    return (ART_DIR / "chapters" / f"{name}.jpg").as_uri()


def rashi_uri(sign: str) -> str:
    """The sign's artwork."""
    return _rashi_file(sign, "rashi", ".webp").as_uri()


@cache
def _svg_parts(path: Path) -> tuple[str, str]:
    """An SVG file's viewBox and what is inside its root element."""
    text = path.read_text(encoding="utf-8")
    found = re.search(r'viewBox="([^"]+)"', text)
    inner = re.sub(r"\A.*?<svg[^>]*>|</svg>\s*\Z", "", text, flags=re.DOTALL)
    return (found[1] if found else "0 0 100 100"), inner


def glyph(sign: str, color: str = "#8a6212") -> Markup:
    """The sign's line symbol, as SVG to inline."""
    return Markup(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">'
        f"{glyph_strokes(sign, color)}</svg>"
    )


def glyph_strokes(sign: str, color: str) -> str:
    """Only the strokes of a sign's symbol (an SVG group), to place inside a bigger drawing."""
    _, inner = _svg_parts(_rashi_file(sign, "glyphs", ".svg"))
    strokes = re.search(r"<g .*</g>", inner, flags=re.DOTALL)
    return (strokes[0] if strokes else "").replace("#E3B866", color)
