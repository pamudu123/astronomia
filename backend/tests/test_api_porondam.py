from fastapi.testclient import TestClient

KANDY, COLOMBO = 1241622, 1248991
NIMALI = {"name": "Nimali", "date": "1995-04-19", "time": "14:35", "place_id": KANDY}
KASUN = {"name": "Kasun", "date": "1992-08-03", "time": "06:10", "place_id": COLOMBO}


def test_quick_match(client: TestClient) -> None:
    body = client.post(
        "/v1/porondam",
        json={
            "bride": {"nakshatra": "anuradha", "pada": 2},
            "groom": {"nakshatra": "rohini", "pada": 1},
        },
    ).json()
    assert body["status"] == "ok"
    assert body["match"]["score"] == {"passed": 7, "total": 9}
    assert [h["id"] for h in body["match"]["hard_checks"]] == ["rajju", "vedha"]
    assert body["match"]["provisional"] is True
    assert body["kuja"] is None  # needs full birth details
    assert body["bride"]["rashi"] == "vrischika"
    dina = next(f for f in body["match"]["factors"] if f["id"] == "dina")
    assert dina["reason"].startswith("Counting from the bride's star, the groom's is number 15.")


def test_full_match_with_kuja_for_both(client: TestClient) -> None:
    body = client.post("/v1/porondam", json={"bride": NIMALI, "groom": KASUN, "lang": "si"}).json()
    assert body["status"] == "ok"
    assert body["bride"]["mode"] == "full"
    assert body["bride"]["lagna"] == "simha"
    assert body["kuja"]["comparison"] in ("both", "neither", "bride_only", "groom_only")
    assert body["kuja"]["bride"]["present"] is True
    assert "කුජ" in body["kuja"]["reason"]
    assert body["match"]["summary_text"]


def test_mixed_match(client: TestClient) -> None:
    body = client.post(
        "/v1/porondam", json={"bride": NIMALI, "groom": {"nakshatra": "rohini", "pada": 1}}
    ).json()
    assert body["status"] == "ok"
    assert body["groom"]["mode"] == "quick"
    assert body["kuja"] is None


def test_ambiguous_time_says_whose(client: TestClient) -> None:
    groom = {
        "date": "2025-10-26",
        "time": "01:30",
        "latitude": 51.5,
        "longitude": -0.12,
        "timezone": "Europe/London",
    }
    body = client.post("/v1/porondam", json={"bride": NIMALI, "groom": groom}).json()
    assert body["status"] == "ambiguous"
    assert body["waiting_for"] == "groom"
    assert len(body["time"]["options"]) == 2
    assert body["match"] is None


def test_errors(client: TestClient) -> None:
    quick = {"nakshatra": "rohini", "pada": 1}
    assert (
        client.post(
            "/v1/porondam", json={"bride": {"nakshatra": "pluto", "pada": 1}, "groom": quick}
        ).status_code
        == 422
    )
    assert (
        client.post(
            "/v1/porondam", json={"bride": {"nakshatra": "rohini", "pada": 5}, "groom": quick}
        ).status_code
        == 422
    )
    assert client.post("/v1/porondam", json={"bride": quick}).status_code == 422
    unknown = {**NIMALI, "place_id": 999999999}
    assert client.post("/v1/porondam", json={"bride": unknown, "groom": quick}).status_code == 404
