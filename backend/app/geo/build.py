"""Build the place search index (SQLite) from the Sri Lanka file and geonamescache.

Run from backend/:  uv run python -m app.geo.build
The app also builds it on first start if it is missing or out of date.
"""

import csv
import hashlib
import json
import math
import sqlite3
from collections.abc import Iterator
from dataclasses import dataclass
from importlib import metadata, resources
from pathlib import Path

from app.geo.normalize import normalize, word_keys
from app.geo.regions import LK_PROVINCES, WORLD_REGIONS

DATA_DIR = Path(__file__).resolve().parents[1] / "data"
LK_CSV = DATA_DIR / "places_lk.csv"
DEFAULT_DB = DATA_DIR / "places.sqlite"

# Bump when the schema or the ranking changes, so old index files are rebuilt.
BUILD_VERSION = "2"  # 2: regions for places abroad

FEATURE_BONUS = {"PPLC": 3.0, "PPLA": 2.0, "PPLA2": 1.0}
MAX_WORLD_ALTERNATES = 5


@dataclass
class PlaceRow:
    id: int
    name: str
    name_si: str | None
    country_code: str
    admin1: str
    latitude: float
    longitude: float
    timezone: str
    population: int
    feature_code: str
    search_names: list[str]


def rank(row: PlaceRow) -> float:
    """Bigger places first, with a lift for Sri Lanka, capitals and places with Sinhala names."""
    score = math.log10(row.population + 1)
    score += FEATURE_BONUS.get(row.feature_code, 0.0)
    if row.country_code == "LK":
        score += 2.0
    if row.name_si:
        score += 0.5
    return round(score, 4)


def source_fingerprint() -> str:
    digest = hashlib.sha256()
    digest.update(BUILD_VERSION.encode())
    digest.update(metadata.version("geonamescache").encode())
    digest.update(LK_CSV.read_bytes())
    return digest.hexdigest()


def sri_lanka_rows() -> Iterator[PlaceRow]:
    with LK_CSV.open(encoding="utf-8", newline="") as handle:
        for item in csv.DictReader(handle):
            latin = [n for n in item["latin_names"].split("|") if n]
            yield PlaceRow(
                id=int(item["geonameid"]),
                name=item["name"],
                name_si=item["name_si"] or None,
                country_code="LK",
                admin1=item["admin1"],
                latitude=float(item["latitude"]),
                longitude=float(item["longitude"]),
                timezone=item["timezone"],
                population=int(item["population"] or 0),
                feature_code=item["feature_code"],
                search_names=[item["asciiname"], *latin],
            )


def is_latin(text: str) -> bool:
    return all(ch.isascii() or "\u00c0" <= ch <= "\u024f" for ch in text)


def world_rows() -> Iterator[PlaceRow]:
    """Places outside Sri Lanka with 1000 or more people. The file has no feature codes."""
    path = resources.files("geonamescache") / "data" / "cities1000.json"
    cities: dict[str, dict[str, object]] = json.loads(path.read_text(encoding="utf-8"))
    for city in cities.values():
        if city["countrycode"] == "LK":
            continue
        population = int(str(city.get("population") or 0))
        raw = city.get("alternatenames")
        alternates = [str(a) for a in raw if is_latin(str(a))] if isinstance(raw, list) else []
        alternates = (
            sorted(set(alternates), key=len)[:MAX_WORLD_ALTERNATES] if population >= 15000 else []
        )
        yield PlaceRow(
            id=int(str(city["geonameid"])),
            name=str(city["name"]),
            name_si=None,
            country_code=str(city["countrycode"]),
            admin1=str(city.get("admin1code") or ""),
            latitude=float(str(city["latitude"])),
            longitude=float(str(city["longitude"])),
            timezone=str(city["timezone"]),
            population=population,
            feature_code="",
            search_names=alternates,
        )


def country_names() -> dict[str, str]:
    path = resources.files("geonamescache") / "data" / "countries.json"
    countries: dict[str, dict[str, object]] = json.loads(path.read_text(encoding="utf-8"))
    return {code: str(info["name"]) for code, info in countries.items()}


def region_names() -> dict[str, dict[str, str]]:
    """admin1 names by country for places abroad: US states from geonamescache, then ours."""
    path = resources.files("geonamescache") / "data" / "us_states.json"
    states: dict[str, dict[str, object]] = json.loads(path.read_text(encoding="utf-8"))
    return {"US": {code: str(info["name"]) for code, info in states.items()}, **WORLD_REGIONS}


SCHEMA = """
CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE places (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    name_si TEXT,
    country_code TEXT NOT NULL,
    country_name TEXT NOT NULL,
    admin1 TEXT NOT NULL,
    region TEXT,
    region_si TEXT,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    timezone TEXT NOT NULL,
    population INTEGER NOT NULL,
    rank REAL NOT NULL
);
CREATE TABLE place_names (key TEXT NOT NULL, place_id INTEGER NOT NULL, full INTEGER NOT NULL);
"""


def build(db_path: Path = DEFAULT_DB) -> Path:
    tmp = db_path.with_suffix(".tmp")
    tmp.unlink(missing_ok=True)
    countries = country_names()
    regions = region_names()
    con = sqlite3.connect(tmp)
    try:
        con.executescript(SCHEMA)
        places: list[tuple[object, ...]] = []
        names: list[tuple[str, int, int]] = []
        for row in [*sri_lanka_rows(), *world_rows()]:
            province = LK_PROVINCES.get(row.admin1) if row.country_code == "LK" else None
            abroad = regions.get(row.country_code, {}).get(row.admin1)
            places.append(
                (
                    row.id,
                    row.name,
                    row.name_si,
                    row.country_code,
                    countries.get(row.country_code, row.country_code),
                    row.admin1,
                    province["en"] if province else abroad,
                    province["si"] if province else None,
                    row.latitude,
                    row.longitude,
                    row.timezone,
                    row.population,
                    rank(row),
                )
            )
            keys: dict[str, int] = {}
            for label in [row.name, row.name_si or "", *row.search_names]:
                if not label:
                    continue
                full = normalize(label)
                for key in word_keys(label):
                    keys[key] = max(keys.get(key, 0), int(key == full))
            names.extend((key, row.id, full) for key, full in keys.items())
        con.executemany(f"INSERT OR IGNORE INTO places VALUES ({','.join('?' * 13)})", places)
        con.executemany("INSERT INTO place_names VALUES (?, ?, ?)", names)
        con.execute("CREATE INDEX place_names_key ON place_names (key)")
        con.execute("INSERT INTO meta VALUES ('fingerprint', ?)", (source_fingerprint(),))
        con.commit()
    finally:
        con.close()
    tmp.replace(db_path)
    return db_path


def is_current(db_path: Path = DEFAULT_DB) -> bool:
    if not db_path.exists():
        return False
    try:
        con = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
        try:
            found = con.execute("SELECT value FROM meta WHERE key = 'fingerprint'").fetchone()
        finally:
            con.close()
    except sqlite3.Error:
        return False
    return bool(found and found[0] == source_fingerprint())


def ensure_built(db_path: Path = DEFAULT_DB) -> Path:
    if not is_current(db_path):
        build(db_path)
    return db_path


if __name__ == "__main__":
    import time

    start = time.perf_counter()
    path = build()
    print(f"built {path} in {time.perf_counter() - start:.1f}s ({path.stat().st_size // 1024} KB)")
