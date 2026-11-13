"""Avurudu (Sinhala and Tamil New Year) nakath, in Sri Lanka time and in any time zone (free).

The official times are moments in Sri Lanka time. For someone abroad they are the same
moments, shown on their own clock. No personal details, so this is a GET that may be cached.
"""

import datetime as dt
import zoneinfo
from typing import Annotated, Any

from fastapi import APIRouter, HTTPException, Path, Query, Response, status
from pydantic import BaseModel

from app.api.charts import EPHEMERIS
from app.api.panchanga import CACHE, LocalTimeOut, offset_label, time_out
from app.engine.avurudu import FIRST_YEAR, LAST_YEAR, Avurudu, OfficialItem, avurudu, load_rules
from app.explain.labels import Lang, labels
from app.reports.format import format_date

router = APIRouter(tags=["nakath"])


class BothTimes(BaseModel):
    sri_lanka: LocalTimeOut
    local: LocalTimeOut  # the same moment in the chosen time zone


class AvuruduItemOut(BaseModel):
    key: str
    name: str
    text: str  # what to do, in the words of the official list
    at: BothTimes | None
    start: BothTimes | None
    end: BothTimes | None
    date: dt.date | None  # an item with a day but no time
    date_text: str | None
    colour: str | None
    direction: str | None


class CalculatedOut(BaseModel):
    dawn: BothTimes
    punya_start: BothTimes
    punya_end: BothTimes
    # Minutes our time is after the official one (negative when before). None without a list.
    dawn_difference: int | None
    punya_difference: int | None


class AvuruduResponse(BaseModel):
    rule_set: str
    provisional: bool
    year: int
    official: bool
    source: str | None
    url: str | None
    timezone: str
    offset: str  # of the chosen time zone at the dawn
    calculated: CalculatedOut
    items: list[AvuruduItemOut]  # the official list; empty for a year without one
    notes: list[str]


def _minutes(ours: dt.datetime, theirs: dt.datetime | None) -> int | None:
    return None if theirs is None else round((ours - theirs).total_seconds() / 60)


def avurudu_out(result: Avurudu, lang: Lang, timezone: str) -> AvuruduResponse:
    table: dict[str, Any] = labels(lang)
    text = table["avurudu"]
    sri_lanka = zoneinfo.ZoneInfo(str(load_rules()["timezone"]))
    local = zoneinfo.ZoneInfo(timezone)

    def both(moment: dt.datetime | None) -> BothTimes | None:
        if moment is None:
            return None
        return BothTimes(sri_lanka=time_out(moment, sri_lanka), local=time_out(moment, local))

    def item(raw: OfficialItem) -> AvuruduItemOut:
        what = text["item"][raw.key]
        colour = text["colour"][raw.colour] if raw.colour else None
        direction = table["direction"][raw.direction] if raw.direction else None
        line = what["text"]
        if colour and direction:
            line = f"{line} {text['dress'].format(colour=colour, direction=direction)}"
        return AvuruduItemOut(
            key=raw.key,
            name=what["name"],
            text=line,
            at=both(raw.at),
            start=both(raw.start),
            end=both(raw.end),
            date=raw.day,
            date_text=format_date(raw.day, lang) if raw.day else None,
            colour=colour,
            direction=direction,
        )

    official_dawn = result.official_item("dawn")
    official_punya = result.official_item("punya_kalaya")
    dawn = both(result.dawn)
    start, end = both(result.punya_start), both(result.punya_end)
    assert dawn is not None and start is not None and end is not None
    notes = [text["note_moment"]]
    notes.append(text["note_official"] if result.official else text["note_calculated"])
    return AvuruduResponse(
        rule_set=result.rule_set,
        provisional=result.provisional,
        year=result.year,
        official=bool(result.official),
        source=result.source,
        url=result.url,
        timezone=timezone,
        offset=offset_label(result.dawn.astimezone(local)),
        calculated=CalculatedOut(
            dawn=dawn,
            punya_start=start,
            punya_end=end,
            dawn_difference=_minutes(result.dawn, official_dawn.at if official_dawn else None),
            punya_difference=_minutes(
                result.punya_start, official_punya.start if official_punya else None
            ),
        ),
        items=[item(raw) for raw in result.official],
        notes=notes,
    )


@router.get("/v1/avurudu/{year}", response_model=AvuruduResponse)
def get_avurudu(
    year: Annotated[int, Path()],
    response: Response,
    timezone: Annotated[str, Query(max_length=64)] = "Asia/Colombo",
    lang: Annotated[Lang, Query()] = "en",
) -> AvuruduResponse:
    """The new year moment, punya kalaya and the official list, in Sri Lanka time and in
    the given time zone."""
    if not FIRST_YEAR <= year <= LAST_YEAR:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "no new year for this year")
    try:
        zoneinfo.ZoneInfo(timezone)
    except (zoneinfo.ZoneInfoNotFoundError, ValueError) as error:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "unknown time zone") from error
    response.headers.update(CACHE)
    return avurudu_out(avurudu(EPHEMERIS, year), lang, timezone)
