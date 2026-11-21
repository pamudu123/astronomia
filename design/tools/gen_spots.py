"""Draw the spot illustrations: small gold line pictures, one per topic of the AI reading.

Run from the repository root:  python3 design/tools/gen_spots.py

The same drawings go to two places:

- design/assets/web/spots/<name>.svg and <name>-light.svg: standalone files in the brand
  colours, for the dark and the light theme (social posts, slides, the PDF report). The
  frontend copies them to public/images/spots/ when it builds, so pages can use them by URL.
- frontend/lib/spots.ts: the drawings as data, drawn inline by components/Spot.tsx with the
  site's colour tokens, so they follow the light and dark theme on the page.

Style (design/README.md): thin gold lines, a teal accent, a faint orbit and a few stars behind.
No glows, no purple, no crystal balls. Every drawing sits on a 120 x 80 canvas.
"""

import math
import random
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "design" / "assets" / "web" / "spots"
TS = ROOT / "frontend" / "lib" / "spots.ts"

# The brand colours for the standalone files (frontend/app/globals.css).
THEMES = {
    "": {"line": "#E8B84B", "accent": "#7FD6C2", "back": "#2F2D28", "dot": "#B0AA9A", "bg": "#0A0A0A"},
    "-light": {"line": "#8A6212", "accent": "#3D7059", "back": "#D9D1BF", "dot": "#8A8478", "bg": "#F4F1EA"},
}

W, H = 120, 80


# ---- Shapes, as path data ----


def f(value: float) -> str:
    """A number for path data: at most two decimals, no trailing zeros."""
    text = f"{value:.2f}".rstrip("0").rstrip(".")
    return "0" if text == "-0" else text


def circle(cx: float, cy: float, r: float) -> str:
    return f"M{f(cx - r)} {f(cy)}a{f(r)} {f(r)} 0 1 0 {f(2 * r)} 0a{f(r)} {f(r)} 0 1 0 {f(-2 * r)} 0Z"


def ellipse(cx: float, cy: float, rx: float, ry: float, rotate: float = 0) -> str:
    """A whole ellipse turned by `rotate` degrees, as two arcs between the ends of its long axis."""
    a = math.radians(rotate)
    x1, y1 = cx - rx * math.cos(a), cy - rx * math.sin(a)
    x2, y2 = cx + rx * math.cos(a), cy + rx * math.sin(a)
    arc = f"{f(rx)} {f(ry)} {f(rotate)} 1 0"
    return f"M{f(x1)} {f(y1)}A{arc} {f(x2)} {f(y2)}A{arc} {f(x1)} {f(y1)}Z"


def half_ellipse(cx: float, cy: float, rx: float, ry: float, rotate: float) -> str:
    """The front (lower) half of a turned ellipse: a ring passing in front of a planet."""
    a = math.radians(rotate)
    x1, y1 = cx - rx * math.cos(a), cy - rx * math.sin(a)
    x2, y2 = cx + rx * math.cos(a), cy + rx * math.sin(a)
    return f"M{f(x1)} {f(y1)}A{f(rx)} {f(ry)} {f(rotate)} 0 0 {f(x2)} {f(y2)}"


def on_ellipse(cx: float, cy: float, rx: float, ry: float, rotate: float, angle: float) -> tuple[float, float]:
    """A point on a turned ellipse, `angle` degrees round from the end of its long axis."""
    t, a = math.radians(angle), math.radians(rotate)
    x, y = rx * math.cos(t), ry * math.sin(t)
    return cx + x * math.cos(a) - y * math.sin(a), cy + x * math.sin(a) + y * math.cos(a)


def rect(x: float, y: float, w: float, h: float, r: float = 0) -> str:
    if not r:
        return f"M{f(x)} {f(y)}h{f(w)}v{f(h)}h{f(-w)}Z"
    return (
        f"M{f(x + r)} {f(y)}h{f(w - 2 * r)}a{f(r)} {f(r)} 0 0 1 {f(r)} {f(r)}v{f(h - 2 * r)}"
        f"a{f(r)} {f(r)} 0 0 1 {f(-r)} {f(r)}h{f(-(w - 2 * r))}a{f(r)} {f(r)} 0 0 1 {f(-r)} {f(-r)}"
        f"v{f(-(h - 2 * r))}a{f(r)} {f(r)} 0 0 1 {f(r)} {f(-r)}Z"
    )


