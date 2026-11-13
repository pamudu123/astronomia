"""Planet changes: what each move of Saturn, Jupiter, Rahu and Ketu means for a lagna.

The general answers need only a lagna, so they are GET requests that may be cached. The
personal answers need a birth chart, so they are POST requests with the birth in the body.
"""

import datetime as dt
from typing import Annotated, Any

from fastapi import APIRouter, HTTPException, Path, Query, Response, status
from pydantic import BaseModel

from app.api.birth import resolve_birth
from app.api.charts import EPHEMERIS, HadahanRequest
from app.api.deps import PlacesDb
from app.api.timeresolve import TimeResolveResponse
from app.engine.changes import (
    PROVISIONAL,
    RULE_SET,
    SRI_LANKA,
    START,
    Change,
    ChangeForSign,
    PlanetMove,
    all_changes,
    changes_between,
    count_from,
    find_change,
)
from app.engine.chart import compute_chart
from app.engine.zodiac import RASHI, Body
from app.explain.labels import Lang, labels
from app.reports.format import format_date, format_time

router = APIRouter(tags=["changes"])

# The list page shows the changes up to here. Later changes are still served by id.
LIST_END = dt.datetime(2028, 1, 1, tzinfo=dt.UTC)
# How far ahead the personal list on the hadahan looks.
AHEAD = dt.timedelta(days=365)
# A general answer depends only on the change and the lagna, so caches may keep it.
CACHE = {"Cache-Control": "public, max-age=3600"}


class PlanetMoveOut(BaseModel):
    body: Body
    from_sign: str
    to_sign: str
    retrograde: bool
    until: dt.datetime  # UTC
    next_sign: str
    text: str  # "Rahu moves from Kumbha into Makara."
    until_text: str  # "Rahu stays in Makara until 24 June 2028, when it moves into Dhanu."


class ChangeOut(BaseModel):
    id: str
    kind: str
    title: str
    moment: dt.datetime  # UTC
    local_date: dt.date  # the date in Sri Lanka
    when: str  # "5 December 2026, 22:32 Sri Lanka time"
    moves: list[PlanetMoveOut]


class HouseMoveOut(BaseModel):
    body: Body
    from_sign: str
    to_sign: str
    from_house: int
    to_house: int
    text: str  # "Rahu leaves your 7th house and enters your 6th house."
    short: str  # "Rahu: 7th house to 6th house"
    from_theme: str
    to_theme: str


class OtherOut(BaseModel):
    body: Body
    sign: str
    house: int
    text: str


class CountedOut(BaseModel):
    """A change counted from one sign: the lagna, or the Moon sign for gochara."""

    sign: str
    sign_name: str
    moves: list[HouseMoveOut]
    others: list[OtherOut]


class ChangeListResponse(BaseModel):
    rule_set: str
    provisional: bool
    changes: list[ChangeOut]


class ChangeHubResponse(BaseModel):
    rule_set: str
    provisional: bool
    change: ChangeOut
    lagnas: list[CountedOut]  # all twelve, Mesha first


class ChangeLagnaResponse(BaseModel):
    rule_set: str
    provisional: bool
    change: ChangeOut
    lagna: CountedOut


class PersonalChangeResponse(BaseModel):
    status: str
    time: TimeResolveResponse
    rule_set: str
    provisional: bool
    change: ChangeOut
    lagna: CountedOut | None
    gochara: CountedOut | None  # counted from the Moon sign


class UpcomingChange(BaseModel):
    change: ChangeOut
    lagna: CountedOut
    gochara: CountedOut


class UpcomingResponse(BaseModel):
    status: str
    time: TimeResolveResponse
    rule_set: str
    provisional: bool
    lagna: str | None
    moon_sign: str | None
    changes: list[UpcomingChange]


def _local(moment: dt.datetime) -> dt.datetime:
    return moment.astimezone(SRI_LANKA)


