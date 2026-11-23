"""Every "now" in a request is one instant: it needs an offset, and any offset will do."""

from collections.abc import Callable
from typing import Any

import pytest
from fastapi.testclient import TestClient

KANDY = 1241622
BIRTH = {"date": "1995-04-19", "time": "14:35", "place_id": KANDY}
GROOM = {"date": "1992-08-03", "time": "10:00", "place_id": KANDY}
COUPLE = {"bride": BIRTH, "groom": GROOM}
REPORT = {"kind": "hadahan", "name": ""}

CALLS: dict[str, Callable[[str], dict[str, Any]]] = {
    "/v1/hadahan": lambda now: {**BIRTH, "as_of": now},
    "/v1/forecast": lambda now: {**BIRTH, "as_of": now},
    "/v1/changes/personal": lambda now: {**BIRTH, "as_of": now},
    "/v1/journey": lambda now: {**BIRTH, "as_of": now},
    "/v1/journey/couple": lambda now: {**COUPLE, "as_of": now},
    "/v1/porondam/timeline": lambda now: {**COUPLE, "as_of": now},
    "/v1/reports/pdf": lambda now: {**REPORT, "birth": {**BIRTH, "as_of": now}},
    "/v1/shares": lambda now: {**REPORT, "birth": {**BIRTH, "as_of": now}},
    "/v1/kendara/search": lambda now: {
        "rashi": {"lagna": "mesha", "houses": {"sun": 1}},
        "date": "1995-04-19",
        "as_of": now,
    },
}


@pytest.mark.parametrize("path", CALLS)
def test_a_time_with_no_offset_is_refused(client: TestClient, path: str) -> None:
    response = client.post(path, json=CALLS[path]("2026-11-17T00:00:00"))
    assert response.status_code == 422, response.text
    assert "UTC offset" in response.text


@pytest.mark.parametrize("now", ["0001-01-01T00:00:00+05:30", "9999-12-31T23:59:59-05:30"])
def test_a_time_no_calendar_holds_is_refused(client: TestClient, now: str) -> None:
    response = client.post("/v1/hadahan", json=CALLS["/v1/hadahan"](now))
    assert response.status_code == 422, response.text


# The same instant, on 16 November in UTC and on 17 November in Colombo.
SAME = ["2026-11-16T20:00:00Z", "2026-11-17T01:30:00+05:30"]


@pytest.mark.parametrize("path", [p for p in CALLS if p not in ("/v1/reports/pdf", "/v1/shares")])
def test_two_ways_of_writing_an_instant_give_one_answer(client: TestClient, path: str) -> None:
    first, second = (client.post(path, json=CALLS[path](now)) for now in SAME)
    assert first.status_code == 200, first.text
    assert first.json() == second.json()


def test_the_roads_give_now_with_an_offset(client: TestClient) -> None:
    for now in SAME:
        road = client.post("/v1/journey", json={**BIRTH, "as_of": now}).json()["journey"]
        assert road["now"] == "2026-11-16T20:00:00Z"
        couple = client.post("/v1/journey/couple", json={**COUPLE, "as_of": now}).json()
        assert couple["bride"]["now"] == couple["groom"]["now"] == "2026-11-16T20:00:00Z"


def test_a_pdf_with_an_offset_prints(client: TestClient) -> None:
    response = client.post("/v1/reports/pdf", json=CALLS["/v1/reports/pdf"](SAME[1]))
    assert response.status_code == 200
    assert response.content.startswith(b"%PDF")
