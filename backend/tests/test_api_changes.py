import json
from pathlib import Path

from fastapi.testclient import TestClient

KANDY = 1241622
BIRTH = {"date": "1995-04-19", "time": "14:35", "place_id": KANDY}  # Simha lagna, Vrischika Moon
FIXTURES = Path(__file__).resolve().parents[2] / "frontend" / "tests" / "e2e" / "fixtures"


def test_the_list(client: TestClient) -> None:
    response = client.get("/v1/changes?lang=en")
    assert response.headers["cache-control"] == "public, max-age=3600"
    body = response.json()
    assert body["provisional"] is True
    assert [c["id"] for c in body["changes"]] == [
        "rahu-ketu-2026-12",
        "jupiter-2027-01",
        "saturn-2027-06",
        "jupiter-2027-06",
        "saturn-2027-10",
        "jupiter-2027-11",
    ]
    first = body["changes"][0]
    assert first["title"] == "Rahu and Ketu change"
    assert first["when"] == "5 December 2026, 22:32 Sri Lanka time"
    assert first["moment"] == "2026-12-05T17:02:00Z"
    assert first["moves"][0]["text"] == "Rahu moves from Kumbha into Makara."
    assert first["moves"][0]["until_text"] == (
        "Rahu stays in Makara until 24 June 2028, when it moves into Dhanu."
    )


def test_the_frontend_list_matches(client: TestClient) -> None:
    """The saved fixture is what the frontend's page list is checked against."""
    for lang in ("en", "si"):
        saved = json.loads((FIXTURES / f"changes-{lang}.json").read_text(encoding="utf-8"))
        assert saved == client.get(f"/v1/changes?lang={lang}").json(), lang


def test_a_backward_step_in_sinhala(client: TestClient) -> None:
    body = client.get("/v1/changes?lang=si").json()
    jupiter = next(c for c in body["changes"] if c["id"] == "jupiter-2027-01")
    assert jupiter["title"] == "ගුරු මාරුව"
    assert jupiter["moves"][0]["retrograde"] is True
    assert jupiter["moves"][0]["text"] == "ගුරු වක්‍රව සිංහ රාශියේ සිට කටක රාශියට ආපසු පැමිණේ."


def test_the_hub_has_twelve_lagnas(client: TestClient) -> None:
    response = client.get("/v1/changes/rahu-ketu-2026-12?lang=en")
    assert response.headers["cache-control"] == "public, max-age=3600"
    body = response.json()
    assert [row["sign"] for row in body["lagnas"]][:2] == ["mesha", "vrishabha"]
    assert len(body["lagnas"]) == 12
    assert body["lagnas"][0]["moves"][0]["short"] == "Rahu: 11th house to 10th house"


def test_one_lagna(client: TestClient) -> None:
    body = client.get("/v1/changes/rahu-ketu-2026-12/makara?lang=en").json()
    lagna = body["lagna"]
    assert lagna["sign_name"] == "Makara"
    rahu, ketu = lagna["moves"]
    assert rahu["text"] == "Rahu leaves your 2nd house and enters your 1st house."
    assert rahu["to_theme"] == "The 1st house is about yourself and how you begin things."
    assert (ketu["from_house"], ketu["to_house"]) == (8, 7)
    assert [o["text"] for o in lagna["others"]] == [
        "Saturn stays in Meena, your 3rd house.",
        "Jupiter stays in Simha, your 8th house.",
    ]


def test_unknown_change_or_lagna(client: TestClient) -> None:
    assert client.get("/v1/changes/rahu-ketu-1999-01").status_code == 404
    assert client.get("/v1/changes/rahu-ketu-2026-12/leo").status_code == 404
    assert client.get("/v1/changes/rahu-ketu-1999-01/makara").status_code == 404
    response = client.post("/v1/changes/nothing/personal", json=BIRTH)
    assert response.status_code == 404


