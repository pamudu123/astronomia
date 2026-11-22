"""Pictures drawn for each report from its own results: the sky wheel, the life periods bar and
the match's factor ring.

Each is SVG for the shapes, with any words placed over it as ordinary text (positions in per
cent), because the PDF renderer does not join Sinhala letters inside SVG text. Only numbers
go inside the SVG. Nothing here works out a fact: it draws what the engine returned.
"""

import datetime as dt
import math
from collections.abc import Sequence
from dataclasses import dataclass

from markupsafe import Markup

from app.engine.zodiac import RASHI
from app.reports.artwork import glyph_strokes

# The paper palette (report.css): bronze, ink, soft ink, rules, teal and coral.
GOLD = "#8a6212"
GOLD_SOFT = "#c9a95c"
INK = "#1b1914"
SOFT = "#6b6558"
RULE = "#ddd5c2"
TINT = "#f3ecdb"
TEAL = "#3d7059"
CORAL = "#a8492a"

SIZE = 300  # the sky wheel's own units


@dataclass(frozen=True)
class Tag:
    """Words placed over a drawing: the centre of the text, in per cent of its box."""

    text: str
    left: float
    top: float
    kind: str = ""  # a class for the text: "moon", "lagna", "now", ...


@dataclass(frozen=True)
class Drawing:
    """A picture: its SVG, and the words placed over it."""

    svg: Markup
    tags: list[Tag]


def _f(value: float) -> str:
    return f"{value:.2f}".rstrip("0").rstrip(".")


def _point(angle: float, radius: float) -> tuple[float, float]:
    """A point on the wheel; angles in degrees, counter-clockwise from the right."""
    rad = math.radians(angle)
    return SIZE / 2 + radius * math.cos(rad), SIZE / 2 - radius * math.sin(rad)


def spread(angles: Sequence[float], gap: float) -> list[float]:
    """Angles nudged apart so that neighbours are at least `gap` degrees from each other.

    Keeps the order and moves the angles as little as it can (least squares): crowded planets
    fan out around where they really are. With too many for the circle, they share it evenly.
    The circle is cut at its widest empty stretch, then the spacing is solved along that line
    by pooling neighbours that are too close (pool adjacent violators).
    """
    count = len(angles)
    if count < 2:
        return list(angles)
    gap = min(gap, 360 / count)
    order = sorted(range(count), key=lambda i: angles[i] % 360)
    line = [angles[i] % 360 for i in order]
    # The empty stretch after each angle; after the last it runs on round to the first.
    stretches = [line[k + 1] - line[k] for k in range(count - 1)] + [line[0] + 360 - line[-1]]
    widest = max(range(count), key=lambda k: stretches[k])
    start = (widest + 1) % count
    line = line[start:] + [a + 360 for a in line[:start]]
    order = order[start:] + order[:start]
    # Spaced by `gap` is the same as "never decreasing" once angle k has k gaps taken off.
    pools: list[tuple[float, int]] = []  # mean, size
    for k, value in enumerate(line):
        mean, size = value - k * gap, 1
        while pools and pools[-1][0] > mean:
            before, count_before = pools.pop()
            mean = (before * count_before + mean * size) / (count_before + size)
            size += count_before
        pools.append((mean, size))
    fitted = [mean for mean, size in pools for _ in range(size)]
    result = [0.0] * count
    for k, i in enumerate(order):
        result[i] = (fitted[k] + k * gap) % 360
    return result


@dataclass(frozen=True)
class Placed:
    key: str  # the body, or "lagna"
    label: str  # its short name in the report's language
    longitude: float  # sidereal, 0 to 360


