from fastapi.testclient import TestClient

KANDY = 1241622
BIRTH = {"date": "1995-04-19", "time": "14:35", "place_id": KANDY}  # Simha lagna


def test_a_settled_month_in_english(client: TestClient) -> None:
    body = client.post(
        "/v1/forecast", json={**BIRTH, "lang": "en", "as_of": "2026-11-12T00:00:00Z"}
    ).json()
    assert body["status"] == "ok"
    forecast = body["forecast"]
    assert forecast["provisional"] is True
    assert forecast["rule_set"] == "forecast_v1"
    assert forecast["month"] == {
        "year": 2026,
        "month": 11,
        "title": "November 2026",
        "start": "2026-11-01",
        "end": "2026-11-30",
    }
    planets = {p["body"]: p for p in forecast["planets"]}
    assert list(planets) == ["saturn", "jupiter", "rahu", "ketu"]
    assert planets["jupiter"]["text"] == (
        "Jupiter is in Simha all month, your 1st house from the lagna."
    )
    assert (
        planets["jupiter"]["theme"] == "The 1st house is about yourself and how you begin things."
    )
    assert planets["saturn"]["house"] == 8
    assert all(p["moves"] == [] for p in planets.values())


def test_a_month_with_a_move(client: TestClient) -> None:
    body = client.post(
        "/v1/forecast", json={**BIRTH, "lang": "en", "as_of": "2026-12-20T00:00:00Z"}
    ).json()
    rahu = next(p for p in body["forecast"]["planets"] if p["body"] == "rahu")
    assert rahu["text"] == "Rahu begins the month in Kumbha, your 7th house from the lagna."
    assert rahu["moves"] == [
        {
            "date": "2026-12-05",
            "to_sign": "makara",
            "to_house": 6,
            "text": "On 5 December 2026 it moves into Makara, your 6th house.",
        }
    ]
    assert rahu["theme"].startswith("The 6th house is about")


def test_retrograde_is_mentioned(client: TestClient) -> None:
    # Jupiter is retrograde in January 2027 and steps back into Kataka.
    body = client.post(
        "/v1/forecast", json={**BIRTH, "lang": "en", "as_of": "2027-01-10T00:00:00Z"}
    ).json()
    jupiter = next(p for p in body["forecast"]["planets"] if p["body"] == "jupiter")
    assert jupiter["retrograde"] is True
    assert "moving backwards" in jupiter["text"]
    assert jupiter["moves"][0]["to_sign"] == "kataka"


def test_sinhala(client: TestClient) -> None:
    body = client.post(
        "/v1/forecast", json={**BIRTH, "lang": "si", "as_of": "2026-12-20T00:00:00Z"}
    ).json()
    forecast = body["forecast"]
    assert forecast["month"]["title"].startswith("2026 ")
    text = " ".join(p["text"] + p["theme"] for p in forecast["planets"])
    assert "Rahu" not in text and "house" not in text


def test_a_clock_change_time_returns_the_options(client: TestClient) -> None:
    body = client.post(
        "/v1/forecast",
        json={
            "date": "2025-10-26",
            "time": "01:30",
            "latitude": 51.5,
            "longitude": -0.12,
            "timezone": "Europe/London",
        },
    ).json()
    assert body["status"] == "ambiguous"
    assert body["forecast"] is None
