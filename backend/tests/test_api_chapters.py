"""The AI chapters kept with a paid report, and the free and paid PDFs (docs/17, section 6a)."""

import io
from typing import Any

import pytest
from fastapi.testclient import TestClient
from pypdf import PdfReader

from app.store.chapters import ChapterStore
from app.store.orders import OrderStore
from tests.test_api_paid import paid_reports, sign_in, unlock
from tests.test_api_saved import hadahan, porondam

KEY = {"X-Chat-Key": "server-key"}


@pytest.fixture(autouse=True)
def set_up(client: TestClient, orders: OrderStore) -> None:
    orders.create_coupon("pamudu", 100, max_uses=200, max_uses_per_account=10)
    paid_reports(client, chat_key="server-key")


def keep(
    client: TestClient,
    text: str,
    chapter: str = "chart.work",
    language: str = "en",
    report: dict[str, Any] | None = None,
    headers: dict[str, str] = KEY,
) -> Any:
    body = {
        "report": report or hadahan(),
        "language": language,
        "id": chapter,
        "text": text,
    }
    return client.post("/v1/reports/chapters/keep", json=body, headers=headers)


def kept(client: TestClient, language: str = "en", report: dict[str, Any] | None = None) -> Any:
    response = client.post(
        "/v1/reports/chapters", json={"report": report or hadahan(), "language": language}
    )
    assert response.status_code == 200, response.text
    assert response.headers["cache-control"] == "no-store"
    return response.json()["chapters"]


def pdf_text(client: TestClient, body: dict[str, Any]) -> tuple[str, int]:
    response = client.post("/v1/reports/pdf", json=body)
    assert response.status_code == 200, response.text
    reader = PdfReader(io.BytesIO(response.content))
    return " ".join(" ".join(p.extract_text() for p in reader.pages).split()), len(reader.pages)


def test_a_chapter_is_written_once_and_kept_with_the_report(client: TestClient) -> None:
    sign_in(client)
    assert unlock(client, "pamudu").status_code == 200
    assert keep(client, "First words.").json() == {"text": "First words."}
    # Written again (another tab, another device): the first words stay.
    assert keep(client, "Other words.").json() == {"text": "First words."}
    assert kept(client) == {"chart.work": "First words."}


def test_each_language_and_each_report_keeps_its_own(client: TestClient) -> None:
    sign_in(client)
    unlock(client, "pamudu")
    unlock(client, "pamudu", porondam())
    keep(client, "English.")
    keep(client, "සිංහල.", language="si")
    keep(client, "A match.", chapter="match.summary", report=porondam())
    assert kept(client) == {"chart.work": "English."}
    assert kept(client, "si") == {"chart.work": "සිංහල."}
    assert kept(client, report=porondam()) == {"match.summary": "A match."}


def test_the_report_is_the_same_in_either_page_language(client: TestClient) -> None:
    """The report's hash leaves out `lang`: a chapter kept from the Sinhala page is found again."""
    sign_in(client)
    unlock(client, "pamudu")
    other = hadahan()
    other["birth"]["lang"] = "si" if other["birth"].get("lang", "en") == "en" else "en"
    keep(client, "Same report.", report=other)
    assert kept(client) == {"chart.work": "Same report."}


def test_only_the_account_that_paid_reads_them(client: TestClient) -> None:
    sign_in(client)
    unlock(client, "pamudu")
    keep(client, "Mine.")
    sign_in(client)
    assert kept(client) == {}
    client.headers.pop("authorization", None)
    assert kept(client) == {}


def test_only_the_websites_server_keeps_a_chapter_and_only_of_a_paid_report(
    client: TestClient, chapters: ChapterStore
) -> None:
    sign_in(client)
    assert keep(client, "Not paid.").status_code == 402
    unlock(client, "pamudu")
    assert keep(client, "No key.", headers={}).status_code == 401
    assert keep(client, "Wrong key.", headers={"X-Chat-Key": "x"}).status_code == 401
    paid_reports(client)  # no key on the server: nothing can be kept
    assert keep(client, "Key not set.").status_code == 503
    assert kept(client) == {}


@pytest.mark.parametrize("chapter", ["nakath.day", "chart", "chart.Work", "<b>"])
def test_only_report_chapters_are_kept(client: TestClient, chapter: str) -> None:
    sign_in(client)
    unlock(client, "pamudu")
    assert keep(client, "x", chapter=chapter).status_code == 422


def test_text_length_is_limited(client: TestClient) -> None:
    sign_in(client)
    unlock(client, "pamudu")
    assert keep(client, "x" * 8001).status_code == 422
    assert keep(client, "").status_code == 422


def test_deleting_the_account_deletes_its_chapters(
    client: TestClient, chapters: ChapterStore, orders: OrderStore
) -> None:
    sign_in(client)
    order = unlock(client, "pamudu").json()["order"]["id"]
    keep(client, "Gone soon.")
    assert chapters.kept(order, "en")
    assert client.delete("/v1/me").status_code < 300
    assert chapters.kept(order, "en") == {}


def test_the_pdf_prints_the_kept_words_not_the_browsers(client: TestClient) -> None:
    sign_in(client)
    unlock(client, "pamudu")
    keep(client, "The words that were kept.")
    reading = [
        {"id": "chart.work", "title": "Work and money", "text": "Words changed in the browser."},
        {"id": "chart.love", "title": "Love", "text": "Not kept yet."},
    ]
    printed, _ = pdf_text(client, {**hadahan(), "reading": reading})
    assert "The words that were kept." in printed
    assert "Words changed in the browser." not in printed
    assert "Not kept yet." in printed


def test_the_free_pdf_shows_what_the_free_page_shows(client: TestClient) -> None:
    """No cover, no AI text and none of the Kuja dosha conditions the page locks."""
    reading = [{"id": "chart.work", "title": "Work and money", "text": "AI words."}]
    printed, pages = pdf_text(client, {**hadahan(), "reading": reading})
    assert pages <= 3
    for shown in ("Rashi chart", "The nine planets", "Your life periods", "Navamsha chart"):
        assert shown in printed, shown
    for hidden in (
        "PREMIUM",
        "AI words.",
        "Your full reading",
        "In this report",
        "Your sky at birth",
        "The 12 houses",
        "CONDITIONS THAT REDUCE IT",
        "other conditions were checked",
        "Applies",
    ):
        assert hidden not in printed, hidden

    sign_in(client)
    unlock(client, "pamudu")
    full, full_pages = pdf_text(client, {**hadahan(), "reading": reading})
    assert full_pages > pages
    for shown in ("PREMIUM BIRTH CHART REPORT", "AI words.", "In this report", "The 12 houses"):
        assert shown in full, shown


def test_the_free_match_pdf_has_no_cover_and_no_ai_text(client: TestClient) -> None:
    reading = [{"id": "match.summary", "title": "Summing up", "text": "AI words."}]
    printed, pages = pdf_text(client, {**porondam(), "reading": reading})
    assert "The serious checks" in printed and "Factor by factor" in printed
    assert "PREMIUM" not in printed and "AI words." not in printed
    assert "In this report" not in printed
    assert pages <= 4
