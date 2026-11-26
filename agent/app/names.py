"""The AI name search on the baby names page: more names for the chosen first letters.

POST /agent/names takes the letters, gender and length the page's filters show, and the
names the page already lists. One model call, no tools, no chat history. Only those filters
reach the model: never a birth date or any other detail about a child (docs/09).

The model can get a letter wrong, so every name is checked by the engine with the same rule
as the site's own list (GET /v1/baby/names/check), and only the ones that start with an
asked letter, and have the asked length, are returned.
"""

import json
import logging
import re
from pathlib import Path
from typing import Annotated, Any, Literal

from langchain_core.language_models import BaseChatModel
from langchain_core.messages import BaseMessage, HumanMessage, SystemMessage
from pydantic import BaseModel, Field, StringConstraints, ValidationError

from app.tools.engine import EngineClient

log = logging.getLogger(__name__)

PROMPT_FILE = Path(__file__).parent / "prompts" / "names.md"

# Asked for, and the most returned: some of the asked fail the letter check.
ASK_FOR = 20
MAX_RETURNED = 12
# The engine's limit for one check (backend MAX_CHECKED).
MAX_CHECKED = 40

Letter = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=4)]
ShownName = Annotated[str, StringConstraints(strip_whitespace=True, max_length=40)]


class NamesRequest(BaseModel):
    letters: Annotated[list[Letter], Field(min_length=1, max_length=16)]
    gender: Literal["any", "boy", "girl"] = "any"
    length: Literal["any", "short", "medium", "long"] = "any"
    # The Sinhala spellings the page already lists, so the AI suggests others.
    already_shown: Annotated[list[ShownName], Field(max_length=200)] = Field(default_factory=list)


class AiName(BaseModel):
    si: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=40)]
    en: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=40)]
    gender: Literal["boy", "girl", "both"]
    meaning_en: Annotated[str, StringConstraints(strip_whitespace=True, max_length=120)] = ""
    meaning_si: Annotated[str, StringConstraints(strip_whitespace=True, max_length=120)] = ""


class AiNameOut(AiName):
    letter: str  # the letter it starts with, by the engine's rule
    length: str


class NamesResponse(BaseModel):
    names: list[AiNameOut]


class NamesUnavailable(Exception):
    """The model or the engine did not give a usable answer."""


def messages(request: NamesRequest) -> list[BaseMessage]:
    asked = {
        "letters": request.letters,
        "gender": request.gender,
        "length": request.length,
        "already_shown": request.already_shown,
        "how_many": ASK_FOR,
    }
    return [
        SystemMessage(content=PROMPT_FILE.read_text(encoding="utf-8")),
        HumanMessage(content=json.dumps(asked, ensure_ascii=False)),
    ]


def parse(text: str) -> list[AiName]:
    """The names in the model's answer. A malformed name is dropped, not the whole answer."""
    match = re.search(r"\{.*\}", text, flags=re.DOTALL)
    if not match:
        raise NamesUnavailable("no JSON object in the answer")
    try:
        body = json.loads(match.group(0))
    except json.JSONDecodeError as error:
        raise NamesUnavailable("the answer is not JSON") from error
    rows = body.get("names") if isinstance(body, dict) else None
    if not isinstance(rows, list):
        raise NamesUnavailable("the answer has no names")
    found: list[AiName] = []
    for row in rows:
        try:
            found.append(AiName.model_validate(row))
        except ValidationError:
            continue
    return found


def _wanted(request: NamesRequest, name: AiName) -> bool:
    if request.gender == "any":
        return True
    return name.gender in (request.gender, "both")


async def suggest(
    model: BaseChatModel, engine: EngineClient, request: NamesRequest
) -> NamesResponse:
    try:
        answer = await model.ainvoke(messages(request))
    except Exception as error:  # the provider's errors have no common type
        raise NamesUnavailable("the model did not answer") from error
    shown = set(request.already_shown)
    seen: set[str] = set()
    names: list[AiName] = []
    for name in parse(answer.text):
        if name.si in shown or name.si in seen or not _wanted(request, name):
            continue
        seen.add(name.si)
        names.append(name)
    names = names[:MAX_CHECKED]
    if not names:
        return NamesResponse(names=[])

    params: list[tuple[str, str]] = [("letters", letter) for letter in request.letters]
    params += [("names", name.si) for name in names]
    try:
        checked: dict[str, Any] = await engine.get("/v1/baby/names/check", params)
    except Exception as error:
        raise NamesUnavailable("the engine could not check the names") from error
    by_name = {row["si"]: row for row in checked["names"]}

    kept: list[AiNameOut] = []
    for name in names:
        row = by_name.get(name.si)
        if not row or not row["matches"]:
            continue
        if request.length != "any" and row["length"] != request.length:
            continue
        kept.append(AiNameOut(**name.model_dump(), letter=row["letter"], length=row["length"]))
    log.info("AI names: %d asked, %d answered, %d kept", ASK_FOR, len(names), len(kept))
    return NamesResponse(names=kept[:MAX_RETURNED])
