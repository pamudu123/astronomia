"""Our porondam factors against the results a Sri Lankan porondam site gave for test births.

The factors added in rule sets 2 and 3 that follow the site were built from these results and must
agree with every one. "medium" counts as agreeing. See docs/03-porondam-domain-notes.md.
"""

import json
from pathlib import Path

import pytest

from app.engine.porondam import match, star_point

ROWS = json.loads((Path(__file__).parent / "golden" / "porondam_observed.json").read_text())["rows"]

# The site's name for a factor, and ours. Varna and Graha are not here: the site's own methods
# could not be worked out, so we use published methods instead (see the domain notes).
ADDED = {
    "gothra": "gothra",
    "pakshi": "pakshi",
    "linga": "linga",
    "dina": "weekday",
    "bhuta": "bhuta",
    "wruksha": "vruksha",
    "ayusha": "ayusha",
}


@pytest.mark.parametrize("row", ROWS, ids=lambda r: f"{r['bride'][0]}-{r['groom'][0]}")
def test_added_factors_agree_with_the_site(row: dict) -> None:  # type: ignore[type-arg]
    result = match(
        star_point(*row["bride"]),
        star_point(*row["groom"]),
        weekdays=tuple(row["weekdays"]),
        lagnas=tuple(row["lagnas"]),
    )
    ours = {f.id: f.passed for f in result.factors}
    for theirs, our_id in ADDED.items():
        assert ours[our_id] is (row["results"][theirs] != "bad"), theirs


def test_the_site_agrees_with_our_yoni_and_nadi() -> None:
    # Vedha also agreed on the first 34 couples. The site marks three more pairs than our table
    # (see the domain notes), so it is left out here.
    for row in ROWS:
        result = match(star_point(*row["bride"]), star_point(*row["groom"]))
        ours = {f.id: f.passed for f in result.factors}
        for factor in ("yoni", "nadi"):
            assert ours[factor] is (row["results"][factor] != "bad"), factor
