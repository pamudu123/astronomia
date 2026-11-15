"""A finished result in both languages, kept by share links and saved reports.

The server works the result out again from the birth details, so what is kept always comes
from the engine and never from numbers sent by the browser. The snapshot holds the result, the
birth date, time and place line, and names unless they are hidden. It never holds the request
itself (place id, coordinates, time zone).
"""

import datetime as dt
from pathlib import Path
from typing import Any

from fastapi import HTTPException, status
from pydantic import BaseModel

from app.api.charts import HadahanResponse, build_hadahan
from app.api.porondam import PorondamResponse, build_porondam
from app.api.reports import NEEDS_CHOICE, HadahanReport, PorondamReport
from app.explain.labels import Lang
from app.reports.format import coordinates_line, format_time, place_line

LANGS: tuple[Lang, ...] = ("en", "si")


class SnapshotHadahan(BaseModel):
    """A kept hadahan in one language."""

    name: str  # empty when hidden
    date: dt.date
    time: str  # "14:35"
    place: str
    result: HadahanResponse


def hadahan_snapshot(body: HadahanReport, db: Path, hide_names: bool = False) -> dict[str, Any]:
    results: dict[str, Any] = {}
    places: dict[str, str] = {}
    for lang in LANGS:
        built = build_hadahan(body.birth.model_copy(update={"lang": lang}), db)
        if built.response.status != "ok":
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, NEEDS_CHOICE)
        birth = built.birth
        places[lang] = (
            place_line(birth.place, lang)
            if birth.place
            else coordinates_line(birth.latitude, birth.longitude, lang)
        )
        results[lang] = built.response.model_dump(mode="json")
    return {
        "name": "" if hide_names else body.name.strip(),
        "date": body.birth.date.isoformat(),
        "time": format_time(body.birth.time),
        "place": places,
        "result": results,
    }


def porondam_snapshot(body: PorondamReport, db: Path, hide_names: bool = False) -> dict[str, Any]:
    results: dict[str, Any] = {}
    for lang in LANGS:
        built = build_porondam(body.match.model_copy(update={"lang": lang}), db)
        if built.response.status != "ok":
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, NEEDS_CHOICE)
        result = built.response.model_dump(mode="json")
        if hide_names:
            result["bride"]["name"] = ""
            result["groom"]["name"] = ""
        results[lang] = result
    return {"result": results}


def open_hadahan(snapshot: dict[str, Any], lang: Lang) -> SnapshotHadahan:
    return SnapshotHadahan(
        name=snapshot["name"],
        date=snapshot["date"],
        time=snapshot["time"],
        place=snapshot["place"][lang],
        result=HadahanResponse.model_validate(snapshot["result"][lang]),
    )


def open_porondam(snapshot: dict[str, Any], lang: Lang) -> PorondamResponse:
    return PorondamResponse.model_validate(snapshot["result"][lang])
