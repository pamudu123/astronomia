"""The AI reading in a PDF report: the chapters the person read on the page (docs/17).

Everything else in a report is worked out again on the server from the birth details. These
chapters are not: they are the AI text the person already read, sent back with the request, so
the PDF holds the same words. They print in their own section, labelled as an AI reading.

A chapter uses a small part of markdown (the `explain-card` skill): paragraphs, bold leads,
bold words, simple lists and small tables. This turns it into blocks for the template, which
escapes every piece of text, so nothing in a chapter becomes markup.

On the page each bold lead starts with an icon (an emoji). The report's fonts have no emoji, so
they would print as empty boxes: the icons are left out of the PDF. What an icon says (a tip, a
caution, good news) is kept as the part's tone, which the report tints like the page does.
"""

import re
from dataclasses import dataclass

Span = tuple[str, bool]  # text, bold

ITEM = re.compile(r"^(?:[-*•]|\d+[.)])\s+(.*)$")
HEADING = re.compile(r"^#{1,6}\s+(.*)$")
LEAD = re.compile(r"^\*\*([^*]+)\*\*:?$")
BLANK_LINE = re.compile(r"\n\s*\n")
TABLE_RULE = re.compile(r"^\|?\s*:?-{2,}:?\s*(?:\|\s*:?-{2,}:?\s*)*\|?$")
PIPE = re.compile(r"(?<!\\)\|")

# Emoji and pictographs, with their variation selector, joined sequences and the space after.
# A zero-width joiner on its own is left alone: Sinhala needs it to join letters (ශ්‍රී).
_PICTO = "⌀-⏿☀-➿⬀-⯿\U0001f000-\U0001faff"
ICON = re.compile(f"[{_PICTO}]️?(?:‍[{_PICTO}]️?)*[ \t]*")


def without_icons(text: str) -> str:
    """'**💼 Work that suits you**' -> '**Work that suits you**'."""
    return ICON.sub("", text)


def tone(text: str) -> str:
    """What a lead's icon says, as the website reads it (frontend/lib/assistant/explain.ts)."""
    found = ICON.match(text.lstrip("*# ").lstrip())
    if not found:
        return "plain"
    icon = found[0].strip()
    if icon.startswith("⚠"):
        return "attention"
    if icon.startswith("💡"):
        return "tip"
    if icon.startswith("✅"):
        return "good"
    return "plain"


@dataclass(frozen=True)
class Block:
    kind: str  # "paragraph", "lead", "list" or "table"
    spans: tuple[Span, ...] = ()
    tone: str = "plain"  # a lead's: "plain", "tip", "attention" or "good"
    # A list's items, or a table's rows (the first row is the header).
    items: tuple[tuple[Span, ...], ...] = ()
    rows: tuple[tuple[tuple[Span, ...], ...], ...] = ()


def spans(line: str) -> tuple[Span, ...]:
    """'**Lead** rest' -> bold and plain spans. An unclosed ** stays as text."""
    parts = line.split("**")
    if len(parts) % 2 == 0:
        return ((line, False),)
    return tuple((text, index % 2 == 1) for index, text in enumerate(parts) if text)


def _cells(line: str) -> list[str]:
    r"""'| a | b |' -> ['a', 'b']. Outer pipes are optional; an escaped \| stays in its cell."""
    inner = line.strip().removeprefix("|")
    if inner.endswith("|") and not inner.endswith("\\|"):
        inner = inner[:-1]
    return [cell.strip().replace("\\|", "|") for cell in PIPE.split(inner)]


def _table(lines: list[str]) -> Block | None:
    """A header row, a rule of dashes, then rows; every row gets the header's columns."""
    if len(lines) < 2 or not all("|" in line for line in lines) or not TABLE_RULE.match(lines[1]):
        return None
    head = _cells(lines[0])
    rows = [_cells(line) for line in lines[2:]]
    body = tuple(
        tuple(spans(row[i] if i < len(row) else "") for i in range(len(head))) for row in rows
    )
    return Block("table", rows=(tuple(spans(cell) for cell in head), *body))


def _is_table_line(line: str) -> bool:
    return line.startswith("|") or bool(TABLE_RULE.match(line))


def _flush_table(result: list[Block], rows: list[str]) -> None:
    """Moves gathered table lines into the result: a table, or text when they aren't one."""
    if rows:
        result.append(_table(rows) or Block("paragraph", spans(" ".join(rows))))
    rows.clear()


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
    for chunk in BLANK_LINE.split(text.replace("\r\n", "\n")):
        raw = [line.strip() for line in chunk.split("\n") if line.strip()]
        tones = [tone(line) for line in raw]
        lines = [without_icons(line).strip() for line in raw]
        paragraph: list[str] = []
        items: list[tuple[Span, ...]] = []
        rows: list[str] = []
        for line, line_tone in zip(lines, tones, strict=True):
            if not line:
                continue
            if _is_table_line(line):
                if paragraph or items:
                    _flush(result, paragraph, items)
                rows.append(line)
                continue
            _flush_table(result, rows)
            item, heading, lead = ITEM.match(line), HEADING.match(line), LEAD.match(line)
            if item:
                if paragraph:
                    _flush(result, paragraph, items)
                items.append(spans(item[1]))
            elif heading or lead:
                _flush(result, paragraph, items)
                words = heading[1].replace("**", "") if heading else lead[1] if lead else ""
                result.append(Block("lead", ((words, True),), tone=line_tone))
            else:
                if items:
                    _flush(result, paragraph, items)
                paragraph.append(line)
        _flush_table(result, rows)
        _flush(result, paragraph, items)
    return result


@dataclass(frozen=True)
class Part:
    lead: Block
    blocks: tuple[Block, ...]


def parts(items: list[Block]) -> tuple[tuple[Block, ...], tuple[Part, ...]]:
    """A chapter in its pieces, as the page shows it: the short answer it opens with (the blocks
    before the first lead), then each part, a lead with the blocks under it."""
    answer: list[Block] = []
    found: list[tuple[Block, list[Block]]] = []
    for block in items:
        if block.kind == "lead":
            found.append((block, []))
        elif found:
            found[-1][1].append(block)
        else:
            answer.append(block)
    return tuple(answer), tuple(Part(lead, tuple(rest)) for lead, rest in found)