def sparkle(cx: float, cy: float, s: float) -> str:
    """The site's four-pointed star (the assistant's mark), filled."""
    k = s * 0.18
    return (
        f"M{f(cx)} {f(cy - s)}C{f(cx + k)} {f(cy - k)} {f(cx + k)} {f(cy - k)} {f(cx + s)} {f(cy)}"
        f"C{f(cx + k)} {f(cy + k)} {f(cx + k)} {f(cy + k)} {f(cx)} {f(cy + s)}"
        f"C{f(cx - k)} {f(cy + k)} {f(cx - k)} {f(cy + k)} {f(cx - s)} {f(cy)}"
        f"C{f(cx - k)} {f(cy - k)} {f(cx - k)} {f(cy - k)} {f(cx)} {f(cy - s)}Z"
    )


def rays(cx: float, cy: float, r1: float, r2: float, angles: list[float]) -> str:
    out = ""
    for degrees in angles:
        a = math.radians(degrees)
        out += f"M{f(cx + r1 * math.cos(a))} {f(cy + r1 * math.sin(a))}L{f(cx + r2 * math.cos(a))} {f(cy + r2 * math.sin(a))}"
    return out


def bezier(p0, p1, p2, p3, t: float) -> tuple[float, float]:
    u = 1 - t
    return (
        u**3 * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t**3 * p3[0],
        u**3 * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t**3 * p3[1],
    )


# ---- The drawings ----
#
# Each layer is (kind, path data). Kinds, drawn in this order of listing:
#   line    gold stroke            accent   teal stroke         dash  teal dashed stroke
#   fill    gold fill              afill    teal fill
#   cover   filled with the background, gold stroke: hides what is behind (a planet's ring)


def sunrise():
    return [
        ("line", "M26 56H94"),
        ("line", "M44 56A16 16 0 0 1 76 56"),
        ("line", rays(60, 56, 21, 27, [-160, -125, -90, -55, -20])),
        ("accent", "M38 63H82M49 69H71"),
        ("fill", sparkle(92, 20, 4)),
    ]


def work():
    return [
        ("line", rect(30, 34, 36, 25, 4)),
        ("line", "M42 34V30a3 3 0 0 1 3-3h6a3 3 0 0 1 3 3V34"),
        ("line", "M30 45H66"),
        ("line", rect(45, 42, 6, 6, 1.5)),
        ("accent", "M72 62H79V55H86V48H93V41"),
        ("accent", "M84 34L95 23M88 23H95V30"),
        ("fill", sparkle(22, 22, 3.5)),
    ]


def love():
    p1 = (51 + 14 * math.cos(math.radians(-130)), 42 + 14 * math.sin(math.radians(-130)))
    p2 = (69 + 14 * math.cos(math.radians(50)), 42 + 14 * math.sin(math.radians(50)))
    return [
        ("line", circle(51, 42, 14)),
        ("line", circle(69, 42, 14)),
        ("fill", circle(*p1, 2.6)),
        ("fill", circle(*p2, 2.6)),
        ("accent", "M60 47C56.5 44.5 54.5 42 56 40C57.3 38.4 59.2 38.8 60 40.4C60.8 38.8 62.7 38.4 64 40C65.5 42 63.5 44.5 60 47Z"),
        ("fill", sparkle(90, 18, 3.5)),
    ]


def couple():
    return [
        ("dash", "M45 41C53 27 66 24 75 32"),
        ("line", "M44 51C55 63 72 60 81 44"),
        ("fill", sparkle(38, 46, 8)),
        ("fill", sparkle(82, 36, 8)),
        ("afill", circle(60, 59.2, 1.8)),
    ]


def family():
    return [
        ("line", "M28 61H92"),
        ("line", "M40 61V41L60 25L80 41V61"),
        ("line", "M55 61V51a5 5 0 0 1 10 0V61"),
        ("line", rect(68, 45, 6, 6, 1)),
        ("accent", "M89 16.5A8 8 0 1 0 95 29A6.5 6.5 0 0 1 89 16.5Z"),
        ("fill", sparkle(24, 24, 3)),
    ]


