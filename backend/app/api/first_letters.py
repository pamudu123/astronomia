"""First letters ceremony (akuru kiyaweema) finder. Free for now (docs/07, section 4.8).

Every endpoint here depends on first_letters_access(). That is the one place to add a paid
check later. Birth details travel in the body of a POST, never in the URL.
"""

import datetime as dt
import zoneinfo
from typing import Annotated, Literal, Self

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field, model_validator

from app.api.charts import EPHEMERIS
from app.api.deps import PlacesDb
from app.api.panchanga import LocalTimeOut, offset_label, time_out
from app.api.porondam import FullPerson, PorondamResponse, QuickPerson, _person
from app.api.timeresolve import TimeResolveResponse
from app.api.wedding import (
    WeddingPlaceOut,
    _add_months,
    _capital,
    _thithi_key,
    resolve_place,
)
from app.engine.first_letters import Suggestion, age_on, find_dates, load_rules
from app.engine.wedding import TARA_NAMES
from app.engine.zodiac import NAKSHATRA, RASHI
from app.explain.labels import Lang, labels
from app.reports.format import format_date

router = APIRouter(tags=["first letters"])


def first_letters_access() -> None:
    """Who may use the first letters finder. Everyone, for now.

    A paid lock would go here: raise HTTPException(402) for a visitor without access.
    """


Access = Annotated[None, Depends(first_letters_access)]


class FirstLettersRequest(BaseModel):
    child: FullPerson | QuickPerson
    # Needed for the child's age when only the birth star is given.
    birth_date: dt.date | None = None
    # Where the ceremony takes place: its sunrise and lagna. Colombo when not given.
    place_id: int | None = None
    latitude: float | None = Field(default=None, gt=-90, lt=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    timezone: str | None = None
    months: Literal[1, 3, 6] = 3
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


class FirstLettersSuggestionOut(BaseModel):
    date: dt.date
    date_text: str
    weekday: str
    start: LocalTimeOut
    end: LocalTimeOut
    nakatha: str
    thithi: str
    lagna: str
    tara: str
    passes: list[str]  # every rule it passes, in plain words
    cautions: list[str]  # weaker points some sources raise
    age: str | None  # the child's age on the day, when the birth date is known
    score: float


class ChildOut(BaseModel):
    star: str
    star_name: str
    mode: str  # full or quick


class FirstLettersResponse(BaseModel):
    status: str
    time: TimeResolveResponse | None = None
    rule_set: str | None = None
    provisional: bool | None = None
    first: dt.date | None = None
    last: dt.date | None = None
    place: WeddingPlaceOut | None = None
    child: ChildOut | None = None
    suggestions: list[FirstLettersSuggestionOut] = []
    none_text: str | None = None
    age_note: str | None = None
    note: str | None = None


def _suggestion(
    item: Suggestion, lang: Lang, zone: zoneinfo.ZoneInfo, birth: dt.date | None
) -> FirstLettersSuggestionOut:
    table = labels(lang)
    text = table["first_letters"]
    thithi = table["thithi"][_thithi_key(item.thithi)]
    nakatha = table["nakshatra"][item.nakatha]
    weekday = table["weekday"][item.weekday]
    lagna = table["rashi"][RASHI[item.lagna]]["name"]
    tara = table["wedding"]["tara"][TARA_NAMES[item.tara - 1]]
    passes = [
        text["pass_nakatha"].format(nakatha=nakatha),
        text["pass_thithi"].format(thithi=thithi),
        text["pass_karana"].format(karana=table["karana"][item.karana]),
        text["pass_tara"].format(tara=tara),
        text["pass_lagna"].format(lagna=lagna),
    ]
    if "weekday_weak" not in item.cautions:
        passes.insert(1, text["pass_weekday"].format(weekday=weekday))
    if item.rahu_kalaya is not None:
        start, end = (t.astimezone(zone).strftime("%H:%M") for t in item.rahu_kalaya)
        passes.append(text["pass_rahu"].format(start=start, end=end))
    values = {"weekday": weekday, "thithi": thithi, "yoga": table["yoga"][item.yoga]}
    age = None
    if birth is not None:
        years, months = age_on(birth, item.day)
        age = text["age"].format(
            years=_count(text["years"], years), months=_count(text["months"], months)
        )
    return FirstLettersSuggestionOut(
        date=item.day,
        date_text=format_date(item.day, lang),
        weekday=weekday,
        start=time_out(item.start, zone),
        end=time_out(item.end, zone),
        nakatha=nakatha,
        thithi=thithi,
        lagna=lagna,
        tara=tara,
        passes=[_capital(line, lang) for line in passes],
        cautions=[_capital(text[code].format(**values), lang) for code in item.cautions],
        age=age,
        score=round(item.score, 2),
    )


def _count(units: dict[str, str], n: int) -> str:
    return units["one"] if n == 1 else units["many"].format(n=n)


@router.post("/v1/first-letters", response_model=FirstLettersResponse)
def first_letters(body: FirstLettersRequest, db: PlacesDb, _: Access) -> FirstLettersResponse:
    """Good dates and times for a child's first letters, from the child's birth star."""
    found = _person(body.child, db, "bride")
    if isinstance(found, PorondamResponse):
        return FirstLettersResponse(status=found.status, time=found.time)
    moon = found[0]
    birth = body.child.date if isinstance(body.child, FullPerson) else body.birth_date
    place, place_id, name = resolve_place(
        body.place_id, body.latitude, body.longitude, body.timezone, db, body.lang
    )
    zone = zoneinfo.ZoneInfo(place.timezone)
    first = body.as_of or dt.datetime.now(zone).date()
    last = _add_months(first, body.months) - dt.timedelta(days=1)
    items = find_dates(EPHEMERIS, place, first, (last - first).days + 1, moon.nakshatra)
    rules = load_rules()
    text = labels(body.lang)["first_letters"]
    age_note = None
    if birth is not None:
        low, high = rules["age_years"]["from"], rules["age_years"]["to"]
        years = [age_on(birth, day)[0] for day in (first, last)]
        if years[1] < low or years[0] >= high:
            age_note = text["age_outside"]
    star = NAKSHATRA[moon.nakshatra]
    return FirstLettersResponse(
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
        child=ChildOut(
            star=star,
            star_name=labels(body.lang)["nakshatra"][star],
            mode="quick" if isinstance(body.child, QuickPerson) else "full",
        ),
        suggestions=[_suggestion(item, body.lang, zone, birth) for item in items],
        none_text=None if items else text["none"],
        age_note=age_note,
        note=text["note"],
    )
