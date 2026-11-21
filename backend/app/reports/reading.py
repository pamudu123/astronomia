"""The AI reading in a PDF report: the chapters the person read on the page (docs/17).

Everything else in a report is worked out again on the server from the birth details. These
chapters are not: they are the AI text the person already read, sent back with the request, so
the PDF holds the same words. They print in their own section, labelled as an AI reading.

A chapter uses a small part of markdown (the `explain-card` skill): paragraphs, bold leads,
bold words and simple lists. This turns it into blocks for the template, which escapes every
piece of text, so nothing in a chapter becomes markup.

On the page each bold lead starts with an icon (an emoji). The report's fonts have no emoji, so
they would print as empty boxes: the icons are left out of the PDF.
"""

import re
from dataclasses import dataclass

Span = tuple[str, bool]  # text, bold

ITEM = re.compile(r"^(?:[-*•]|\d+[.)])\s+(.*)$")
HEADING = re.compile(r"^#{1,6}\s+(.*)$")
LEAD = re.compile(r"^\*\*([^*]+)\*\*:?$")
BLANK_LINE = re.compile(r"\n\s*\n")

# Emoji and pictographs, with their variation selector, joined sequences and the space after.
# A zero-width joiner on its own is left alone: Sinhala needs it to join letters (ශ්‍රී).
_PICTO = "⌀-⏿☀-➿⬀-⯿\U0001f000-\U0001faff"
ICON = re.compile(f"[{_PICTO}]️?(?:‍[{_PICTO}]️?)*[ \t]*")


def without_icons(text: str) -> str:
    """'**💼 Work that suits you**' -> '**Work that suits you**'."""
    return ICON.sub("", text)


@dataclass(frozen=True)
class Block:
    kind: str  # "paragraph", "lead" or "list"
    spans: tuple[Span, ...] = ()
    items: tuple[tuple[Span, ...], ...] = ()


def spans(line: str) -> tuple[Span, ...]:
    """'**Lead** rest' -> bold and plain spans. An unclosed ** stays as text."""
    parts = line.split("**")
    if len(parts) % 2 == 0:
        return ((line, False),)
    return tuple((text, index % 2 == 1) for index, text in enumerate(parts) if text)


def _flush(result: list[Block], paragraph: list[str], items: list[tuple[Span, ...]]) -> None:
    """Moves a gathered paragraph or list into the result, and empties both."""
    if paragraph:
        result.append(Block("paragraph", spans(" ".join(paragraph))))
    if items:
        result.append(Block("list", items=tuple(items)))
    paragraph.clear()
    items.clear()


def blocks(text: str) -> list[Block]:
    """The same reading of a chapter as the website's (frontend/lib/assistant/explain.ts)."""
    result: list[Block] = []
    for chunk in BLANK_LINE.split(without_icons(text).replace("\r\n", "\n")):
        lines = [line.strip() for line in chunk.split("\n") if line.strip()]
        paragraph: list[str] = []
        items: list[tuple[Span, ...]] = []
        for line in lines:
            item, heading, lead = ITEM.match(line), HEADING.match(line), LEAD.match(line)
            if item:
                if paragraph:
                    _flush(result, paragraph, items)
                items.append(spans(item[1]))
            elif heading or lead:
                _flush(result, paragraph, items)
                words = heading[1].replace("**", "") if heading else lead[1] if lead else ""
                result.append(Block("lead", ((words, True),)))
            else:
                if items:
                    _flush(result, paragraph, items)
                paragraph.append(line)
        _flush(result, paragraph, items)
    return result
