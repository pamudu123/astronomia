"""Avurudu: the new year moment and punya kalaya against the official lists 2022 to 2027.

Sources (docs/11-nakath-rules.md): the official lists reported by Ada Derana for 2022 to 2026,
the 2027 list released on 25 August 2026, and ozlanka.com's 2025 times for Australia.
"""

from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient

from app.engine.avurudu import avurudu, load_rules, official_years
from app.engine.ephemeris import SwissEphemeris

EPHEMERIS = SwissEphemeris()
SL = timezone(timedelta(hours=5, minutes=30))

# (year, official dawn, official punya kalaya start, end), Sri Lanka time.
OFFICIAL = [
    (2022, "2022-04-14 08:41", "2022-04-14 02:17", "2022-04-14 15:05"),
    (2023, "2023-04-14 14:59", "2023-04-14 08:35", "2023-04-14 21:23"),
    (2024, "2024-04-13 21:05", "2024-04-13 14:41", "2024-04-14 03:29"),
    (2025, "2025-04-14 03:21", "2025-04-13 20:57", "2025-04-14 09:45"),
    (2026, "2026-04-14 09:32", "2026-04-14 03:08", "2026-04-14 15:56"),
    (2027, "2027-04-14 15:29", "2027-04-14 09:05", "2027-04-14 21:53"),
]


def _sl(text: str) -> datetime:
    return datetime.fromisoformat(text).replace(tzinfo=SL)


@pytest.mark.parametrize(("year", "dawn", "start", "end"), OFFICIAL)
def test_calculated_times_match_the_official_list(
    year: int, dawn: str, start: str, end: str
) -> None:
    result = avurudu(EPHEMERIS, year)
    assert abs(result.dawn - _sl(dawn)) <= timedelta(minutes=1)
    assert abs(result.punya_start - _sl(start)) <= timedelta(minutes=1)
    assert abs(result.punya_end - _sl(end)) <= timedelta(minutes=1)


@pytest.mark.parametrize(("year", "dawn", "start", "end"), OFFICIAL)
def test_punya_kalaya_is_6_hours_24_minutes_either_side_in_every_official_list(
    year: int, dawn: str, start: str, end: str
) -> None:
    assert _sl(dawn) - _sl(start) == timedelta(hours=6, minutes=24)
    assert _sl(end) - _sl(dawn) == timedelta(hours=6, minutes=24)


def test_the_rule_file_holds_the_same_official_times() -> None:
    for year, dawn, start, end in OFFICIAL:
        result = avurudu(EPHEMERIS, year)
        dawn_item, punya = result.official_item("dawn"), result.official_item("punya_kalaya")
        assert dawn_item is not None and punya is not None
        assert dawn_item.at == _sl(dawn)
        assert (punya.start, punya.end) == (_sl(start), _sl(end))


def test_the_2027_list() -> None:
    result = avurudu(EPHEMERIS, 2027)
    keys = [item.key for item in result.official]
    assert keys == [
        "moon_lunar", "moon_solar", "bath_old_year", "dawn", "punya_kalaya", "cooking",
        "work_meals", "anointing_oil", "leaving_for_work", "planting",
    ]  # fmt: skip
    cooking = result.official_item("cooking")
    assert cooking is not None and cooking.at == _sl("2027-04-14 18:18")
    assert (cooking.colour, cooking.direction) == ("green", "north")
    assert result.source and "25 August 2026" in result.source


def test_a_year_without_a_list_is_only_calculated() -> None:
    result = avurudu(EPHEMERIS, 2028)
    assert result.official == () and result.source is None
    assert result.dawn.astimezone(SL).strftime("%Y-%m-%d %H:%M") == "2028-04-13 21:44"


def test_every_listed_item_has_names_and_colours() -> None:
    from app.explain.labels import labels

    for lang in ("en", "si"):
        table = labels(lang)
        for year in official_years():
            for item in avurudu(EPHEMERIS, year).official:
                assert item.key in table["avurudu"]["item"]
                if item.colour:
                    assert item.colour in table["avurudu"]["colour"]
                if item.direction:
                    assert item.direction in table["direction"]


def test_years_out_of_range() -> None:
    with pytest.raises(ValueError, match="1900"):
        avurudu(EPHEMERIS, 1900)
    assert load_rules()["punya_kalaya_minutes"] == 384


# ---------- the endpoint ----------


def test_avurudu_in_london(client: TestClient) -> None:
    response = client.get("/v1/avurudu/2027", params={"timezone": "Europe/London"})
    assert response.headers["cache-control"] == "public, max-age=3600"
    body = response.json()
    assert (body["official"], body["offset"], body["timezone"]) == (
        True,
        "UTC+01:00",
        "Europe/London",
    )
    dawn = body["calculated"]["dawn"]
    assert dawn["sri_lanka"]["local"] == "2027-04-14T15:29:00+05:30"
    assert dawn["local"]["local"] == "2027-04-14T10:59:00+01:00"
    assert body["calculated"]["dawn_difference"] == 0
    cooking = next(item for item in body["items"] if item["key"] == "cooking")
    assert cooking["at"]["local"]["clock"] == "13:48"
    assert cooking["text"].endswith("Dress in green and face north.")
    moon = body["items"][0]
    assert (moon["at"], moon["date"], moon["date_text"]) == (None, "2027-04-09", "9 April 2027")


def test_the_same_moment_in_australia_as_the_2025_australian_list(client: TestClient) -> None:
    """ozlanka.com's 2025 list gives the dawn as 7:51 AM AEST and punya kalaya from 1:27 AM."""
    body = client.get("/v1/avurudu/2025", params={"timezone": "Australia/Sydney"}).json()
    official_dawn = next(item for item in body["items"] if item["key"] == "dawn")
    assert official_dawn["at"]["local"]["clock"] == "07:51"
    punya = next(item for item in body["items"] if item["key"] == "punya_kalaya")
    assert punya["start"]["local"]["clock"] == "01:27"


def test_a_year_without_a_list_says_so_in_sinhala(client: TestClient) -> None:
    body = client.get("/v1/avurudu/2028", params={"lang": "si"}).json()
    assert body["official"] is False and body["items"] == []
    assert "නිල නොවේ" in body["notes"][1]
    assert body["calculated"]["dawn_difference"] is None


def test_past_years_show_how_close_we_are(client: TestClient) -> None:
    differences = {
        year: client.get(f"/v1/avurudu/{year}").json()["calculated"]["dawn_difference"]
        for year in range(2022, 2028)
    }
    assert all(abs(d) <= 1 for d in differences.values())


def test_bad_input(client: TestClient) -> None:
    assert client.get("/v1/avurudu/1800").status_code == 404
    assert client.get("/v1/avurudu/2027", params={"timezone": "Mars/Base"}).status_code == 422
