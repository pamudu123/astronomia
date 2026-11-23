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


def flat(reader: PdfReader) -> str:
    """The text on one line, so a phrase that wraps inside a narrow card still matches."""
    return " ".join(text(reader).split())


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
    assert response.headers["content-disposition"] == ('attachment; filename="sidera-hadahan.pdf"')
    reader = read(response.content)
    # The cover, the contents, at a glance, the sky, the houses, the life periods, Kuja dosha,
    # and the back cover.
    assert len(reader.pages) == 8
    for page in reader.pages:
        assert (round(float(page.mediabox.width)), round(float(page.mediabox.height))) == A4

    cover = reader.pages[0].extract_text()
    assert "PREMIUM BIRTH CHART REPORT" in cover
    assert "Nimali's hadahan" in cover
    assert "Page" not in cover  # the cover has no header or footer

    content = flat(reader)
    for expected in (
        "Nimali's hadahan",
        "Born 19 April 1995 at 14:35",
        "Kandy",
        "Simha (Leo)",
        "Jyeshtha, pada 4",
        "In this report",
        "Your chart in four steps",
        "Rashi chart",
        "Navamsha chart",
        "Your sky at birth",
        "The nine planets",
        "The 12 houses",
        "partnership and marriage",
        "Your life periods",
        "Running now",
        "How the Kuja dosha check works out",
        "From the lagna: house 12",
        "Mars is in the 12th house counted from the lagna.",
        "Page 2 of 8",
    ):
        assert expected in content, expected

    assert "The sky calculated" in reader.pages[-1].extract_text()  # the back cover
    last = reader.pages[-2].extract_text()
    assert "For guidance and cultural interest" in last
    assert "Lahiri ayanamsa" in last
    assert "kuja_v2" in last
    assert "provisional" in last
    assert "Made on 12 November 2026." in last


def test_hadahan_report_in_sinhala_uses_sinhala_fonts(client: TestClient) -> None:
    reader = post(client, hadahan("si", name="නිමාලි"))
    assert len(reader.pages) == 8
    assert {"Noto-Sans-Sinhala", "Noto-Sans-Sinhala-Semi-Bold"} <= fonts(reader)
    assert "Simha" not in text(reader)


def test_the_name_prints_as_plain_text(client: TestClient) -> None:
    reader = post(client, hadahan(name='<img src="file:///etc/passwd"> & <b>Ann</b>'))
    assert '<img src="file:///etc/passwd"> & <b>Ann</b>' in text(reader).replace("\n", " ")


def test_a_birth_by_coordinates_prints_them(client: TestClient) -> None:
    body = hadahan(place_id=None, latitude=6.9271, longitude=79.8612, timezone="Asia/Colombo")
    assert "Latitude 6.9271, longitude 79.8612" in text(post(client, body))


@pytest.mark.parametrize(
    "as_of",
    [
        "1900-01-01T00:00:00Z",  # before the first period (it starts before the birth)
        "2200-01-01T00:00:00Z",  # after the 120 years of periods
    ],
)
def test_a_date_with_no_running_period_still_prints(client: TestClient, as_of: str) -> None:
    content = text(post(client, hadahan(as_of=as_of))).replace("\n", " ")
    assert "No dasha period runs on this date" in content
    assert "main period, " not in content
    assert "Saturn" in content  # the period table still prints


