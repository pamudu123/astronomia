"""Search the place index."""

import sqlite3
from dataclasses import dataclass
from pathlib import Path

from app.geo.normalize import normalize
from app.geo.regions import SRI_LANKA

MAX_LIMIT = 20


@dataclass(frozen=True)
class Place:
    id: int
    name: str
    name_si: str | None
    country_code: str
    country_name: str
    country_name_si: str | None
    region: str | None
    region_si: str | None
    latitude: float
    longitude: float
    timezone: str
    population: int


_COLUMNS = (
    "p.id, p.name, p.name_si, p.country_code, p.country_name, p.region, p.region_si, "
    "p.latitude, p.longitude, p.timezone, p.population"
)


def _connect(db_path: Path) -> sqlite3.Connection:
    return sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)


def _to_place(row: tuple[object, ...]) -> Place:
    (pid, name, name_si, cc, country, region, region_si, lat, lon, tz, population) = row
    return Place(
        id=int(str(pid)),
        name=str(name),
        name_si=str(name_si) if name_si else None,
        country_code=str(cc),
        country_name=str(country),
        country_name_si=SRI_LANKA["si"] if cc == "LK" else None,
        region=str(region) if region else None,
        region_si=str(region_si) if region_si else None,
        latitude=float(str(lat)),
        longitude=float(str(lon)),
        timezone=str(tz),
        population=int(str(population)),
    )


def search(db_path: Path, query: str, limit: int = 10) -> list[Place]:
    key = normalize(query)
    if not key:
        return []
    limit = max(1, min(limit, MAX_LIMIT))
    sql = f"""
        SELECT {_COLUMNS}, MAX(n.full AND n.key = :key) AS exact
        FROM place_names n JOIN places p ON p.id = n.place_id
        WHERE n.key >= :key AND n.key < :upper
        GROUP BY p.id
        ORDER BY exact DESC, p.rank DESC, p.name
        LIMIT :limit
    """
    con = _connect(db_path)
    try:
        rows = con.execute(
            sql, {"key": key, "upper": key + "\U0010ffff", "limit": limit}
        ).fetchall()
    finally:
        con.close()
    return [_to_place(row[:-1]) for row in rows]


def get_place(db_path: Path, place_id: int) -> Place | None:
    con = _connect(db_path)
    try:
        row = con.execute(f"SELECT {_COLUMNS} FROM places p WHERE p.id = ?", (place_id,)).fetchone()
    finally:
        con.close()
    return _to_place(row) if row else None