def _names(lang: Lang) -> tuple[dict[str, Any], dict[str, Any], dict[str, Any], list[str]]:
    table = labels(lang)
    return table, table["changes"], table["rashi"], table["house"]


def _capital(text: str, lang: Lang) -> str:
    return text[0].upper() + text[1:] if lang == "en" else text


def _move(move: PlanetMove, lang: Lang) -> PlanetMoveOut:
    table, text, rashi, _ = _names(lang)
    # all_changes() lists only moves whose next change is known.
    assert move.until is not None and move.next_sign is not None
    planet = table["planet"][move.body.value]["name"]
    to_sign = rashi[RASHI[move.to_sign]]["name"]
    return PlanetMoveOut(
        body=move.body,
        from_sign=RASHI[move.from_sign],
        to_sign=RASHI[move.to_sign],
        retrograde=move.retrograde,
        until=move.until,
        next_sign=RASHI[move.next_sign],
        text=text["move_back" if move.retrograde else "move"].format(
            planet=planet, from_sign=rashi[RASHI[move.from_sign]]["name"], to_sign=to_sign
        ),
        until_text=text["until"].format(
            planet=planet,
            to_sign=to_sign,
            date=format_date(_local(move.until).date(), lang),
            next_sign=rashi[RASHI[move.next_sign]]["name"],
        ),
    )


def change_out(change: Change, lang: Lang) -> ChangeOut:
    _, text, _, _ = _names(lang)
    local = _local(change.moment)
    return ChangeOut(
        id=change.id,
        kind=change.kind,
        title=text[f"title_{change.kind.replace('-', '_')}"],
        moment=change.moment,
        local_date=local.date(),
        when=text["when"].format(
            date=format_date(local.date(), lang), time=format_time(local.time())
        ),
        moves=[_move(move, lang) for move in change.moves],
    )


def counted_out(counted: ChangeForSign, lang: Lang) -> CountedOut:
    table, text, rashi, house = _names(lang)
    themes = table["house_theme"]

    def theme(number: int) -> str:
        return str(text["theme"].format(house=house[number - 1], theme=themes[number - 1]))

    moves = []
    for item in counted.moves:
        values = {
            "planet": table["planet"][item.move.body.value]["name"],
            "from_house": house[item.from_house - 1],
            "to_house": house[item.to_house - 1],
        }
        moves.append(
            HouseMoveOut(
                body=item.move.body,
                from_sign=RASHI[item.move.from_sign],
                to_sign=RASHI[item.move.to_sign],
                from_house=item.from_house,
                to_house=item.to_house,
                text=text["house_move"].format(**values),
                short=text["house_short"].format(**values),
                from_theme=_capital(theme(item.from_house), lang),
                to_theme=_capital(theme(item.to_house), lang),
            )
        )
    others = [
        OtherOut(
            body=body,
            sign=RASHI[sign],
            house=number,
            text=text["other"].format(
                planet=table["planet"][body.value]["name"],
                sign=rashi[RASHI[sign]]["name"],
                house=house[number - 1],
            ),
        )
        for body, sign, number in counted.others
    ]
    return CountedOut(
        sign=RASHI[counted.sign],
        sign_name=rashi[RASHI[counted.sign]]["name"],
        moves=moves,
        others=others,
    )


def _change_or_404(change_id: str) -> Change:
    change = find_change(EPHEMERIS, change_id)
    if change is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "unknown change")
    return change


def _lagna_or_404(lagna: str) -> int:
    if lagna not in RASHI:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "unknown lagna")
    return RASHI.index(lagna)


LangQuery = Annotated[Lang, Query()]
ChangeId = Annotated[str, Path(max_length=40)]


@router.get("/v1/changes", response_model=ChangeListResponse)
def list_changes(response: Response, lang: LangQuery = "en") -> ChangeListResponse:
    """Every change shown on the list page, in time order."""
    response.headers.update(CACHE)
    return ChangeListResponse(
        rule_set=RULE_SET,
        provisional=PROVISIONAL,
        changes=[change_out(c, lang) for c in changes_between(EPHEMERIS, START, LIST_END)],
    )


