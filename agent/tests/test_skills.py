"""Every skill folder holds a valid SKILL.md (Agent Skills format), so the agent can find it."""

import re

import pytest
import yaml

from app.graph import SKILLS_DIR

SKILL_DIRS = sorted(p for p in SKILLS_DIR.iterdir() if p.is_dir())
FRONTMATTER = re.compile(r"\A---\n(.*?)\n---\n", re.DOTALL)


def test_there_are_skills() -> None:
    assert SKILL_DIRS


SIGNS = [
    ("Mesha", "Mars"),
    ("Vrishabha", "Venus"),
    ("Mithuna", "Mercury"),
    ("Kataka", "Moon"),
    ("Simha", "Sun"),
    ("Kanya", "Mercury"),
    ("Tula", "Venus"),
    ("Vrischika", "Mars"),
    ("Dhanu", "Jupiter"),
    ("Makara", "Saturn"),
    ("Kumbha", "Saturn"),
    ("Meena", "Jupiter"),
]


def test_house_lord_table_matches_the_sign_rulers() -> None:
    """The personal-reading notes carry a lookup of who rules each house for each rising sign.

    The model reads it instead of counting signs, so a wrong cell would become a wrong
    reading. Recompute every row from the sign rulers and compare.
    """
    text = (SKILLS_DIR / "personal-reading" / "reference.md").read_text(encoding="utf-8")
    rows = {}
    for line in text.splitlines():
        cells = [c.strip() for c in line.strip().strip("|").split("|")]
        if len(cells) == 13 and cells[0] in {s for s, _ in SIGNS}:
            rows[cells[0]] = cells[1:]
    assert set(rows) == {s for s, _ in SIGNS}, "one row per rising sign"
    for index, (sign, _) in enumerate(SIGNS):
        expected = [SIGNS[(index + house) % 12][1] for house in range(12)]
        assert rows[sign] == expected, f"wrong house lords for rising sign {sign}"


def test_sign_names_match_the_site() -> None:
    """Sign names in the notes are the site's own, so the chat and the page agree."""
    labels = SKILLS_DIR.parents[1] / "backend" / "app" / "data" / "labels" / "en.yaml"
    if not labels.exists():  # the agent is built from its own folder in Docker
        pytest.skip("backend labels not available")
    rashi = yaml.safe_load(labels.read_text(encoding="utf-8"))["rashi"]
    assert {v["name"] for v in rashi.values()} == {s for s, _ in SIGNS}


@pytest.mark.parametrize("folder", SKILL_DIRS, ids=lambda p: p.name)
def test_skill_file_is_valid(folder) -> None:  # type: ignore[no-untyped-def]
    text = (folder / "SKILL.md").read_text(encoding="utf-8")
    match = FRONTMATTER.match(text)
    assert match, "SKILL.md must start with YAML frontmatter between --- lines"
    meta = yaml.safe_load(match.group(1))
    assert meta["name"] == folder.name, "name must match the folder name"
    assert re.fullmatch(r"[a-z0-9]+(-[a-z0-9]+)*", meta["name"])
    assert 0 < len(meta["description"]) <= 1024
    assert text[match.end() :].strip(), "the skill needs instructions after the frontmatter"
