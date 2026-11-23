"""The AI reading's markdown in a PDF (app/reports/reading.py)."""

from app.reports.reading import Block, blocks, parts, tone, without_icons


def test_icons_on_bold_leads_are_left_out_of_the_pdf() -> None:
    """The report's fonts have no emoji: a lead prints as its words, still a lead."""
    text = (
        "You meet life warmly.\n\n**💼 Work that suits you**\n\nSteady roles.\n\n"
        "**⚠️ Take care**\n\n**✈️ Abroad**"
    )
    assert blocks(text) == [
        Block("paragraph", (("You meet life warmly.", False),)),
        Block("lead", (("Work that suits you", True),)),
        Block("paragraph", (("Steady roles.", False),)),
        Block("lead", (("Take care", True),), tone="attention"),
        Block("lead", (("Abroad", True),)),
    ]


def test_a_small_table_prints_as_a_table_with_every_row_as_wide_as_its_header() -> None:
    text = (
        "Three stretches.\n| Period | Dates |\n|---|:--:|\n"
        "| **Mercury** | 2026 to 2028 |\n| Ketu |\n\nAfter."
    )
    assert blocks(text) == [
        Block("paragraph", (("Three stretches.", False),)),
        Block(
            "table",
            rows=(
                ((("Period", False),), (("Dates", False),)),
                ((("Mercury", True),), (("2026 to 2028", False),)),
                ((("Ketu", False),), ()),
            ),
        ),
        Block("paragraph", (("After.", False),)),
    ]


def test_lines_that_only_look_like_a_table_stay_text() -> None:
    assert blocks("| Period | Dates |") == [Block("paragraph", (("| Period | Dates |", False),))]
    table = blocks("| a | b |\n|---|---|\n| x \\| y | z |")[0]
    assert table.rows[1][0] == (("x | y", False),)


def test_joined_emoji_go_whole_and_sinhala_keeps_its_joiner() -> None:
    assert without_icons("👨‍👩‍👧 Family") == "Family"
    # ශ්‍රී is joined with a zero-width joiner, which must stay.
    sri = "ශ්‍රී"
    assert without_icons(f"**🏠 {sri} ලංකාව**") == f"**{sri} ලංකාව**"
    assert without_icons("Plain text, a list • and → arrows") == "Plain text, a list • and → arrows"


def test_a_leads_icon_gives_its_tone() -> None:
    """What the page tints, the report tints too: tips, cautions and good news."""
    assert tone("**💡 A tip**") == "tip"
    assert tone("**⚠️ Take care**") == "attention"
    assert tone("**✅ Strengths**") == "good"
    assert tone("**💼 Work**") == "plain"
    assert tone("**Plain lead**") == "plain"


def test_a_chapter_splits_into_its_short_answer_and_parts() -> None:
    answer, found = parts(blocks("In short.\n\n**💡 A tip**\nRest.\n\n**Then**\n- one"))
    assert answer == (Block("paragraph", (("In short.", False),)),)
    assert [(p.lead.spans[0][0], p.lead.tone, len(p.blocks)) for p in found] == [
        ("A tip", "tip", 1),
        ("Then", "plain", 1),
    ]
