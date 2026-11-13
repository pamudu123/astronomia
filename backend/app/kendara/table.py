"""A table of where the nine planets are each day, built once, for the old horoscope search.

The sidereal longitude of every body (Lahiri, mean node) at 00:00 UTC each day, from FIRST_DAY
to LAST_DAY, stored as hundredths of a degree in unsigned 16 bit numbers and gzip compressed.
Reading it is far faster than asking the ephemeris for every day of 136 years.

Run from backend/:  uv run python -m app.kendara.table
The app also builds it on first use if it is missing or out of date.
"""

import gzip
import json
from array import array
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta
from functools import lru_cache
from pathlib import Path

from app.engine.ephemeris import Ayanamsa, NodeType, SwissEphemeris, julian_day
from app.engine.zodiac import BODIES, Body

DATA_DIR = Path(__file__).resolve().parents[1] / "data"
DEFAULT_TABLE = DATA_DIR / "planets.bin.gz"

# Bump when the layout or the method changes, so old files are rebuilt.
TABLE_VERSION = "1"
FIRST_DAY = date(1900, 1, 1)
LAST_DAY = date(2035, 12, 31)
SCALE = 100  # hundredths of a degree
FULL_CIRCLE = 360 * SCALE


@dataclass(frozen=True)
class PlanetTable:
    first_day: date
    days: int
    longitudes: dict[Body, array]  # type: ignore[type-arg]

    def longitude(self, body: Body, day: int) -> float:
        """Degrees at 00:00 UTC on day number `day` (0 = first_day)."""
        return float(self.longitudes[body][day]) / SCALE

    def day_number(self, day: date) -> int:
        return (day - self.first_day).days

    def day_start(self, day: int) -> datetime:
        return datetime.combine(self.first_day + timedelta(days=day), datetime.min.time(), UTC)


def _header() -> dict[str, str]:
    return {
        "version": TABLE_VERSION,
        "first_day": FIRST_DAY.isoformat(),
        "last_day": LAST_DAY.isoformat(),
        "ayanamsa": Ayanamsa.LAHIRI.value,
        "node": NodeType.MEAN.value,
        "bodies": ",".join(body.value for body in BODIES),
    }


def build(path: Path = DEFAULT_TABLE) -> Path:
    """Work out every day's positions and write the table. Takes a little while."""
    ephemeris = SwissEphemeris(Ayanamsa.LAHIRI, NodeType.MEAN)
    days = (LAST_DAY - FIRST_DAY).days + 1
    columns = {body: array("H") for body in BODIES}
    for day in range(days):
        moment = datetime.combine(FIRST_DAY + timedelta(days=day), datetime.min.time(), UTC)
        positions = ephemeris.positions(julian_day(moment))
        for body in BODIES:
            columns[body].append(round(positions[body].longitude * SCALE) % FULL_CIRCLE)
    header = json.dumps(_header()).encode()
    temporary = path.with_suffix(".tmp")
    with gzip.open(temporary, "wb") as out:
        out.write(len(header).to_bytes(4, "little"))
        out.write(header)
        for body in BODIES:
            out.write(columns[body].tobytes())
    temporary.replace(path)
    return path


def _read(path: Path) -> PlanetTable | None:
    try:
        with gzip.open(path, "rb") as source:
            size = int.from_bytes(source.read(4), "little")
            header = json.loads(source.read(size))
            if header != _header():
                return None
            days = (LAST_DAY - FIRST_DAY).days + 1
            longitudes = {}
            for body in BODIES:
                column = array("H")
                column.frombytes(source.read(days * column.itemsize))
                if len(column) != days:
                    return None
                longitudes[body] = column
    except (OSError, EOFError, ValueError):
        return None
    return PlanetTable(FIRST_DAY, days, longitudes)


@lru_cache(maxsize=2)
def load(path: Path = DEFAULT_TABLE) -> PlanetTable:
    """The table, built first if it is missing or out of date. Kept in memory once read."""
    table = _read(path)
    if table is None:
        build(path)
        table = _read(path)
    if table is None:
        raise RuntimeError(f"could not build the planet table at {path}")
    return table


if __name__ == "__main__":
    import time

    started = time.perf_counter()
    print(build(), f"{time.perf_counter() - started:.1f} s")
