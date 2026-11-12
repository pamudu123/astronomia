"""The Sri Lankan square kendara for the PDF.

The same drawing as the website's (frontend/components/hadahan/Kendara.tsx): house 1, the
lagna, is the box at the top centre, and houses run anticlockwise. PROVISIONAL: the direction
is waiting for an astrologer's confirmation (docs/08).

The lines are SVG. The planet names are placed over them as ordinary text, because the PDF
renderer does not join Sinhala letters inside SVG text.
"""

from collections.abc import Iterable
from dataclasses import dataclass

SIZE = 300  # the drawing's own units, as on the website

# The centre of each house, in a 300 x 300 drawing.
HOUSE_CENTRES: dict[int, tuple[float, float]] = {
    1: (150, 56),
    2: (68, 30),
    3: (30, 68),
    4: (50, 150),
    5: (30, 232),
    6: (68, 270),
    7: (150, 250),
    8: (232, 270),
    9: (270, 232),
    10: (250, 150),
    11: (270, 68),
    12: (232, 30),
}
TRIANGLES = frozenset({2, 3, 5, 6, 8, 9, 11, 12})
LINES = (
    "M0 0H300V300H0ZM100 0V300M200 0V300M0 100H300M0 200H300"
    "M0 0L100 100M300 0L200 100M0 300L100 200M300 300L200 200"
)


@dataclass(frozen=True)
class Label:
    text: str
    left: float  # per cent of the drawing's width, the centre of the text
    top: float  # per cent of the drawing's height
    highlight: bool = False


def planet_labels(
    placed: Iterable[tuple[str, int]], short_names: dict[str, str], highlight: str | None = None
) -> list[Label]:
    """Positions for each (body, house) pair, stacked within its house like the website."""
    by_house: dict[int, list[str]] = {}
    for body, house in placed:
        by_house.setdefault(house, []).append(body)

    result = []
    for house, bodies in sorted(by_house.items()):
        cx, cy = HOUSE_CENTRES[house]
        step = 15 if house in TRIANGLES else 19
        columns = 2 if house not in TRIANGLES and len(bodies) > 4 else 1
        rows = -(-len(bodies) // columns)
        top = cy - (rows - 1) * step / 2 + (8 if house == 1 else 0)
        for index, body in enumerate(bodies):
            column, row = (index % 2, index // 2) if columns == 2 else (0, index)
            x = cx + (-16 if column == 0 else 16) if columns == 2 else cx
            y = top + row * step
            result.append(
                Label(
                    text=short_names[body],
                    left=round(100 * x / SIZE, 2),
                    top=round(100 * y / SIZE, 2),
                    highlight=body == highlight,
                )
            )
    return result
