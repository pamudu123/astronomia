"""The AI name search (app/names.py): one model call, every name checked by the engine."""

import json
from typing import Any

import httpx
import pytest
from fastapi.testclient import TestClient
from langchain_core.messages import AIMessage

from app.config import Settings
from app.main import create_app
from app.names import NamesRequest, NamesUnavailable, messages, parse, suggest
from app.tools import EngineClient

from .conftest import RecordingModel

ANSWER = {
    "names": [
        {
            "si": "ප්‍රියා",
            "en": "Priya",
            "gender": "girl",
            "meaning_en": "Beloved",
            "meaning_si": "ප්‍රිය",
        },
        {"si": "පියුමි", "en": "Piyumi", "gender": "girl", "meaning_en": "", "meaning_si": ""},
        # Starts with පා, not පි: the engine says so and it is dropped.
        {
            "si": "පාලිත",
            "en": "Palitha",
            "gender": "boy",
            "meaning_en": "Protected",
            "meaning_si": "",
        },
        # Already on the page.
        {"si": "පියුමිකා", "en": "Piyumika", "gender": "girl", "meaning_en": "", "meaning_si": ""},
        # Not a gender the page knows: dropped as malformed.
        {"si": "පිනි", "en": "Pini", "gender": "other"},
        # Twice.
        {"si": "ප්‍රියා", "en": "Priyaa", "gender": "girl"},
    ]
}

LETTERS = {"ප්‍රියා": "පි", "පියුමි": "පි", "පාලිත": "ප", "පියුමිකා": "පි"}


def check_handler(seen: list[httpx.Request]) -> Any:
    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        assert request.url.path == "/v1/baby/names/check"
        letters = request.url.params.get_list("letters")
        names = [
            {
                "si": name,
                "letter": LETTERS[name],
                "matches": LETTERS[name] in letters,
                "syllables": 2,
                "length": "medium" if name == "පියුමි" else "short",
            }
            for name in request.url.params.get_list("names")
        ]
        return httpx.Response(200, json={"names": names})

    return handler


def engine_with(handler: Any) -> EngineClient:
    engine = EngineClient("http://engine.test")
    engine.http = httpx.AsyncClient(
        base_url="http://engine.test", transport=httpx.MockTransport(handler)
    )
    return engine


def model_saying(text: str) -> RecordingModel:
    return RecordingModel(responses=[AIMessage(content=text)])


async def test_names_are_checked_by_the_engine() -> None:
    seen: list[httpx.Request] = []
    request = NamesRequest(letters=["පි"], gender="girl", already_shown=["පියුමිකා"])
    found = await suggest(
        model_saying(json.dumps(ANSWER, ensure_ascii=False)),
        engine_with(check_handler(seen)),
        request,
    )

    assert [(n.si, n.letter) for n in found.names] == [("ප්‍රියා", "පි"), ("පියුමි", "පි")]
    # Only new, well formed, girl or both names went to the check, each once.
    assert seen[0].url.params.get_list("names") == ["ප්‍රියා", "පියුමි"]


async def test_the_asked_length_is_kept() -> None:
    request = NamesRequest(letters=["පි"], length="medium")
    found = await suggest(
        model_saying(json.dumps(ANSWER, ensure_ascii=False)),
        engine_with(check_handler([])),
        request,
    )
    assert [n.si for n in found.names] == ["පියුමි"]


async def test_no_usable_name_needs_no_check() -> None:
    def never(request: httpx.Request) -> httpx.Response:
        raise AssertionError("the engine was asked")

    found = await suggest(
        model_saying('{"names": []}'), engine_with(never), NamesRequest(letters=["පි"])
    )
    assert found.names == []


def test_parse_finds_the_object_inside_other_text() -> None:
    assert [
        n.en
        for n in parse(
            'Here:\n```json\n{"names": [{"si": "නිමලි", "en": "Nimali", "gender": "girl"}]}\n```'
        )
    ] == ["Nimali"]
    with pytest.raises(NamesUnavailable):
        parse("Sorry, I can't.")
    with pytest.raises(NamesUnavailable):
        parse('{"names": "none"}')


def test_only_the_filters_reach_the_model() -> None:
    request = NamesRequest(letters=["ව"], gender="boy", length="short", already_shown=["විමල්"])
    sent = json.loads(messages(request)[1].content)  # type: ignore[arg-type]
    assert set(sent) == {"letters", "gender", "length", "already_shown", "how_many"}
    assert sent["letters"] == ["ව"]


def test_the_request_is_limited() -> None:
    with pytest.raises(ValueError):
        NamesRequest(letters=[])
    with pytest.raises(ValueError):
        NamesRequest(letters=["ව"] * 17)
    with pytest.raises(ValueError):
        NamesRequest(letters=["ව"], already_shown=["x" * 41])


def test_the_endpoint_says_when_the_model_fails(settings: Settings) -> None:
    client = TestClient(
        create_app(
            settings, model=model_saying("Hello."), explain_model=model_saying("No names here.")
        )
    )
    response = client.post("/agent/names", json={"letters": ["පි"]})
    assert response.status_code == 502
    assert client.post("/agent/names", json={"letters": []}).status_code == 422
