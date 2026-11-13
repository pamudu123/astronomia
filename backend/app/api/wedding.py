"""Wedding nakath finder. A paid feature, open to everyone for now (docs/07).

Every endpoint here depends on wedding_access(). That is the one place to add the paid check.
Birth details travel in the body of a POST, never in the URL.
"""

import datetime as dt
import zoneinfo
from typing import Annotated, Any, Literal, Self

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, model_validator

from app.api.charts import EPHEMERIS
from app.api.deps import PlacesDb
from app.api.panchanga import LocalTimeOut, offset_label, time_out
from app.api.porondam import FullPerson, PorondamResponse, QuickPerson, _person
from app.api.timeresolve import TimeResolveResponse
from app.engine.panchanga import Place
from app.engine.wedding import CEREMONIES, TARA_NAMES, Person, Suggestion, find_dates, load_rules
from app.engine.zodiac import RASHI
from app.explain.labels import Lang, labels
from app.geo.search import get_place
from app.reports.format import format_date

router = APIRouter(tags=["wedding"])

COLOMBO = 1248991
Ceremony = Literal["engagement", "poruwa", "homecoming"]


def wedding_access() -> None:
    """Who may use the wedding nakath finder. Everyone, for now.

    The paid lock goes here: raise HTTPException(402) for a visitor without access.
    """


Access = Annotated[None, Depends(wedding_access)]


def _all_ceremonies() -> list[Ceremony]:
    return ["engagement", "poruwa", "homecoming"]


class WeddingRequest(BaseModel):
    bride: FullPerson | QuickPerson
    groom: FullPerson | QuickPerson
    # Where the ceremonies take place: its sunrise and lagna. Colombo when not given.
    place_id: int | None = None
    latitude: float | None = Field(default=None, gt=-90, lt=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    timezone: str | None = None
    months: Literal[3, 6, 12, 24] = 6
    ceremonies: list[Ceremony] = Field(default_factory=lambda: _all_ceremonies(), min_length=1)
    as_of: dt.date | None = None  # the first day to search; today when not given (for tests)
    lang: Lang = "en"

    @model_validator(mode="after")
    def one_place(self) -> Self:
        manual = [self.latitude, self.longitude, self.timezone]
        if self.place_id is not None and any(v is not None for v in manual):
            raise ValueError("give either place_id or latitude, longitude and timezone")
        if any(v is not None for v in manual) and any(v is None for v in manual):
            raise ValueError("give all of latitude, longitude and timezone")
        return self


class SuggestionOut(BaseModel):
    date: dt.date
    date_text: str
    weekday: str
    start: LocalTimeOut
    end: LocalTimeOut
    nakatha: str
    thithi: str
    lagna: str
    passes: list[str]  # every rule it passes, in plain words
    cautions: list[str]  # weaker points some sources raise
    score: float


class CeremonyOut(BaseModel):
    key: str
    name: str
    suggestions: list[SuggestionOut]
    none_text: str | None  # when nothing in the range passes


class WeddingPlaceOut(BaseModel):
    id: int | None
    name: str | None
    timezone: str
    offset: str


class WeddingResponse(BaseModel):
    status: str
    waiting_for: str | None = None
    time: TimeResolveResponse | None = None
    rule_set: str | None = None
    provisional: bool | None = None
    first: dt.date | None = None
    last: dt.date | None = None
    place: WeddingPlaceOut | None = None
    ceremonies: list[CeremonyOut] = []
    note: str | None = None


def _place(body: WeddingRequest, db: Any, lang: Lang) -> tuple[Place, int | None, str | None]:
    if body.latitude is not None and body.longitude is not None and body.timezone is not None:
        try:
            zoneinfo.ZoneInfo(body.timezone)
        except (zoneinfo.ZoneInfoNotFoundError, ValueError) as error:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_CONTENT, "unknown time zone"
            ) from error
        return Place(body.latitude, body.longitude, body.timezone), None, None
    found = get_place(db, body.place_id if body.place_id is not None else COLOMBO)
    if found is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "unknown place")
    name = found.name_si if lang == "si" and found.name_si else found.name
    return Place(found.latitude, found.longitude, found.timezone), found.id, name


