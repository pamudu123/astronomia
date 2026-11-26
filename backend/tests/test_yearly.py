"""The yearly forecast: stays over 2027, counted from a sign."""

from datetime import timedelta
from itertools import pairwise

import pytest
from fastapi.testclient import TestClient

from app.api import yearly as yearly_api
from app.engine.changes import SRI_LANKA
from app.engine.ephemeris import SwissEphemeris
from app.engine.yearly import year_bounds, year_forecast
from app.engine.zodiac import RASHI, Body
from app.store.orders import OrderStore
from tests.test_api_paid import paid_reports, sign_in

EPHEMERIS = SwissEphemeris()
KANDY = 1241622
BIRTH = {"date": "1995-04-19", "time": "14:35", "place_id": KANDY}  # Simha lagna, Vrischika Moon


def test_stays_cover_the_year_for_every_planet() -> None:
    result = year_forecast(EPHEMERIS, RASHI.index("makara"), 2027)
    start, end = year_bounds(2027)
    for body in (Body.SATURN, Body.JUPITER, Body.RAHU, Body.KETU):
        stays = [s for s in result.stays if s.body is body]
        assert stays[0].start == start and stays[0].from_before
        assert stays[-1].end == end and stays[-1].past_end
        for before, after in pairwise(stays):
            assert before.end == after.start


def test_the_year_matches_the_change_pages() -> None:
    result = year_forecast(EPHEMERIS, RASHI.index("makara"), 2027)
    assert [c.id for c in result.changes] == [
        "jupiter-2027-01",
        "saturn-2027-06",
        "jupiter-2027-06",
        "saturn-2027-10",
        "jupiter-2027-11",
    ]
    jupiter = [(RASHI[s.sign], s.house) for s in result.stays if s.body is Body.JUPITER]
    assert jupiter == [("simha", 8), ("kataka", 7), ("simha", 8), ("kanya", 9)]
    saturn = [(RASHI[s.sign], s.house) for s in result.stays if s.body is Body.SATURN]
    assert saturn == [("meena", 3), ("mesha", 4), ("meena", 3)]
    rahu = [s for s in result.stays if s.body is Body.RAHU]
    assert [(RASHI[s.sign], s.house) for s in rahu] == [("makara", 1)]


def test_house_on_a_day() -> None:
    result = year_forecast(EPHEMERIS, RASHI.index("makara"), 2027)
    july = result.start.replace(month=7)
    assert result.house_on(Body.SATURN, july) == 4
    with pytest.raises(ValueError, match="outside"):
        result.house_on(Body.SATURN, result.end + timedelta(days=1))


def test_only_listed_years() -> None:
    with pytest.raises(ValueError, match="2031"):
        year_forecast(EPHEMERIS, 0, 2031)


def test_the_year_in_sri_lanka_time() -> None:
    start, end = year_bounds(2027)
    assert start.tzinfo is SRI_LANKA and (start.year, end.year) == (2027, 2028)


def test_yearly_endpoint(client: TestClient) -> None:
    response = client.get("/v1/yearly/2027/makara?lang=en")
    assert response.headers["cache-control"] == "public, max-age=3600"
    body = response.json()
    assert (body["year"], body["sign"], body["provisional"]) == (2027, "makara", False)
    saturn = next(p for p in body["planets"] if p["body"] == "saturn")
    assert [s["text"] for s in saturn["stays"]] == [
        "Saturn is in Meena, your 3rd house, until 3 June 2027.",
        "Saturn is in Mesha, your 4th house, from 3 June 2027 to 20 October 2027.",
        "Saturn is in Meena, your 3rd house, from 20 October 2027 to the end of the year.",
    ]
    rahu = next(p for p in body["planets"] if p["body"] == "rahu")
    assert rahu["stays"][0]["text"] == "Rahu is in Makara, your 1st house, all year."
    assert rahu["quiet"] == "Rahu does not change sign this year."
    june = body["months"][5]
    assert june["houses"] == {"saturn": 3, "jupiter": 7, "rahu": 1, "ketu": 7}
    assert june["changes"] == ["saturn-2027-06", "jupiter-2027-06"]
    assert len(body["key_dates"]) == 5


def test_yearly_in_sinhala(client: TestClient) -> None:
    body = client.get("/v1/yearly/2027/makara?lang=si").json()
    rahu = next(p for p in body["planets"] if p["body"] == "rahu")
    assert rahu["stays"][0]["text"] == "රාහු වසර පුරා මකර රාශියේ, ඔබේ 1 වැනි භාවයේ සිටී."
    assert body["months"][0]["name"] == "ජනවාරි"


def test_unknown_year_or_lagna(client: TestClient) -> None:
    assert client.get("/v1/yearly/2026/makara").status_code == 404
    assert client.get("/v1/yearly/2027/leo").status_code == 404
    assert client.post("/v1/yearly/2031/personal", json=BIRTH).status_code == 404


def test_personal_year(client: TestClient) -> None:
    body = client.post("/v1/yearly/2027/personal", json={**BIRTH, "lang": "en"}).json()
    assert body["status"] == "ok"
    assert (body["lagna"]["sign"], body["gochara"]["sign"]) == ("simha", "vrischika")
    # Saturn periods are given only when counting from the Moon sign.
    assert all(k["counted"]["notes"] == [] for k in body["lagna"]["key_dates"])


def test_every_yearly_endpoint_goes_through_the_access_check(client: TestClient) -> None:
    """The paid lock is added in yearly_access(); this proves it would cover everything."""
    from fastapi import HTTPException

    def locked() -> None:
        raise HTTPException(402, "paid")

    client.app.dependency_overrides[yearly_api.yearly_access] = locked  # type: ignore[attr-defined]
    assert client.get("/v1/yearly/2027/makara").status_code == 402
    assert client.post("/v1/yearly/2027/personal", json=BIRTH).status_code == 402
    # Planet change pages stay free.
    assert client.get("/v1/changes/rahu-ketu-2026-12/makara").status_code == 200


def test_your_own_year_is_in_the_full_hadahan_report(
    client: TestClient, orders: OrderStore
) -> None:
    """Paid reports on: "Your own 2027" opens once that hadahan's report is unlocked."""
    orders.create_coupon("pamudu", 100, max_uses=200, max_uses_per_account=10)
    paid_reports(client)
    sign_in(client)
    mine = {**BIRTH, "name": "Nimali"}
    assert client.post("/v1/yearly/2027/personal", json=mine).status_code == 402
    # The lagna pages stay open.
    assert client.get("/v1/yearly/2027/makara").status_code == 200
    report = {"kind": "hadahan", "name": "Nimali", "birth": {**BIRTH, "lang": "en"}}
    unlocked = client.post("/v1/reports/unlock", json={"report": report, "code": "pamudu"})
    assert unlocked.status_code == 200, unlocked.text
    assert "personal_year" in unlocked.json()["access"]["features"]
    assert client.post("/v1/yearly/2027/personal", json={**mine, "lang": "si"}).status_code == 200
    # Someone else's hadahan is not unlocked.
    other = {**mine, "name": "Kasun"}
    assert client.post("/v1/yearly/2027/personal", json=other).status_code == 402