def book():
    return [
        ("line", "M60 34C52 29 43 29 36 31V57C43 55 52 55 60 60C68 55 77 55 84 57V31C77 29 68 29 60 34Z"),
        ("line", "M60 34V60"),
        ("accent", "M42 38C47 37 51 37 55 39M42 44C47 43 51 43 55 45M42 50C47 49 51 49 55 51"),
        ("accent", "M65 39C69 37 73 37 78 38M65 45C69 43 73 43 78 44"),
        ("fill", sparkle(60, 17, 5)),
    ]


def travel():
    return [
        ("line", circle(48, 46, 15)),
        ("line", "M33 46H63"),
        ("line", "M48 31A7 15 0 0 0 48 61A7 15 0 0 0 48 31"),
        ("dash", "M26 62C42 76 76 58 87 30"),
        ("fill", "M84 27L98 19L92 33L89.5 28.5Z"),
        ("fill", sparkle(24, 22, 3)),
    ]


def lotus():
    return [
        ("line", "M60 25C67 34 67 46 60 56C53 46 53 34 60 25Z"),
        ("line", "M60 56C49 55 41 47 39 36C49 37 57 45 60 56Z"),
        ("line", "M60 56C71 55 79 47 81 36C71 37 63 45 60 56Z"),
        ("line", "M60 57C48 60 37 57 30 50M60 57C72 60 83 57 90 50"),
        ("accent", "M32 65C38 62 44 68 50 65C56 62 62 68 68 65C74 62 80 68 88 65"),
        ("fill", sparkle(90, 22, 3)),
    ]


def periods():
    p = [(24, 60), (38, 26), (82, 26), (96, 60)]
    nodes = [bezier(*p, t) for t in (0.1, 0.38, 0.66, 0.9)]
    now = nodes[1]
    layers = [("line", "M24 60C38 26 82 26 96 60"), ("line", "M20 66H100")]
    layers += [("fill", circle(x, y, 2.6)) for x, y in nodes]
    layers += [("accent", circle(*now, 6.5)), ("fill", sparkle(now[0], now[1] - 16, 4))]
    return layers


def saturn():
    return [
        ("line", ellipse(60, 42, 27, 8, -16)),
        ("cover", circle(60, 42, 12)),
        ("line", half_ellipse(60, 42, 27, 8, -16)),
        ("accent", circle(91, 21, 3.2)),
        ("fill", sparkle(26, 22, 3.5)),
    ]


def planets():
    inner = on_ellipse(60, 42, 21, 8, -12, 60)
    outer = on_ellipse(60, 42, 36, 15, -12, 200)
    return [
        ("line", ellipse(60, 42, 21, 8, -12)),
        ("line", ellipse(60, 42, 36, 15, -12)),
        ("fill", circle(60, 42, 5)),
        ("cover", circle(*inner, 2.8)),
        ("afill", circle(*outer, 3.6)),
        ("fill", sparkle(92, 18, 3)),
    ]


def shield():
    return [
        ("line", "M60 21L80 28V42C80 53 71 60 60 64C49 60 40 53 40 42V28Z"),
        ("accent", "M51 42L57.5 48.5L70 35"),
        ("fill", sparkle(88, 22, 3.5)),
        ("fill", sparkle(30, 56, 2.5)),
    ]


def mars():
    return [
        ("dash", circle(55, 47, 18)),
        ("line", circle(55, 47, 11)),
        ("line", "M63 39L77 25M68 25H77V34"),
        ("fill", sparkle(26, 22, 3)),
    ]


def wedding():
    return [
        ("line", circle(53, 49, 12)),
        ("line", circle(68, 49, 12)),
        ("line", "M53 37L48.5 31.5L50.5 27.5H55.5L57.5 31.5Z"),
        ("fill", sparkle(84, 24, 4.5)),
        ("afill", sparkle(36, 26, 2.8)),
    ]


def lamp():
    return [
        ("line", "M36 50H84C82 58 72 62 60 62C48 62 38 58 36 50Z"),
        ("line", "M52 62L50 68H70L68 62"),
        ("line", "M60 27C66 35 67 42 60 47C53 42 54 35 60 27Z"),
        ("accent", "M60 36C62.5 39 62.5 42 60 44C57.5 42 57.5 39 60 36Z"),
        ("fill", sparkle(88, 24, 3)),
        ("fill", sparkle(30, 30, 2.5)),
    ]


