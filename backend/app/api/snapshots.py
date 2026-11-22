"""A finished result in both languages, kept by share links and saved reports.

The server works the result out again from the birth details, so what is kept always comes
from the engine and never from numbers sent by the browser. The snapshot holds the result, the
birth date, time and place line, and names. A share link can leave out the names, the birth
details, or both: those are then removed before anything is kept. It never holds the request
itself (place id, coordinates, time zone).
"""

import datetime as dt
from pathlib import Path
from typing import Any

from fastapi import HTTPException, status
from pydantic import BaseModel

from app.api.charts import ChartOut, DashaOut, HadahanResponse, build_hadahan
from app.api.porondam import PorondamResponse, build_porondam
from app.api.report_requests import NEEDS_CHOICE, HadahanReport, PorondamReport
from app.api.timeresolve import TimeResolveResponse
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


class SharedChart(ChartOut):
    """A shared chart. The birth moment and place are None when birth details are hidden."""

    utc: dt.datetime | None  # type: ignore[assignment]
    latitude: float | None  # type: ignore[assignment]
    longitude: float | None  # type: ignore[assignment]


class SharedDasha(DashaOut):
    balance_years: float | None  # type: ignore[assignment]  # None when birth is hidden


class SharedHadahanResult(HadahanResponse):
    """A shared hadahan result. With birth details hidden there is no time block (date, clock
    time, time zone), no birth moment or place in the chart, and no dasha balance."""

    time: TimeResolveResponse | None  # type: ignore[assignment]
    chart: SharedChart | None
    dasha: SharedDasha | None


class SharedHadahan(BaseModel):
    """A shared hadahan in one language."""

    name: str  # empty when hidden
    date: dt.date | None  # these three are None when birth details are hidden
    time: str | None
    place: str | None
    result: SharedHadahanResult


# What "birth details" means for a share link: every field that gives the birth date, clock
# time, time zone or place, at the top of the snapshot and inside the result.
def _hide_hadahan_birth(result: dict[str, Any]) -> None:
    result["time"] = None
    if result.get("chart"):
        result["chart"].update(utc=None, latitude=None, longitude=None)
    if result.get("dasha"):
        result["dasha"]["balance_years"] = None


def _hide_porondam_birth(result: dict[str, Any]) -> None:
    result["time"] = None
    for role in ("bride", "groom"):
        if result.get(role):
            result[role]["offset_label"] = None


def hadahan_snapshot(
    body: HadahanReport, db: Path, hide_names: bool = False, hide_birth: bool = False
) -> dict[str, Any]:
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
        result = built.response.model_dump(mode="json")
        if hide_birth:
            _hide_hadahan_birth(result)
        results[lang] = result
    return {
        "name": "" if hide_names else body.name.strip(),
        "date": None if hide_birth else body.birth.date.isoformat(),
        "time": None if hide_birth else format_time(body.birth.time),
        "place": None if hide_birth else places,
        "result": results,
    }


def porondam_snapshot(
    body: PorondamReport, db: Path, hide_names: bool = False, hide_birth: bool = False
) -> dict[str, Any]:
    results: dict[str, Any] = {}
    for lang in LANGS:
        built = build_porondam(body.match.model_copy(update={"lang": lang}), db)
        if built.response.status != "ok":
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, NEEDS_CHOICE)
        result = built.response.model_dump(mode="json")
        if hide_names:
            result["bride"]["name"] = ""
            result["groom"]["name"] = ""
        if hide_birth:
            _hide_porondam_birth(result)
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


def open_shared_hadahan(snapshot: dict[str, Any], lang: Lang) -> SharedHadahan:
    place = snapshot["place"]
    return SharedHadahan(
        name=snapshot["name"],
        date=snapshot["date"],
        time=snapshot["time"],
        place=place[lang] if place else None,
        result=SharedHadahanResult.model_validate(snapshot["result"][lang]),
    )


def open_porondam(snapshot: dict[str, Any], lang: Lang) -> PorondamResponse:
    return PorondamResponse.model_validate(snapshot["result"][lang])
