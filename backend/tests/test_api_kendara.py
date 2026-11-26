import pytest
from fastapi.testclient import TestClient

from app.kendara import search as engine

# Nimali's chart (the first golden chart): born 19 April 1995, 14:35 in Kandy.
# Lagna Simha. Houses counted from Simha.
NIMALI = {
    "lagna": "simha",
    "houses": {
        "sun": 9,  # Mesha
        "moon": 4,  # Vrischika
        "mars": 12,  # Kataka
        "mercury": 9,  # Mesha
        "jupiter": 4,  # Vrischika
        "venus": 8,  # Meena
        "saturn": 7,  # Kumbha
        "rahu": 3,  # Tula
        "ketu": 9,  # Mesha
    },
}
KANDY = 1241622
AS_OF = "2026-11-13T00:00:00Z"


def post(client: TestClient, **body: object) -> dict:  # type: ignore[type-arg]
    response = client.post("/v1/kendara/search", json={"as_of": AS_OF, **body})
    assert response.status_code == 200, response.text
    data: dict = response.json()  # type: ignore[type-arg]
    return data


def test_search_finds_the_birth(client: TestClient) -> None:
    body = post(client, rashi=NIMALI, place_id=KANDY)
    assert body["status"] == "ok"
    assert body["rule_set"] == "kendara_v1"
    assert body["place"]["name"] == "Kandy"
    assert body["first"] == "1900-01-01"
    hits = [
        m
        for m in body["matches"]
        if m["start"]["local"] <= "1995-04-19T14:35:00+05:30" <= m["end"]["local"]
    ]
    assert len(hits) == 1
    hit = hits[0]
    assert hit["grade"] == "exact"
    assert hit["near"] == []
    assert hit["text"].startswith("19 April 1995, ")
    assert "jyeshtha" in [star["nakshatra"] for star in hit["stars"]]
    assert not body["cut_off"]


def test_planets_not_on_the_paper_are_left_out(client: TestClient) -> None:
    # Old papers sometimes leave planets out. The search still finds the birth, only less narrowly.
    houses: dict[str, int] = NIMALI["houses"]  # type: ignore[assignment]
    partial = {"lagna": "simha", "houses": {k: houses[k] for k in ("sun", "moon", "saturn")}}
    body = post(client, rashi=partial, place_id=KANDY, year_from=1995, year_to=1995)
    assert body["status"] == "ok"
    birth = "1995-04-19T14:35:00+05:30"
    assert any(m["start"]["local"] <= birth <= m["end"]["local"] for m in body["matches"])
    full = post(client, rashi=NIMALI, place_id=KANDY, year_from=1995, year_to=1995)
    assert len(full["matches"]) <= len(body["matches"])


def test_navamsha_and_star_narrow_the_result(client: TestClient) -> None:
    plain = post(client, rashi=NIMALI, place_id=KANDY)
    by_star = post(client, rashi=NIMALI, place_id=KANDY, nakshatra="jyeshtha")
    assert 0 < len(by_star["matches"]) <= len(plain["matches"])
    assert all(s["nakshatra"] == "jyeshtha" for m in by_star["matches"] for s in m["stars"])
    by_years = post(client, rashi=NIMALI, place_id=KANDY, year_from=1990, year_to=1999)
    assert all(m["start"]["date"].startswith("199") for m in by_years["matches"])
    assert (by_years["first"], by_years["last"]) == ("1990-01-01", "2000-01-01")
    by_date = post(client, rashi=NIMALI, place_id=KANDY, date="1995-04-19")
    assert len(by_date["matches"]) == 1
    assert by_date["matches"][0]["start"]["date"] == "1995-04-19"


