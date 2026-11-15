"""Every skill folder holds a valid SKILL.md (Agent Skills format), so the agent can find it."""

import re

import pytest
import yaml

from app.graph import SKILLS_DIR

SKILL_DIRS = sorted(p for p in SKILLS_DIR.iterdir() if p.is_dir())
FRONTMATTER = re.compile(r"\A---\n(.*?)\n---\n", re.DOTALL)


def test_there_are_skills() -> None:
    assert SKILL_DIRS


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