def _suggestion(item: Suggestion, lang: Lang, zone: zoneinfo.ZoneInfo) -> SuggestionOut:
    table = labels(lang)
    text = table["wedding"]
    house = table["house"]
    rashi = table["rashi"]
    thithi = table["thithi"][_thithi_key(item.thithi)]
    nakatha = table["nakshatra"][item.nakatha]
    weekday = table["weekday"][item.weekday]
    lagna = rashi[RASHI[item.lagna]]["name"]
    passes = [
        text["pass_nakatha"].format(nakatha=nakatha),
        text["pass_thithi"].format(thithi=thithi),
        text["pass_karana"].format(karana=table["karana"][item.karana]),
        text["pass_tara"].format(
            bride_tara=text["tara"][TARA_NAMES[item.taras[0] - 1]],
            groom_tara=text["tara"][TARA_NAMES[item.taras[1] - 1]],
        ),
        text["pass_chandra"].format(
            moon_sign=rashi[RASHI[item.moon_sign]]["name"],
            bride_house=house[item.moon_houses[0] - 1],
            groom_house=house[item.moon_houses[1] - 1],
        ),
        text["pass_planets"],
    ]
    if "weekday_weak" not in item.cautions:
        passes.insert(2, text["pass_weekday"].format(weekday=weekday))
    if item.rahu_kalaya is not None:
        start, end = (t.astimezone(zone).strftime("%H:%M") for t in item.rahu_kalaya)
        passes.append(text["pass_rahu"].format(start=start, end=end))
    if item.seventh_house_free:
        passes.append(text["pass_lagna"].format(lagna=lagna))
    values = {"weekday": weekday, "thithi": thithi, "yoga": table["yoga"][item.yoga]}
    cautions = [text[code].format(**values) for code in item.cautions]
    return SuggestionOut(
        date=item.day,
        date_text=format_date(item.day, lang),
        weekday=table["weekday"][item.weekday],
        start=time_out(item.start, zone),
        end=time_out(item.end, zone),
        nakatha=nakatha,
        thithi=thithi,
        lagna=lagna,
        passes=[_capital(line, lang) for line in passes],
        cautions=[_capital(line, lang) for line in cautions],
        score=round(item.score, 2),
    )


def _thithi_key(number: int) -> str:
    from app.engine.panchanga import THITHI_KEYS

    return THITHI_KEYS[number - 1]


def _capital(text: str, lang: Lang) -> str:
    return text[0].upper() + text[1:] if lang == "en" else text


@router.post("/v1/wedding-nakath", response_model=WeddingResponse)
def wedding_nakath(body: WeddingRequest, db: PlacesDb, _: Access) -> WeddingResponse:
    """Good dates and times for the engagement, the poruwa and the homecoming, with reasons."""
    people: dict[str, Person] = {}
    for role in ("bride", "groom"):
        found = _person(getattr(body, role), db, role)
        if isinstance(found, PorondamResponse):
            return WeddingResponse(status=found.status, waiting_for=role, time=found.time)
        moon = found[0]
        people[role] = Person(star=moon.nakshatra, moon_sign=moon.sign)
    place, place_id, name = _place(body, db, body.lang)
    zone = zoneinfo.ZoneInfo(place.timezone)
    first = body.as_of or dt.datetime.now(zone).date()
    last = _add_months(first, body.months) - dt.timedelta(days=1)
    ceremonies = tuple(c for c in CEREMONIES if c in body.ceremonies)
    found_dates = find_dates(
        EPHEMERIS,
        place,
        first,
        (last - first).days + 1,
        ceremonies,
        people["bride"],
        people["groom"],
    )
    text = labels(body.lang)["wedding"]
    rules = load_rules()
    return WeddingResponse(
        status="ok",
        rule_set=str(rules["version"]),
        provisional=bool(rules["provisional"]),
        first=first,
        last=last,
        place=WeddingPlaceOut(
            id=place_id,
            name=name,
            timezone=place.timezone,
            offset=offset_label(dt.datetime.combine(first, dt.time(12), tzinfo=zone)),
        ),
        ceremonies=[
            CeremonyOut(
                key=ceremony,
                name=text["ceremony"][ceremony],
                suggestions=[_suggestion(item, body.lang, zone) for item in found_dates[ceremony]],
                none_text=None if found_dates[ceremony] else text["none"],
            )
            for ceremony in ceremonies
        ],
        note=text["note"],
    )


def _add_months(day: dt.date, months: int) -> dt.date:
    month = day.month - 1 + months
    year, month = day.year + month // 12, month % 12 + 1
    for last_day in (day.day, 30, 29, 28):
        try:
            return dt.date(year, month, last_day)
        except ValueError:
            continue
    raise ValueError("bad date")
