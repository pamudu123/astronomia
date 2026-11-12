"""Sinhala must print correctly in the PDF. Many PDF tools draw the letters but never join them."""

import io

import pytest
from pypdf import PdfReader
from pypdf.generic import ContentStream
from weasyprint.urls import URLFetchingError

from app.reports.pdf import FONTS_DIR, BundledFontsOnly, html_to_pdf

SRI = "ශ්‍රී"  # the conjunct "shri" in Sri Lanka: 5 code points
KRA = "ක්‍ර"  # "kra" with the rakaransaya: 4 code points


def _page(pdf: bytes) -> object:
    return PdfReader(io.BytesIO(pdf)).pages[0]


def _fonts(pdf: bytes) -> set[str]:
    page = _page(pdf)
    fonts = page["/Resources"].get("/Font", {})  # type: ignore[index]
    # Embedded names look like "/ABCDEF+Noto-Sans-Sinhala". Drop the subset tag.
    return {str(font.get_object()["/BaseFont"]).split("+", 1)[-1] for font in fonts.values()}


def _glyph_count(pdf: bytes) -> int:
    """Glyphs drawn on the page. Fonts are embedded with two bytes per glyph."""
    page = _page(pdf)
    stream = ContentStream(page.get_contents(), page.pdf)  # type: ignore[attr-defined]
    count = 0
    for operands, operator in stream.operations:
        if operator == b"Tj":
            count += len(operands[0].original_bytes) // 2
        elif operator == b"TJ":
            count += sum(
                len(item.original_bytes) // 2
                for item in operands[0]
                if hasattr(item, "original_bytes")
            )
    return count


def _paragraph(text: str) -> bytes:
    return html_to_pdf(f"<p style=\"font-family: 'DM Sans', 'Noto Sans Sinhala'\">{text}</p>")


@pytest.mark.parametrize(("text", "code_points"), [(SRI, 5), (KRA, 4)])
def test_conjuncts_are_joined(text: str, code_points: int) -> None:
    assert len(text) == code_points
    # Unjoined, every code point would be its own glyph (with dotted circles). Joined, the
    # font draws the cluster with fewer glyphs.
    assert _glyph_count(_paragraph(text)) < code_points


def test_latin_is_one_glyph_per_letter() -> None:
    assert _glyph_count(_paragraph("Lagna")) == 5


def test_only_the_bundled_fonts_are_used() -> None:
    pdf = _paragraph(f"Astronomia {SRI} ලංකාව වෘශ්චික")
    assert _fonts(pdf) == {"DM-Sans", "Noto-Sans-Sinhala"}


def test_the_fonts_and_licences_are_bundled() -> None:
    for name in ("NotoSansSinhala-Regular.ttf", "DMSans-Regular.ttf", "Marcellus-Regular.ttf"):
        assert (FONTS_DIR / name).stat().st_size > 10_000
    assert len(list(FONTS_DIR.glob("OFL-*.txt"))) == 3


def test_reports_cannot_load_other_files_or_addresses() -> None:
    fetcher = BundledFontsOnly()
    font = (FONTS_DIR / "DMSans-Regular.ttf").as_uri()
    assert fetcher.fetch(font).read()[:4] == b"\x00\x01\x00\x00"
    for url in ("file:///etc/passwd", "https://example.com/a.png", "data:text/plain,hi"):
        with pytest.raises(URLFetchingError):
            fetcher.fetch(url)

    pdf = html_to_pdf('<img src="file:///etc/passwd"><img src="https://example.com/a.png">')
    images = _page(pdf)["/Resources"].get("/XObject", {})  # type: ignore[index]
    assert len(images) == 0
