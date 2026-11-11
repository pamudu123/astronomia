"""Fetch the full list of populated places in Sri Lanka from GeoNames.

Run from backend/:  uv run python scripts/fetch_geonames_lk.py
Writes app/data/places_lk.csv, which is committed. Run it again only to refresh the data.
The live site never contacts GeoNames.

Data: GeoNames (https://www.geonames.org), licensed CC BY 4.0.
"""

import csv
import io
import sys
import urllib.request
import zipfile
from collections import defaultdict
from datetime import UTC, datetime
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))

from app.geo.sinhala import best_name, has_sinhala  # noqa: E402

PLACES_URL = "https://download.geonames.org/export/dump/LK.zip"
NAMES_URL = "https://download.geonames.org/export/dump/alternatenames/LK.zip"
OUT = BACKEND / "app" / "data" / "places_lk.csv"

FIELDS = [
    "geonameid",
    "name",
    "asciiname",
    "name_si",
    "latin_names",
    "latitude",
    "longitude",
    "feature_code",
    "admin1",
    "population",
    "timezone",
]


def is_latin(text: str) -> bool:
    """Latin letters (with accents), digits, spaces and simple punctuation only."""
    return all(ch.isascii() or "\u00c0" <= ch <= "\u024f" for ch in text)


def read_zip_text(url: str, member: str) -> list[list[str]]:
    with urllib.request.urlopen(url, timeout=60) as response:
        data = response.read()
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        text = archive.read(member).decode("utf-8")
    return [line.split("\t") for line in text.splitlines() if line]


def main() -> None:
    places = [row for row in read_zip_text(PLACES_URL, "LK.txt") if row[6] == "P"]
    names = read_zip_text(NAMES_URL, "LK.txt")

    sinhala: dict[str, list[tuple[str, bool]]] = defaultdict(list)
    for row in names:
        if row[2] == "si" and has_sinhala(row[3]):
            sinhala[row[1]].append((row[3], len(row) > 4 and row[4] == "1"))

    rows = []
    for row in places:
        geonameid, alternates = row[0], row[3].split(",") if row[3] else []
        candidates = sinhala.get(geonameid, []) + [
            (alt, False) for alt in alternates if has_sinhala(alt)
        ]
        latin = sorted({a.strip() for a in alternates if a.strip() and is_latin(a)})
        rows.append(
            {
                "geonameid": geonameid,
                "name": row[1],
                "asciiname": row[2],
                "name_si": best_name(candidates) or "",
                "latin_names": "|".join(n for n in latin if n not in (row[1], row[2]))[:400],
                "latitude": row[4],
                "longitude": row[5],
                "feature_code": row[7],
                "admin1": row[10],
                "population": row[14] or "0",
                "timezone": row[17],
            }
        )

    rows.sort(key=lambda r: int(r["geonameid"]))
    OUT.parent.mkdir(parents=True, exist_ok=True)
    with OUT.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=FIELDS)
        writer.writeheader()
        writer.writerows(rows)

    with_si = sum(1 for r in rows if r["name_si"])
    stamp = datetime.now(UTC).strftime("%Y-%m-%d")
    print(f"{stamp}: wrote {len(rows)} places ({with_si} with a Sinhala name) to {OUT}")


if __name__ == "__main__":
    main()