@router.get("/v1/changes/{change_id}", response_model=ChangeHubResponse)
def change_hub(
    change_id: ChangeId, response: Response, lang: LangQuery = "en"
) -> ChangeHubResponse:
    """One change, counted from each of the twelve lagnas."""
    change = _change_or_404(change_id)
    response.headers.update(CACHE)
    return ChangeHubResponse(
        rule_set=RULE_SET,
        provisional=PROVISIONAL,
        change=change_out(change, lang),
        lagnas=[counted_out(count_from(change, sign), lang) for sign in range(12)],
    )


@router.get("/v1/changes/{change_id}/{lagna}", response_model=ChangeLagnaResponse)
def change_lagna(
    change_id: ChangeId,
    lagna: Annotated[str, Path(max_length=20)],
    response: Response,
    lang: LangQuery = "en",
) -> ChangeLagnaResponse:
    """One change for one lagna. The same houses hold for that Moon sign (gochara)."""
    change = _change_or_404(change_id)
    sign = _lagna_or_404(lagna)
    response.headers.update(CACHE)
    return ChangeLagnaResponse(
        rule_set=RULE_SET,
        provisional=PROVISIONAL,
        change=change_out(change, lang),
        lagna=counted_out(count_from(change, sign), lang),
    )


@router.post("/v1/changes/personal", response_model=UpcomingResponse)
def upcoming_changes(body: HadahanRequest, db: PlacesDb) -> UpcomingResponse:
    """The changes in the next twelve months, counted from this chart's lagna and Moon sign."""
    birth = resolve_birth(body, db)
    if birth.utc is None:
        return UpcomingResponse(
            status=birth.time.status,
            time=birth.time,
            rule_set=RULE_SET,
            provisional=PROVISIONAL,
            lagna=None,
            moon_sign=None,
            changes=[],
        )
    chart = compute_chart(EPHEMERIS, birth.utc, birth.latitude, birth.longitude)
    now = (body.as_of or dt.datetime.now(dt.UTC)).astimezone(dt.UTC)
    lagna, moon = chart.lagna.sign, chart.moon.sign
    return UpcomingResponse(
        status="ok",
        time=birth.time,
        rule_set=RULE_SET,
        provisional=PROVISIONAL,
        lagna=RASHI[lagna],
        moon_sign=RASHI[moon],
        changes=[
            UpcomingChange(
                change=change_out(change, body.lang),
                lagna=counted_out(count_from(change, lagna), body.lang),
                gochara=counted_out(count_from(change, moon), body.lang),
            )
            for change in all_changes(EPHEMERIS)
            if now <= change.moment < now + AHEAD
        ],
    )


@router.post("/v1/changes/{change_id}/personal", response_model=PersonalChangeResponse)
def personal_change(
    change_id: ChangeId, body: HadahanRequest, db: PlacesDb
) -> PersonalChangeResponse:
    """One change for one birth chart: from the lagna, and from the Moon sign (gochara)."""
    change = _change_or_404(change_id)
    birth = resolve_birth(body, db)
    out = change_out(change, body.lang)
    if birth.utc is None:
        return PersonalChangeResponse(
            status=birth.time.status,
            time=birth.time,
            rule_set=RULE_SET,
            provisional=PROVISIONAL,
            change=out,
            lagna=None,
            gochara=None,
        )
    chart = compute_chart(EPHEMERIS, birth.utc, birth.latitude, birth.longitude)
    return PersonalChangeResponse(
        status="ok",
        time=birth.time,
        rule_set=RULE_SET,
        provisional=PROVISIONAL,
        change=out,
        lagna=counted_out(count_from(change, chart.lagna.sign), body.lang),
        gochara=counted_out(count_from(change, chart.moon.sign), body.lang),
    )