def test_personal_change_from_lagna_and_moon(client: TestClient) -> None:
    response = client.post("/v1/changes/rahu-ketu-2026-12/personal", json={**BIRTH, "lang": "en"})
    assert "1995" not in str(response.url)
    body = response.json()
    assert body["status"] == "ok"
    assert body["lagna"]["sign"] == "simha"
    assert [(m["from_house"], m["to_house"]) for m in body["lagna"]["moves"]] == [(7, 6), (1, 12)]
    assert body["gochara"]["sign"] == "vrischika"
    assert [(m["from_house"], m["to_house"]) for m in body["gochara"]["moves"]] == [(4, 3), (10, 9)]
    assert "cache-control" not in response.headers


def test_upcoming_changes_for_the_hadahan(client: TestClient) -> None:
    body = client.post(
        "/v1/changes/personal", json={**BIRTH, "lang": "en", "as_of": "2026-11-13T00:00:00Z"}
    ).json()
    assert (body["lagna"], body["moon_sign"]) == ("simha", "vrischika")
    # The next twelve months: everything up to 13 November 2027.
    assert [c["change"]["id"] for c in body["changes"]] == [
        "rahu-ketu-2026-12",
        "jupiter-2027-01",
        "saturn-2027-06",
        "jupiter-2027-06",
        "saturn-2027-10",
    ]
    first = body["changes"][0]
    assert first["lagna"]["moves"][0]["to_house"] == 6
    assert first["gochara"]["moves"][0]["to_house"] == 3


def test_upcoming_after_a_change_leaves_it_out(client: TestClient) -> None:
    body = client.post(
        "/v1/changes/personal", json={**BIRTH, "as_of": "2026-12-06T00:00:00Z"}
    ).json()
    assert body["changes"][0]["change"]["id"] == "jupiter-2027-01"


def test_a_clock_change_time_returns_the_options(client: TestClient) -> None:
    birth = {
        "date": "2025-10-26",
        "time": "01:30",
        "latitude": 51.5,
        "longitude": -0.12,
        "timezone": "Europe/London",
    }
    body = client.post("/v1/changes/personal", json=birth).json()
    assert body["status"] == "ambiguous"
    assert body["changes"] == []
    one = client.post("/v1/changes/rahu-ketu-2026-12/personal", json=birth).json()
    assert one["status"] == "ambiguous"
    assert one["lagna"] is None and one["gochara"] is None


def test_a_backward_step_and_its_return_are_explained(client: TestClient) -> None:
    body = client.get("/v1/changes?lang=en").json()
    moves = {c["id"]: c["moves"][0] for c in body["changes"]}
    assert moves["jupiter-2027-01"]["note"] == (
        "Jupiter is moving backwards (retrograde), so this is a short stay. "
        "It returns to Simha on 26 June 2027."
    )
    assert moves["jupiter-2027-06"]["returning"] is True
    assert moves["jupiter-2027-06"]["note"] == "Jupiter returns to Simha after its backward step."
    assert moves["saturn-2027-06"]["note"] is None
    assert body["changes"][0]["moves"][0]["note"] is None  # Rahu


def test_saturn_periods_for_a_moon_sign(client: TestClient) -> None:
    body = client.get("/v1/changes/saturn-2027-06/vrishabha?lang=en").json()
    assert body["moon_notes"] == [
        "Erashtaka begins: Saturn enters the 12th, 1st or 2nd sign from the Moon."
    ]
    assert body["lagna"]["notes"] == []  # counted from the lagna, no Saturn periods


def test_gochara_carries_the_saturn_periods(client: TestClient) -> None:
    # Vrischika Moon: Saturn moves from the 5th to the 6th, so no period starts or ends.
    body = client.post("/v1/changes/saturn-2027-06/personal", json={**BIRTH, "lang": "si"}).json()
    assert body["gochara"]["notes"] == []
    assert body["lagna"]["notes"] == []
    assert [(m["from_house"], m["to_house"]) for m in body["gochara"]["moves"]] == [(5, 6)]
