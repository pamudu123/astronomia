"""A parent or guardian's consent to use a child's birth details (docs/09).

The child tools refuse birth details without it. The evidence kept is one log line: the time,
the tool, the language and the version of the wording. Never the child's details, an account
or a network address, so the line says consent was given but not by whom.
"""

import logging
from typing import Literal

logger = logging.getLogger("astronomia.consent")

# The wording beside the box (guardian in frontend/messages/*.json). Change both together.
WORDING = "2026-11-23"

MISSING = "a parent or guardian's consent is needed for a child's birth details"

Tool = Literal["baby_letters", "first_letters"]


def record_consent(tool: Tool, lang: str) -> None:
    logger.info("guardian consent tool=%s wording=%s lang=%s", tool, WORDING, lang)