def sky_wheel(lagna: float, planets: Sequence[Placed], moon_key: str = "moon") -> Drawing:
    """The zodiac as a wheel with the lagna on the left, and each planet where it was.

    The twelve signs run counter-clockwise from the lagna's sign, so each sign's sector is also
    its house (whole sign houses, as the report uses). Returns the SVG and the planet names to
    place over it.
    """
    lagna_sign = int(lagna // 30)

    def angle(longitude: float) -> float:
        return 180 + (longitude - lagna)

    parts: list[str] = []
    # Rings.
    for radius, width, color in ((146, 1.4, GOLD), (118, 0.8, GOLD), (64, 0.6, GOLD_SOFT)):
        parts.append(
            f'<circle cx="150" cy="150" r="{radius}" fill="none" stroke="{color}" '
            f'stroke-width="{width}"/>'
        )
    # The lagna's sector, lightly filled.
    start, end = angle(lagna_sign * 30), angle(lagna_sign * 30 + 30)
    (x1, y1), (x2, y2) = _point(start, 146), _point(end, 146)
    (x3, y3), (x4, y4) = _point(end, 118), _point(start, 118)
    parts.append(
        f'<path d="M{_f(x1)} {_f(y1)} A146 146 0 0 0 {_f(x2)} {_f(y2)} L{_f(x3)} {_f(y3)} '
        f'A118 118 0 0 1 {_f(x4)} {_f(y4)} Z" fill="{TINT}"/>'
    )
    for sign in range(12):
        edge = angle(sign * 30)
        (ax, ay), (bx, by) = _point(edge, 64), _point(edge, 146)
        parts.append(
            f'<line x1="{_f(ax)}" y1="{_f(ay)}" x2="{_f(bx)}" y2="{_f(by)}" stroke="{RULE}" '
            'stroke-width="0.7"/>'
        )
        # The sign's symbol in the outer ring, and its house number inside.
        cx, cy = _point(angle(sign * 30 + 15), 132)
        scale = 0.17
        parts.append(
            f'<g transform="translate({_f(cx - 50 * scale)} {_f(cy - 50 * scale)}) '
            f'scale({scale})">{glyph_strokes(RASHI[sign], GOLD)}</g>'
        )
        hx, hy = _point(angle(sign * 30 + 15), 73)
        house = (sign - lagna_sign) % 12 + 1
        parts.append(
            f'<text x="{_f(hx)}" y="{_f(hy + 2.6)}" text-anchor="middle" font-size="7.5" '
            f'font-family="DM Sans" fill="{SOFT}">{house}</text>'
        )
    # Degree ticks every 10 degrees on the inner edge of the sign ring.
    for degree in range(0, 360, 10):
        (ax, ay), (bx, by) = _point(angle(degree), 118), _point(angle(degree), 113)
        parts.append(
            f'<line x1="{_f(ax)}" y1="{_f(ay)}" x2="{_f(bx)}" y2="{_f(by)}" stroke="{GOLD_SOFT}" '
            'stroke-width="0.6"/>'
        )
    # The lagna line, from the centre out to the left.
    lx, ly = _point(180, 146)
    parts.append(
        f'<line x1="150" y1="150" x2="{_f(lx)}" y2="{_f(ly)}" stroke="{GOLD}" '
        'stroke-width="1.2" stroke-dasharray="3 2"/>'
    )
    # The brand star in the middle.
    parts.append(
        f'<path fill="{GOLD}" d="M150 138c.6 6 2.9 10.3 12 12.8-9.1 2.5-11.4 6.8-12 12.8'
        '-.6-6-2.9-10.3-12-12.8 9.1-2.5 11.4-6.8 12-12.8Z" transform="translate(0 -0.8)"/>'
    )

    tags: list[Tag] = []
    true_angles = [angle(p.longitude) for p in planets]
    label_angles = spread(true_angles, 15)
    for planet, true, shown in zip(planets, true_angles, label_angles, strict=True):
        dx, dy = _point(true, 106)
        is_moon = planet.key == moon_key
        parts.append(
            f'<circle cx="{_f(dx)}" cy="{_f(dy)}" r="{3.2 if is_moon else 2.4}" '
            f'fill="{TEAL if is_moon else GOLD}"/>'
        )
        (ax, ay), (bx, by) = _point(true, 102), _point(shown, 94)
        parts.append(
            f'<line x1="{_f(ax)}" y1="{_f(ay)}" x2="{_f(bx)}" y2="{_f(by)}" stroke="{GOLD_SOFT}" '
            'stroke-width="0.5"/>'
        )
        tx, ty = _point(shown, 84)
        tags.append(
            Tag(
                planet.label,
                round(100 * tx / SIZE, 2),
                round(100 * ty / SIZE, 2),
                "moon" if is_moon else "",
            )
        )
    svg = (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {SIZE} {SIZE}">'
        + "".join(parts)
        + "</svg>"
    )
    return Drawing(Markup(svg), tags)


@dataclass(frozen=True)
class Span:
    label: str  # the period's planet, in the report's language
    start: dt.date
    end: dt.date
    now: bool = False


def _years(start: dt.date, end: dt.date) -> float:
    return (end - start).days / 365.25


def periods_bar(birth: dt.date, spans: Sequence[Span], today: dt.date, now_label: str) -> Drawing:
    """The main life periods as one bar from birth, each as wide as it is long, with today marked.

    Ages are marked every ten years under the bar. A period too narrow for its name keeps only
    its colour (the table under the bar lists them all).
    """
    if not spans:
        return Drawing(Markup(""), [])
    end = spans[-1].end
    total = max(_years(birth, end), 1.0)
    width, top, height = 1000, 14, 34

    def x(day: dt.date) -> float:
        return width * min(max(_years(birth, day), 0.0), total) / total

    fills = ("#efe5cb", "#e1ebe4")
    parts: list[str] = [
        f'<rect x="0" y="{top}" width="{width}" height="{height}" rx="6" fill="{TINT}"/>'
    ]
    tags: list[Tag] = []
    for index, span in enumerate(spans):
        x0, x1 = x(max(span.start, birth)), x(span.end)
        if x1 <= x0:
            continue
        fill = GOLD if span.now else fills[index % 2]
        parts.append(
            f'<rect x="{_f(x0 + 0.8)}" y="{top}" width="{_f(max(x1 - x0 - 1.6, 0.5))}" '
            f'height="{height}" rx="4" fill="{fill}"/>'
        )
        if x1 - x0 >= 52:
            tags.append(
                Tag(
                    span.label,
                    round(100 * (x0 + x1) / 2 / width, 2),
                    46.0,
                    "on-gold" if span.now else "",
                )
            )
    for age in range(10, int(total) + 1, 10):
        ax = width * age / total
        parts.append(
            f'<line x1="{_f(ax)}" y1="{top + height + 2}" x2="{_f(ax)}" y2="{top + height + 8}" '
            f'stroke="{GOLD_SOFT}" stroke-width="1.2"/>'
            f'<text x="{_f(ax)}" y="{top + height + 20}" text-anchor="middle" font-size="11" '
            f'font-family="DM Sans" fill="{SOFT}">{age}</text>'
        )
    if birth <= today <= end:
        nx = x(today)
        parts.append(
            f'<path d="M{_f(nx - 6)} {top - 8} L{_f(nx + 6)} {top - 8} L{_f(nx)} {top} Z" '
            f'fill="{INK}"/>'
            f'<line x1="{_f(nx)}" y1="{top + height}" x2="{_f(nx)}" y2="{top + height + 9}" '
            f'stroke="{INK}" stroke-width="2.4"/>'
        )
        tags.append(Tag(now_label, round(100 * nx / width, 2), 0.0, "now"))
    svg = (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} 76" '
        'preserveAspectRatio="none">' + "".join(parts) + "</svg>"
    )
    return Drawing(Markup(svg), tags)