def test_the_navamsha_drawing(client: TestClient) -> None:
    from datetime import UTC, datetime

    from app.api.charts import EPHEMERIS
    from app.engine.chart import compute_chart
    from app.engine.zodiac import BODIES, RASHI

    chart = compute_chart(EPHEMERIS, datetime(1995, 4, 19, 9, 5, tzinfo=UTC), 7.2906, 80.6337)
    navamsha = {
        "lagna": RASHI[chart.lagna.navamsha_sign],
        "houses": {b.value: chart.planets[b].navamsha_house for b in BODIES},
    }
    body = post(client, rashi=NIMALI, navamsha=navamsha, place_id=KANDY)
    assert len(body["matches"]) == 1
    assert body["matches"][0]["minutes"] < 30


def test_an_impossible_drawing_says_why(client: TestClient) -> None:
    wrong = {**NIMALI, "houses": {**NIMALI["houses"], "ketu": 8, "mercury": 3}}  # type: ignore[dict-item]
    body = post(client, rashi=wrong, lang="si")
    assert body["status"] == "impossible"
    assert body["matches"] == []
    assert len(body["problems"]) == 2
    assert "රාහු" in body["problems"][0]


def test_no_match_and_a_place_by_coordinates(client: TestClient) -> None:
    body = post(
        client,
        rashi={"lagna": "mesha", "houses": {"sun": 1, "mercury": 2, "venus": 12}},
        latitude=51.5,
        longitude=-0.12,
        timezone="Europe/London",
        date="2000-07-01",
    )
    assert body["status"] == "ok"
    assert body["matches"] == []
    assert body["note"].startswith("No birth from 1900")
    assert body["place"]["timezone"] == "Europe/London"


SUN_ONLY = {"lagna": "mesha", "houses": {"sun": 1}}


def set_limits(monkeypatch: pytest.MonkeyPatch, **limits: float) -> None:
    rules = {**engine.load_rules(), **limits}
    monkeypatch.setattr(engine, "load_rules", lambda: rules)


def test_a_drawing_with_few_planets_is_cut_off(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    # Far longer than a slow machine needs, so only the number of matches can stop it.
    set_limits(monkeypatch, time_limit_seconds=600)
    body = post(client, rashi=SUN_ONLY)
    assert body["cut_off"] is True
    assert len(body["matches"]) == 50
    assert body["note"] == (
        "There are more matches than the 50 shown. "
        "Give a year range or the birth star to narrow them."
    )


def test_too_many_for_one_star_does_not_ask_for_the_star(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    set_limits(monkeypatch, time_limit_seconds=600, max_matches=2)
    body = post(client, rashi=SUN_ONLY, nakshatra="rohini")
    assert body["cut_off"] is True
    assert len(body["matches"]) == 2
    assert all(s["nakshatra"] == "rohini" for m in body["matches"] for s in m["stars"])
    assert "or the birth star" not in body["note"]
    assert "Give a year range" in body["note"]


def test_running_out_of_time_says_how_far_it_got(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    set_limits(monkeypatch, time_limit_seconds=-1)
    body = post(client, rashi=SUN_ONLY)
    assert body["cut_off"] is True and body["matches"] == []
    assert body["note"].startswith("The search took too long and stopped at ")
    assert "1900" in body["note"]
    assert "සෙවීමට" in post(client, rashi=SUN_ONLY, lang="si")["note"]


def test_bad_input_is_refused(client: TestClient) -> None:
    for bad in (
        {"rashi": {"lagna": "aries", "houses": {}}},
        {"rashi": {"lagna": "mesha", "houses": {"sun": 13}}},
        {"rashi": NIMALI, "year_from": 1990, "year_to": 1980},
        {"rashi": NIMALI, "nakshatra": "polaris"},
        {"rashi": NIMALI, "place_id": KANDY, "timezone": "Asia/Colombo"},
    ):
        assert client.post("/v1/kendara/search", json=bad).status_code == 422


def test_the_paid_lock_goes_in_one_place(client: TestClient) -> None:
    from fastapi import HTTPException

    from app.api.kendara import kendara_access

    def locked() -> None:
        raise HTTPException(402, "paid")

    client.app.dependency_overrides[kendara_access] = locked  # type: ignore[attr-defined]
    assert client.post("/v1/kendara/search", json={"rashi": NIMALI}).status_code == 402
    assert client.get("/v1/labels/en").status_code == 200
