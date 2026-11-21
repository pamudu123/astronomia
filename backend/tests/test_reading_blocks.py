"""The AI reading's markdown in a PDF (app/reports/reading.py)."""

from app.reports.reading import Block, blocks, without_icons


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
        Block("lead", (("Take care", True),)),
        Block("lead", (("Abroad", True),)),
    ]


def test_joined_emoji_go_whole_and_sinhala_keeps_its_joiner() -> None:
    assert without_icons("👨‍👩‍👧 Family") == "Family"
    # ශ්‍රී is joined with a zero-width joiner, which must stay.
    sri = "ශ්‍රී"
    assert without_icons(f"**🏠 {sri} ලංකාව**") == f"**{sri} ලංකාව**"
    assert without_icons("Plain text, a list • and → arrows") == "Plain text, a list • and → arrows"