def factor_ring(results: Sequence[str]) -> Markup:
    """One segment per factor around a ring: "pass", "fail" or "unchecked", in the page's order."""
    count = len(results)
    if not count:
        return Markup("")
    gap = 2.4
    outer, inner = 140, 112
    parts: list[str] = [
        f'<circle cx="150" cy="150" r="{outer + 8}" fill="none" stroke="{RULE}" '
        'stroke-width="0.8"/>'
    ]
    for index, result in enumerate(results):
        a0 = 90 - index * 360 / count - gap / 2
        a1 = 90 - (index + 1) * 360 / count + gap / 2
        (x1, y1), (x2, y2) = _point(a0, outer), _point(a1, outer)
        (x3, y3), (x4, y4) = _point(a1, inner), _point(a0, inner)
        fill, stroke = {
            "pass": (GOLD, GOLD),
            "fail": ("#f6e3da", CORAL),
            "unchecked": ("#f1eee6", RULE),
        }[result]
        parts.append(
            f'<path d="M{_f(x1)} {_f(y1)} A{outer} {outer} 0 0 1 {_f(x2)} {_f(y2)} '
            f'L{_f(x3)} {_f(y3)} A{inner} {inner} 0 0 0 {_f(x4)} {_f(y4)} Z" '
            f'fill="{fill}" stroke="{stroke}" stroke-width="1"/>'
        )
    return Markup(
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {SIZE} {SIZE}">'
        + "".join(parts)
        + "</svg>"
    )
