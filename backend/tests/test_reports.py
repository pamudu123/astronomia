"""The PDF report helpers: dates, degrees, the kendara layout and the page header text."""

import datetime as dt

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
