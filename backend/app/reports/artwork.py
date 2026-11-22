"""The artwork a PDF report prints (art/README.md): the cover sky, the rashi pictures, the sign
symbols and the chapter spots.

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

# The picture beside each AI chapter: the same as the website's (frontend/lib/assistant/explain.ts).
CHAPTER_SPOT: dict[str, str] = {
    "match.people": "couple",
    "match.factors": "checklist",
    "match.checks": "shield",
    "match.mars": "mars",
    "match.styles": "moon",
    "match.summary": "compass",
    "match.combinations": "constellation",
    "match.lords": "planets",
    "match.years": "periods",
    "match.wedding": "wedding",
    "chart.summary": "compass",
    "chart.combinations": "constellation",
    "chart.saturn": "saturn",
    "chart.ahead": "road",
    "chart.nature": "sunrise",
    "chart.planets": "planets",
    "chart.houses": "houses",
    "chart.work": "work",
    "chart.love": "love",
    "chart.family": "family",
    "chart.studies": "book",
    "chart.abroad": "travel",
    "chart.periods": "periods",
    "chart.mars": "mars",
    "chart.care": "lotus",
}
DEFAULT_SPOT = "constellation"


def _rashi_file(sign: str, folder: str, suffix: str) -> Path:
    number = RASHI.index(sign) + 1
    return ART_DIR / folder / f"rashi-{number:02d}-{sign}{suffix}"


def art_files() -> dict[str, Path]:
    """Every raster picture a report may load, by its file address."""
    files = [ART_DIR / "hero-sky.jpg", *sorted((ART_DIR / "rashi").glob("*.webp"))]
    return {path.as_uri(): path for path in files}


def hero_uri() -> str:
    return (ART_DIR / "hero-sky.jpg").as_uri()


def rashi_uri(sign: str) -> str | None:
    """The sign's artwork, or None where there is none yet (Simha)."""
    path = _rashi_file(sign, "rashi", ".webp")
    return path.as_uri() if path.exists() else None


@cache
def _svg_parts(path: Path) -> tuple[str, str]:
    """An SVG file's viewBox and what is inside its root element."""
    text = path.read_text(encoding="utf-8")
    found = re.search(r'viewBox="([^"]+)"', text)
    inner = re.sub(r"\A.*?<svg[^>]*>|</svg>\s*\Z", "", text, flags=re.DOTALL)
    return (found[1] if found else "0 0 100 100"), inner


def glyph(sign: str, color: str = "#8a6212", ring: bool = False) -> Markup:
    """The sign's line symbol, as SVG to inline. Without the ring and its stars by default."""
    _, inner = _svg_parts(_rashi_file(sign, "glyphs", ".svg"))
    strokes = re.search(r"<g .*</g>", inner, flags=re.DOTALL)
    body = strokes[0] if strokes and not ring else inner
    body = body.replace("#E3B866", color)
    return Markup(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">{body}</svg>')


def glyph_strokes(sign: str, color: str) -> str:
    """Only the strokes of a sign's symbol (an SVG group), to place inside a bigger drawing."""
    _, inner = _svg_parts(_rashi_file(sign, "glyphs", ".svg"))
    strokes = re.search(r"<g .*</g>", inner, flags=re.DOTALL)
    return (strokes[0] if strokes else "").replace("#E3B866", color)


def spot(chapter_id: str | None) -> Markup:
    """The chapter's spot picture, as SVG to inline."""
    name = CHAPTER_SPOT.get(chapter_id or "", DEFAULT_SPOT)
    view_box, inner = _svg_parts(ART_DIR / "spots" / f"{name}.svg")
    return Markup(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{view_box}">{inner}</svg>')