def pot():
    return [
        ("line", "M44 43C36 51 40 65 60 65C80 65 84 51 76 43Z"),
        ("line", "M41 43H79"),
        ("accent", "M47 43C47 36 54 33 60 35.5C66 33 73 36 73 43"),
        ("accent", "M45 43C44 46.5 45.5 48.5 43.5 52M75 43C76 46.5 74.5 48.5 76.5 52"),
        ("line", circle(92, 20, 5)),
        ("line", rays(92, 20, 8, 11.5, [0, 45, 90, 135, 180, 225, 270, 315])),
    ]


def cradle():
    return [
        ("line", "M36 40A24 24 0 0 0 84 40A28 28 0 0 1 36 40Z"),
        ("fill", sparkle(60, 23, 6)),
        ("afill", circle(44, 22, 1.6)),
        ("afill", circle(77, 17, 1.6)),
        ("afill", circle(84, 29, 1.2)),
    ]


def compass():
    return [
        ("line", circle(60, 42, 21)),
        ("line", rays(60, 42, 21, 25, [0, 90, 180, 270])),
        ("fill", "M60 25L64 42L60 59L56 42Z"),
        ("accent", "M43 42L60 38.5L77 42L60 45.5Z"),
        ("cover", circle(60, 42, 2.2)),
    ]


def constellation():
    stars = [(32, 54), (45, 36), (60, 45), (74, 27), (89, 39), (71, 59)]
    layers = [("line", "M32 54L45 36L60 45L74 27L89 39M60 45L71 59")]
    layers += [("fill", circle(x, y, 2.6)) for (x, y) in stars if (x, y) != (74, 27)]
    layers += [("fill", sparkle(74, 27, 6)), ("dash", circle(60, 45, 8))]
    return layers


def road():
    return [
        ("line", "M22 47H98"),
        ("line", "M22 47C32 39 41 39 49 47M71 47C79 37 89 37 98 47"),
        ("line", "M45 70L57 47M75 70L63 47"),
        ("accent", "M60 67V62M60 58V54M60 51V48.5"),
        ("fill", sparkle(60, 28, 6)),
    ]


def houses():
    return [
        ("line", "M38 18H82V62H38Z"),
        ("line", "M60 18L82 40L60 62L38 40Z"),
        ("line", "M38 18L82 62M82 18L38 62"),
        ("afill", circle(60, 29.5, 2.4)),
        ("fill", sparkle(96, 22, 3)),
        ("fill", sparkle(24, 58, 2.5)),
    ]


def search():
    dots = "".join(circle(x, y, 1.4) for y in (40, 48) for x in (41, 48, 55, 62))
    return [
        ("line", rect(33, 24, 36, 32, 3)),
        ("line", "M33 32H69M42 20V27M60 20V27"),
        ("fill", dots),
        ("cover", circle(76, 49, 9)),
        ("accent", "M82.5 55.5L90 63"),
        ("fill", sparkle(92, 22, 3)),
    ]


def change():
    p = [(26, 58), (40, 30), (74, 24), (92, 38)]
    mid = bezier(*p, 0.62)
    return [
        ("dash", "M26 58C40 30 74 24 92 38"),
        ("line", circle(30, 50, 4.5)),
        ("fill", circle(88, 35, 5.5)),
        ("line", f"M{f(mid[0] - 4)} {f(mid[1] - 4.5)}L{f(mid[0] + 1)} {f(mid[1])}L{f(mid[0] - 4.5)} {f(mid[1] + 4)}"),
        ("fill", sparkle(24, 22, 3)),
    ]


def year():
    layers = [("fill", circle(60, 42, 6)), ("line", circle(60, 42, 21))]
    for k in range(12):
        a = math.radians(k * 30 - 90)
        x, y = 60 + 21 * math.cos(a), 42 + 21 * math.sin(a)
        layers.append(("cover", circle(x, y, 2.2)) if k else ("afill", circle(x, y, 3.4)))
    layers.append(("line", rays(60, 42, 9, 12, [45, 135, 225, 315])))
    return layers


def checklist():
    layers = []
    for row, width in zip((24, 38, 52), (30, 24, 28)):
        layers.append(("line", rect(38, row, 9, 9, 2)))
        layers.append(("line", f"M55 {row + 4.5}H{55 + width}"))
    layers.append(("accent", "M40 28.5L42 30.5L45.5 26.5M40 42.5L42 44.5L45.5 40.5M40 56.5L42 58.5L45.5 54.5"))
    layers.append(("fill", sparkle(96, 22, 3)))
    return layers


