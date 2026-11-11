"""Write the golden charts in tests/golden/charts.json from the current engine.

Run from backend/:  uv run python scripts/make_golden.py
Only run this on purpose (for example after an astrologer has confirmed a change), because
the golden file is what protects the chart results from accidental changes.
"""

import json
import sys
from datetime import date, time
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))

from app.engine.chart import compute_chart  # noqa: E402
from app.engine.ephemeris import SwissEphemeris  # noqa: E402
from app.engine.timeconv import resolve_local_time  # noqa: E402
from app.engine.zodiac import NAKSHATRA, RASHI  # noqa: E402

BIRTHS = [
    ("kandy_1995", date(1995, 4, 19), time(14, 35), 7.2906, 80.6336, "Asia/Colombo"),
    ("colombo_1996", date(1996, 6, 1), time(10, 0), 6.9355, 79.8487, "Asia/Colombo"),
    ("jaffna_1960", date(1960, 11, 11), time(4, 15), 9.6684, 80.0074, "Asia/Colombo"),
    ("london_1985", date(1985, 7, 15), time(8, 20), 51.5085, -0.1257, "Europe/London"),
    ("sydney_2001", date(2001, 12, 25), time(23, 50), -33.8678, 151.2073, "Australia/Sydney"),
    ("new_york_1970", date(1970, 3, 1), time(6, 0), 40.7143, -74.006, "America/New_York"),
]

OUT = BACKEND / "tests" / "golden" / "charts.json"


def main() -> None:
    ephemeris = SwissEphemeris()
    charts = []
    for name, day, clock, lat, lon, tz in BIRTHS:
        resolved = resolve_local_time(day, clock, tz)
        assert resolved.utc is not None, name
        chart = compute_chart(ephemeris, resolved.utc, lat, lon)
        charts.append(
            {
                "name": name,
                "input": {
                    "date": day.isoformat(),
                    "time": clock.isoformat("minutes"),
                    "latitude": lat,
                    "longitude": lon,
                    "timezone": tz,
                },
                # Set to true once an astrologer or an independent source confirms the values.
                "checked": False,
                "lagna": RASHI[chart.lagna.sign],
                "moon_rashi": RASHI[chart.moon.sign],
                "moon_nakshatra": NAKSHATRA[chart.moon.nakshatra],
                "moon_pada": chart.moon.pada,
                "planets": {b.value: RASHI[p.point.sign] for b, p in chart.planets.items()},
            }
        )
    OUT.write_text(json.dumps(charts, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"wrote {len(charts)} charts to {OUT}")


if __name__ == "__main__":
    main()