def test_an_old_birth_prints_in_sinhala(client: TestClient) -> None:
    body = hadahan(lang="si", date="1900-01-01", time="12:00", as_of=None)
    # pypdf moves Sinhala vowel signs and breaks the line, so only the stem is checked.
    assert "දශාවක" in text(post(client, body))


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
    assert response.headers["content-disposition"] == ('attachment; filename="sidera-porondam.pdf"')
    reader = read(response.content)
    assert "PREMIUM MATCH REPORT" in reader.pages[0].extract_text()
    content = flat(reader)
    for expected in (
        "Nimali and Kasun",
        "9 of 18 factors agree",
        "The factors at a glance",
        "The serious checks",
        "Rajju",
        "Vedha",
        "Factor by factor",
        "Stree Deergha",
        "Nimali: Present, reduced",
        "Kasun: Not present",
        "Rashi charts",
        "porondam_si_v3, kuja_v2",
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
    content = flat(reader)
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


READING = [
    {
        "id": "chart.nature",
        "title": "Your nature",
        "text": "You meet life warmly.\n\n**Where it shows**\n- **Work**: steady\n- Home: calm",
    },
    {"title": "Saturn periods", "text": "A calm stretch <b>ahead</b>."},
]


def test_the_ai_reading_prints_in_its_own_labelled_section(client: TestClient) -> None:
    """The chapters the person read come back with the request (docs/17, step 6)."""
    reader = post(client, {**hadahan(), "reading": READING})
    printed = flat(reader)
    # Small capitals are letter-spaced, so the extracted text has a space between letters.
    squeezed = printed.replace(" ", "")
    assert "AIREADING" in squeezed
    assert "Your full reading" in printed
    assert "Written by AI from the results above" in printed
    # The opening page and one page per chapter, after the seven before it, and the back cover.
    assert len(reader.pages) == 11
    assert "CHAPTER1" in squeezed and "CHAPTER2" in squeezed
    assert "INSHORT" in squeezed
    assert "Your nature" in printed and "Saturn periods" in printed
    assert "Where it shows" in printed and "steady" in printed
    # Text is escaped, never markup: the tag prints as written.
    assert "<b>ahead</b>" in printed


def test_no_reading_no_section(client: TestClient) -> None:
    printed = flat(post(client, hadahan()))
    assert "AIREADING" not in printed.replace(" ", "")
    assert "Your full reading" not in printed


def test_a_chapter_prints_its_diagram(client: TestClient) -> None:
    """The "Work and money" chapter lights up its houses; "Your nature" shows the four steps."""
    work = [{"id": "chart.work", "title": "Work and money", "text": "Steady work suits you."}]
    printed = flat(post(client, {**hadahan(), "reading": work}))
    # The houses grid prints twice: on its own page and in the chapter.
    assert printed.count("Vrishabha") >= 2
    nature = [{"id": "chart.nature", "title": "Your nature", "text": "Warm."}]
    assert flat(post(client, {**hadahan(), "reading": nature})).count("How you meet the world") == 2


@pytest.mark.parametrize("chapter_id", ["Chart.Work", "chart.work.x", "<b>", "x" * 41])
def test_a_chapter_id_must_look_like_one(client: TestClient, chapter_id: str) -> None:
    body = {**hadahan(), "reading": [{"id": chapter_id, "title": "A", "text": "B"}]}
    assert client.post("/v1/reports/pdf", json=body).status_code == 422


def test_an_unknown_chapter_id_prints_with_a_general_picture(client: TestClient) -> None:
    body = {**hadahan(), "reading": [{"id": "chart.future", "title": "Later", "text": "Text."}]}
    assert "Later" in flat(post(client, body))


def test_the_match_report_takes_a_reading_too(client: TestClient) -> None:
    body = {**porondam(NIMALI, KASUN, lang="si"), "reading": READING[:1]}
    printed = text(post(client, body))
    # The Sinhala heading keeps "AI" in Latin letters, and only the reading section prints it.
    assert "AI" in printed
    assert "Your nature" in printed


def test_reading_size_is_limited(client: TestClient) -> None:
    too_long = [{"title": "A", "text": "x" * 8001}]
    assert (
        client.post("/v1/reports/pdf", json={**hadahan(), "reading": too_long}).status_code == 422
    )
    too_many = [{"title": "A", "text": "x"}] * 17
    assert (
        client.post("/v1/reports/pdf", json={**hadahan(), "reading": too_many}).status_code == 422
    )
