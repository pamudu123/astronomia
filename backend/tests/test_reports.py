"""The PDF report helpers: dates, degrees, the kendara layout and the page header text."""

import datetime as dt
import itertools

import pytest

from app.geo.search import Place
from app.reports.format import format_date, format_degree, place_line
from app.reports.kendara import HOUSE_CENTRES, planet_labels
from app.reports.render import css_string, page_counter

SHORT = {"sun": "Su", "moon": "Mo", "mars": "Ma", "jupiter": "Ju", "venus": "Ve", "saturn": "Sa"}


def test_dates_in_both_languages() -> None:
    day = dt.date(1995, 4, 19)
    assert format_date(day, "en") == "19 April 1995"
    assert format_date(day, "si") == "1995 අප්‍රේල් 19"


@pytest.mark.parametrize(
    ("degree", "text"),
    [(21.254, "21\u00b0 15\u2032"), (5.0, "5\u00b0 00\u2032"), (9.9999, "10\u00b0 00\u2032")],
)
def test_degrees(degree: float, text: str) -> None:
    assert format_degree(degree) == text


def test_place_line_prefers_sinhala_names() -> None:
    place = Place(
        id=1,
        name="Kandy",
        name_si="මහනුවර",
        country_code="LK",
        country_name="Sri Lanka",
        country_name_si="ශ්‍රී ලංකාව",
        region="Central Province",
        region_si=None,
        latitude=7.29,
        longitude=80.63,
        timezone="Asia/Colombo",
        population=1,
    )
    assert place_line(place, "en") == "Kandy, Central Province, Sri Lanka"
    assert place_line(place, "si").startswith("මහනුවර, Central")


def test_every_house_has_a_label_position() -> None:
    labels = planet_labels([("sun", h) for h in range(1, 13)], {"sun": "Su"})
    assert len(labels) == 12
    for label, (x, y) in zip(labels, HOUSE_CENTRES.values(), strict=True):
        assert label.left == round(100 * x / 300, 2)
        # House 1 is moved down a little, below the lagna mark.
        assert label.top == round(100 * (y + (8 if label is labels[0] else 0)) / 300, 2)


def test_planets_in_one_house_are_stacked() -> None:
    labels = planet_labels([("sun", 4), ("moon", 4), ("mars", 4)], SHORT, highlight="moon")
    assert [label.text for label in labels] == ["Su", "Mo", "Ma"]
    assert len({label.left for label in labels}) == 1
    assert labels[0].top < labels[1].top < labels[2].top
    assert [label.highlight for label in labels] == [False, True, False]


def test_a_crowded_square_house_uses_two_columns() -> None:
    labels = planet_labels([(body, 7) for body in SHORT], SHORT)
    assert len({label.left for label in labels}) == 2


def test_header_and_footer_text_is_a_safe_css_string() -> None:
    assert css_string('Say "hi" \\ there') == '"Say \\"hi\\" \\\\ there"'
    assert page_counter("Page {page} of {pages}") == ('"Page " counter(page) " of " counter(pages)')
    assert page_counter("{page} / {pages}") == 'counter(page) " / " counter(pages)'


def test_crowded_planets_fan_out_around_where_they_are() -> None:
    from app.reports.visuals import spread

    shown = spread([55, 60.5, 62.2, 200], 15)
    assert shown[0] < shown[1] < shown[2]
    assert round(shown[1] - shown[0], 6) == round(shown[2] - shown[1], 6) == 15
    assert shown[3] == 200
    # Across 0 degrees, and a full circle shared evenly.
    assert [round(a, 1) for a in spread([350, 355, 2], 15)] == [340.7, 355.7, 10.7]
    full = sorted(spread([90.0] * 30, 15))
    assert all(round(b - a, 6) == 12 for a, b in itertools.pairwise(full))


def test_the_sky_wheel_puts_each_planet_name_over_it() -> None:
    from app.reports.visuals import Placed, sky_wheel

    wheel = sky_wheel(130.0, [Placed("sun", "Su", 130.0), Placed("moon", "Mo", 310.0)])
    tags = wheel.tags
    assert [tag.text for tag in tags] == ["Su", "Mo"]
    # The lagna is on the left, so a planet on it sits left of the centre, the Moon right.
    assert tags[0].left < 50 < tags[1].left
    assert tags[1].kind == "moon"
    assert "<text" in wheel.svg  # only numbers go inside the SVG


def test_the_periods_bar_marks_today_inside_it() -> None:
    from app.reports.visuals import Span, periods_bar

    birth = dt.date(2000, 1, 1)
    spans = [
        Span("Ketu", dt.date(1995, 1, 1), dt.date(2005, 1, 1)),
        Span("Venus", dt.date(2005, 1, 1), dt.date(2025, 1, 1), now=True),
    ]
    bar = periods_bar(birth, spans, dt.date(2020, 1, 1), "Today")
    today = [tag for tag in bar.tags if tag.kind == "now"]
    assert len(today) == 1 and 75 < today[0].left < 85
    gone = periods_bar(birth, spans, dt.date(2040, 1, 1), "Today")
    assert not [tag for tag in gone.tags if tag.kind == "now"]


def test_every_picture_a_report_prints_exists() -> None:
    from app.engine.zodiac import RASHI
    from app.reports import artwork

    allowed = set(artwork.art_files())
    for chapter in [*artwork.CHAPTER_ART, None, "chart.future"]:
        assert artwork.chapter_uri(chapter) in allowed, chapter
    for sign in RASHI:
        assert artwork.rashi_uri(sign) in allowed, sign
    for uri in artwork.section_uris().values():
        assert uri in allowed, uri
    for name in ("cover-hadahan", "cover-porondam", "back-cover"):
        assert artwork.cover_uri(name) in allowed, name
    assert all(path.exists() for path in artwork.art_files().values())


def test_a_chapter_picture_is_on_the_paper_colour() -> None:
    """Laid on the page's own colour, so no box shows around it (report.css)."""
    from PIL import Image

    from app.reports.artwork import ART_DIR

    for path in sorted((ART_DIR / "chapters").glob("*.jpg")):
        corner = Image.open(path).convert("RGB").getpixel((3, 3))
        assert isinstance(corner, tuple)
        assert all(abs(a - b) <= 2 for a, b in zip(corner, (251, 248, 241), strict=True)), path