def moon():
    return [
        ("line", "M66 19A23 23 0 1 0 82 56A19 19 0 0 1 66 19Z"),
        ("fill", sparkle(84, 26, 4.5)),
        ("afill", circle(36, 22, 1.6)),
        ("afill", circle(94, 48, 1.4)),
    ]


SPOTS = {
    "sunrise": sunrise,
    "work": work,
    "love": love,
    "couple": couple,
    "family": family,
    "book": book,
    "travel": travel,
    "lotus": lotus,
    "periods": periods,
    "saturn": saturn,
    "planets": planets,
    "shield": shield,
    "mars": mars,
    "wedding": wedding,
    "lamp": lamp,
    "pot": pot,
    "cradle": cradle,
    "compass": compass,
    "constellation": constellation,
    "road": road,
    "houses": houses,
    "search": search,
    "change": change,
    "year": year,
    "checklist": checklist,
    "moon": moon,
}


def backdrop(index: int) -> list[tuple[str, str]]:
    """A faint orbit and a few small stars behind every drawing, placed differently for each."""
    rng = random.Random(index * 7919 + 17)
    layers = [("back", ellipse(60, 44, 54, 21, -9 + rng.uniform(-4, 4)))]
    placed = 0
    while placed < 4:
        x, y = rng.uniform(8, 112), rng.uniform(8, 72)
        if 24 < x < 96 and 16 < y < 66:
            continue  # keep the middle clear for the drawing
        layers.append(("dot", circle(x, y, rng.choice((0.9, 1.1, 1.3)))))
        placed += 1
    return layers


# ---- Output ----


def svg(layers: list[tuple[str, str]], colours: dict[str, str]) -> str:
    stroke = 'fill="none" stroke-linecap="round" stroke-linejoin="round"'
    paint = {
        "back": f'{stroke} stroke="{colours["back"]}" stroke-width="0.8"',
        "line": f'{stroke} stroke="{colours["line"]}" stroke-width="2.2"',
        "accent": f'{stroke} stroke="{colours["accent"]}" stroke-width="2"',
        "dash": f'{stroke} stroke="{colours["accent"]}" stroke-width="1.6" stroke-dasharray="3 4"',
        "fill": f'fill="{colours["line"]}"',
        "afill": f'fill="{colours["accent"]}"',
        "dot": f'fill="{colours["dot"]}"',
        "cover": f'fill="{colours["bg"]}" stroke="{colours["line"]}" stroke-width="2.2"',
    }
    body = "".join(f'<path {paint[kind]} d="{d}"/>' for kind, d in layers)
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="480" height="320">{body}</svg>\n'


def typescript(drawings: dict[str, list[tuple[str, str]]]) -> str:
    lines = [
        "// Generated by design/tools/gen_spots.py. Do not edit: change the script and run it again.",
        "",
        "/** How a layer is painted (components/Spot.tsx). */",
        'export type SpotLayer = "back" | "line" | "accent" | "dash" | "fill" | "afill" | "dot" | "cover";',
        "",
        "/** The spot illustrations: small gold line pictures on a 120 x 80 canvas. */",
        "export const SPOTS = {",
    ]
    for name, layers in drawings.items():
        lines.append(f"  {name}: [")
        lines += [f'    ["{kind}", "{d}"],' for kind, d in layers]
        lines.append("  ],")
    lines += [
        "} satisfies Record<string, [SpotLayer, string][]>;",
        "",
        "export type SpotName = keyof typeof SPOTS;",
        "",
    ]
    return "\n".join(lines)


def write(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8", newline="\n") as file:  # the repository uses LF
        file.write(text)


if __name__ == "__main__":
    drawings = {name: backdrop(i) + draw() for i, (name, draw) in enumerate(SPOTS.items())}
    for name, layers in drawings.items():
        for suffix, colours in THEMES.items():
            text = svg(layers, colours)
            write(OUT / f"{name}{suffix}.svg", text)
    write(TS, typescript(drawings))
    print(f"wrote {len(drawings)} spot illustrations to {OUT} and {TS}")
