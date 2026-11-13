"""POST /v1/reports/pdf: the hadahan and porondam reports as PDF files."""

import io
from typing import Any

import pytest
from fastapi.testclient import TestClient
from pypdf import PdfReader

KANDY = 1241622
AS_OF = "2026-11-12T00:00:00Z"
NIMALI = {"date": "1995-04-19", "time": "14:35", "place_id": KANDY}
KASUN = {"date": "1992-08-03", "time": "10:00", "place_id": KANDY}
A4 = (595, 842)  # points


def hadahan(lang: str = "en", name: str = "Nimali", **birth: Any) -> dict[str, Any]:
    return {
        "kind": "hadahan",
        "name": name,
        "birth": {**NIMALI, "lang": lang, "as_of": AS_OF, **birth},
    }


def porondam(bride: dict[str, Any], groom: dict[str, Any], lang: str = "en") -> dict[str, Any]:
    return {"kind": "porondam", "match": {"bride": bride, "groom": groom, "lang": lang}}


def read(content: bytes) -> PdfReader:
    return PdfReader(io.BytesIO(content))


def text(reader: PdfReader) -> str:
    return "\n".join(page.extract_text() for page in reader.pages)


def fonts(reader: PdfReader) -> set[str]:
    found = set()
    for page in reader.pages:
        resources: Any = page["/Resources"]
        for font in resources.get("/Font", {}).values():
            found.add(str(font.get_object()["/BaseFont"]).split("+", 1)[-1])
    return found


def post(client: TestClient, body: dict[str, Any]) -> PdfReader:
    response = client.post("/v1/reports/pdf", json=body)
    assert response.status_code == 200, response.text
    assert response.headers["content-type"] == "application/pdf"
    assert response.headers["cache-control"] == "no-store"
    assert response.content.startswith(b"%PDF")
    return read(response.content)


def test_hadahan_report_in_english(client: TestClient) -> None:
    response = client.post("/v1/reports/pdf", json=hadahan())
    assert response.headers["content-disposition"] == (
        'attachment; filename="astronomia-hadahan.pdf"'
    )
    reader = read(response.content)
    assert len(reader.pages) == 2
    for page in reader.pages:
        assert (round(float(page.mediabox.width)), round(float(page.mediabox.height))) == A4

    content = text(reader)
    for expected in (
        "Nimali's hadahan",
        "Born 19 April 1995 at 14:35",
        "Kandy",
        "Simha (Leo)",
        "Jyeshtha, pada 4",
        "Rashi chart",
        "Navamsha chart",
        "The nine planets",
        "Main dasha periods",
        "Running now",
        "Cancellation checks",
        "Mars is in the 12th house counted from the lagna.",
        "Page 1 of 2",
    ):
        assert expected in content, expected

    last = reader.pages[-1].extract_text()
    assert "For guidance and cultural interest" in last
    assert "Lahiri ayanamsa" in last
    assert "kuja_v1" in last
    assert "provisional" in last
    assert "Made on 12 November 2026." in last


def test_hadahan_report_in_sinhala_uses_sinhala_fonts(client: TestClient) -> None:
    reader = post(client, hadahan("si", name="නිමාලි"))
    assert len(reader.pages) == 2
    assert {"Noto-Sans-Sinhala", "Noto-Sans-Sinhala-Semi-Bold"} <= fonts(reader)
    assert "Simha" not in text(reader)


def test_the_name_prints_as_plain_text(client: TestClient) -> None:
    reader = post(client, hadahan(name='<img src="file:///etc/passwd"> & <b>Ann</b>'))
    assert '<img src="file:///etc/passwd"> & <b>Ann</b>' in text(reader).replace("\n", " ")


def test_a_birth_by_coordinates_prints_them(client: TestClient) -> None:
    body = hadahan(place_id=None, latitude=6.9271, longitude=79.8612, timezone="Asia/Colombo")
    assert "Latitude 6.9271, longitude 79.8612" in text(post(client, body))


def test_metadata_holds_no_birth_details(client: TestClient) -> None:
    reader = post(client, hadahan())
    metadata = " ".join(str(value) for value in (reader.metadata or {}).values())
    assert "Hadahan report" in metadata
    assert "Nimali" not in metadata
    assert "1995" not in metadata


def test_full_porondam_report(client: TestClient) -> None:
    response = client.post(
        "/v1/reports/pdf",
        json=porondam({**NIMALI, "name": "Nimali"}, {**KASUN, "name": "Kasun"}),
    )
    assert response.headers["content-disposition"] == (
        'attachment; filename="astronomia-porondam.pdf"'
    )
    reader = read(response.content)
    content = text(reader)
    for expected in (
        "Nimali and Kasun",
        "9 of 18 factors agree",
        "Essential checks",
        "Rajju",
        "Vedha",
        "Factor by factor",
        "Stree Deergha",
        "Nimali: Present, reduced",
        "Kasun: Not present",
        "Rashi charts",
        "porondam_si_v3, kuja_v1",
        "not a decision",
    ):
        assert expected in content, expected


def test_quick_porondam_report(client: TestClient) -> None:
    reader = post(
        client,
        porondam(
            {"name": "", "nakshatra": "anuradha", "pada": 2},
            {"name": "", "nakshatra": "rohini", "pada": 1},
        ),
    )
    content = text(reader)
    assert "Bride and Groom" in content
    assert "Matched by birth star only" in content
    assert "Kuja dosha needs the full birth details of both people." in content
    assert "Rashi charts" not in content


def test_porondam_report_in_sinhala(client: TestClient) -> None:
    reader = post(client, porondam({**NIMALI, "name": "A"}, {**KASUN, "name": "B"}, lang="si"))
    assert "Noto-Sans-Sinhala" in fonts(reader)
    assert "Factor by factor" not in text(reader)


def test_unknown_place(client: TestClient) -> None:
    response = client.post("/v1/reports/pdf", json=hadahan(place_id=999_999_999))
    assert response.status_code == 404


def test_a_clock_change_time_must_be_chosen_first(client: TestClient) -> None:
    london: dict[str, Any] = {
        "place_id": None,
        "latitude": 51.5,
        "longitude": -0.12,
        "timezone": "Europe/London",
    }
    response = client.post(
        "/v1/reports/pdf", json=hadahan(date="2025-10-26", time="01:30", **london)
    )
    assert response.status_code == 422
    assert "choose one" in response.json()["detail"]

    chosen = client.post(
        "/v1/reports/pdf", json=hadahan(date="2025-10-26", time="01:30", fold=1, **london)
    )
    assert chosen.status_code == 200


@pytest.mark.parametrize(
    "body",
    [
        {"kind": "forecast"},
        {"kind": "hadahan"},
        {"kind": "hadahan", "name": "x" * 61, "birth": NIMALI},
        {"kind": "porondam", "match": {"bride": {"nakshatra": "mars", "pada": 1}}},
    ],
)
def test_bad_requests(client: TestClient, body: dict[str, Any]) -> None:
    assert client.post("/v1/reports/pdf", json=body).status_code == 422
