"""The chart results must not change by accident. See scripts/make_golden.py."""

import json
from datetime import date, time
from pathlib import Path
from typing import Any

import pytest

from app.engine.chart import compute_chart
from app.engine.ephemeris import SwissEphemeris
from app.engine.timeconv import resolve_local_time
from app.engine.zodiac import NAKSHATRA, RASHI

GOLDEN: list[dict[str, Any]] = json.loads(
    (Path(__file__).parent / "golden" / "charts.json").read_text(encoding="utf-8")
)


@pytest.mark.parametrize("case", GOLDEN, ids=lambda c: c["name"])
def test_golden_chart(case: dict[str, Any]) -> None:
    given = case["input"]
    resolved = resolve_local_time(
        date.fromisoformat(given["date"]), time.fromisoformat(given["time"]), given["timezone"]
    )
    assert resolved.utc is not None
    chart = compute_chart(SwissEphemeris(), resolved.utc, given["latitude"], given["longitude"])
    assert RASHI[chart.lagna.sign] == case["lagna"]
    assert RASHI[chart.moon.sign] == case["moon_rashi"]
    assert NAKSHATRA[chart.moon.nakshatra] == case["moon_nakshatra"]
    assert chart.moon.pada == case["moon_pada"]
    assert {b.value: RASHI[p.point.sign] for b, p in chart.planets.items()} == case["planets"]
