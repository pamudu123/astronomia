"""Planet changes: each time Saturn, Jupiter or the nodes move into a new sign.

The changes are the same for everyone, so they are worked out once and kept. What differs
from person to person is only the house they fall in, counted from the lagna (or, for
gochara, from the Moon sign).
"""

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta, timezone

from app.engine.ephemeris import Ephemeris
from app.engine.transits import SLOW_BODIES, SignChange, retrograde_at, sign_changes, signs_at
from app.engine.zodiac import Body, whole_sign_house

RULE_SET = "changes_v1"
# House themes are waiting for an astrologer's confirmation.
PROVISIONAL = True

# Changes are listed from here. The start never moves, so the ids stay the same.
START = datetime(2026, 11, 1, tzinfo=UTC)
# Far enough ahead to find when the last listed planet moves on again.
LOOKAHEAD = datetime(2034, 1, 1, tzinfo=UTC)
# Sri Lankan almanacs and the pages print Sri Lanka time.
SRI_LANKA = timezone(timedelta(hours=5, minutes=30))

NODES = (Body.RAHU, Body.KETU)


@dataclass(frozen=True)
class PlanetMove:
    body: Body
    from_sign: int
    to_sign: int
    retrograde: bool  # a backward step; never set for the nodes, which always move backwards
    returning: bool  # a forward move back into the sign it stepped back out of
    until: datetime | None  # when it next changes sign
    next_sign: int | None  # the sign it moves into then


@dataclass(frozen=True)
class Change:
    id: str  # "rahu-ketu-2026-12", "jupiter-2027-01"
    kind: str  # "rahu-ketu", "saturn" or "jupiter"
    moment: datetime  # UTC, to the minute
    moves: tuple[PlanetMove, ...]
    others: tuple[tuple[Body, int], ...]  # the slow planets that do not move, and their signs


@dataclass(frozen=True)
class HouseMove:
    move: PlanetMove
    from_house: int
    to_house: int


@dataclass(frozen=True)
class ChangeForSign:
    """One change counted from one sign: the lagna, or the Moon sign for gochara."""

    change: Change
    sign: int
    moves: tuple[HouseMove, ...]
    others: tuple[tuple[Body, int, int], ...]  # body, sign, house
    rule_set: str = RULE_SET
    provisional: bool = PROVISIONAL


def _kind(body: Body) -> str:
    return "rahu-ketu" if body in NODES else body.value


def _id(kind: str, moment: datetime) -> str:
    local = moment.astimezone(SRI_LANKA)
    return f"{kind}-{local.year}-{local.month:02d}"


def _group(found: list[SignChange]) -> list[tuple[str, datetime, list[SignChange]]]:
    """Rahu and Ketu move at the same minute: one change, not two."""
    groups: list[tuple[str, datetime, list[SignChange]]] = []
    for change in found:
        kind = _kind(change.body)
        last = groups[-1] if groups else None
        if last and last[0] == kind and last[1] == change.moment:
            last[2].append(change)
        else:
            groups.append((kind, change.moment, [change]))
    return groups


_KEPT: dict[Ephemeris, tuple[Change, ...]] = {}


def all_changes(ephemeris: Ephemeris) -> tuple[Change, ...]:
    """Every change from START, in time order. The same for everyone, so it is kept."""
    if ephemeris not in _KEPT:
        _KEPT[ephemeris] = _work_out(ephemeris)
    return _KEPT[ephemeris]


def _work_out(ephemeris: Ephemeris) -> tuple[Change, ...]:
    found = sign_changes(ephemeris, START, LOOKAHEAD)
    # For each change, the same planet's next change (or itself when there is none).
    following = [
        next((c for c in found[index + 1 :] if c.body is change.body), change)
        for index, change in enumerate(found)
    ]
    backward = [
        change.body not in NODES and retrograde_at(ephemeris, change.moment)[change.body]
        for change in found
    ]
    # For each change, whether it undoes the same planet's last change, a backward step.
    returning = []
    for index, change in enumerate(found):
        before = next((i for i in range(index - 1, -1, -1) if found[i].body is change.body), None)
        returning.append(
            before is not None
            and backward[before]
            and not backward[index]
            and found[before].from_sign == change.to_sign
        )

    changes: list[Change] = []
    index = 0
    for kind, moment, group in _group(found):
        moves = []
        for change in group:
            after = following[index]
            has_next = after is not change
            moves.append(
                PlanetMove(
                    body=change.body,
                    from_sign=change.from_sign,
                    to_sign=change.to_sign,
                    retrograde=backward[index],
                    returning=returning[index],
                    until=after.moment if has_next else None,
                    next_sign=after.to_sign if has_next else None,
                )
            )
            index += 1
        # Rahu first, then Ketu.
        moves.sort(key=lambda move: SLOW_BODIES.index(move.body))
        signs = signs_at(ephemeris, moment)
        moving = {move.body for move in moves}
        others = tuple((body, signs[body]) for body in SLOW_BODIES if body not in moving)
        # The last changes before LOOKAHEAD have no "until"; they are never listed.
        if all(move.until is not None for move in moves):
            changes.append(Change(_id(kind, moment), kind, moment, tuple(moves), others))
    return tuple(changes)


def find_change(ephemeris: Ephemeris, change_id: str) -> Change | None:
    return next((c for c in all_changes(ephemeris) if c.id == change_id), None)


def changes_between(ephemeris: Ephemeris, start: datetime, end: datetime) -> list[Change]:
    return [c for c in all_changes(ephemeris) if start <= c.moment < end]


def count_from(change: Change, sign: int) -> ChangeForSign:
    """The houses each planet leaves and enters, counted from one sign."""
    return ChangeForSign(
        change=change,
        sign=sign,
        moves=tuple(
            HouseMove(
                move,
                whole_sign_house(move.from_sign, sign),
                whole_sign_house(move.to_sign, sign),
            )
            for move in change.moves
        ),
        others=tuple((body, other, whole_sign_house(other, sign)) for body, other in change.others),
    )


# Saturn counted from the Moon sign: the 12th, 1st and 2nd are Erashtaka, the 8th ashtama.
ERASHTAKA = frozenset({12, 1, 2})
ASHTAMA = 8


def saturn_notes(counted: ChangeForSign) -> list[str]:
    """Codes for the Saturn periods a move starts or ends, when counted from the Moon sign."""
    notes: list[str] = []
    for item in counted.moves:
        if item.move.body is not Body.SATURN:
            continue
        was, now = item.from_house in ERASHTAKA, item.to_house in ERASHTAKA
        if was and now:
            notes.append("erashtaka_continues")
        elif now:
            notes.append("erashtaka_starts")
        elif was:
            notes.append("erashtaka_ends")
        if item.to_house == ASHTAMA:
            notes.append("ashtama_starts")
        elif item.from_house == ASHTAMA:
            notes.append("ashtama_ends")
    return notes
