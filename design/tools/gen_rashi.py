"""Draw the twelve rashi symbols as simple gold line SVGs.

Run from the repository root:  python3 design/tools/gen_rashi.py
They are used where the detailed artwork is too fine to read (the zodiac wheel, small icons),
and rashi-05-simha.svg stands in until the Simha artwork exists.
"""
import math
from pathlib import Path

OUT = Path(__file__).resolve().parents[1] / "assets" / "web" / "glyphs"
GOLD, LINE, STAR = "#E3B866", "#2A3364", "#F2EEE3"

# name, Sinhala name, list of path strings, list of (cx, cy, r) circles. viewBox is 0 0 100 100.
RASHI = [
    ("mesha", "මේෂ", ["M50 78 V42 C50 26 32 20 26 32 C22 41 30 48 36 43", "M50 42 C50 26 68 20 74 32 C78 41 70 48 64 43"], []),
    ("vrishabha", "වෘෂභ", ["M28 24 C30 40 40 46 50 46 C60 46 70 40 72 24"], [(50, 62, 16)]),
    ("mithuna", "මිථුන", ["M28 25 C40 31 60 31 72 25", "M28 75 C40 69 60 69 72 75", "M41 29 V71", "M59 29 V71"], []),
    ("kataka", "කටක", ["M29 40 C33 26 58 24 74 34", "M71 60 C67 74 42 76 26 66"], [(36, 42, 7), (64, 58, 7)]),
    ("simha", "සිංහ", ["M43 57 C44 44 36 24 52 24 C68 24 62 46 59 56 C56 68 62 78 73 73"], [(35, 58, 8)]),
    ("kanya", "කන්‍යා", ["M24 34 C27 28 32 29 32 36 V70", "M32 37 C32 27 45 27 45 37 V70", "M45 37 C45 27 58 27 58 37 V64 C58 74 66 78 72 73", "M58 48 C70 43 76 56 67 65 C63 69 58 70 54 73"], []),
    ("tula", "තුලා", ["M24 74 H76", "M24 60 H41 C33 53 34 36 50 36 C66 36 67 53 59 60 H76"], []),
    ("vrischika", "වෘශ්චික", ["M22 34 C25 28 30 29 30 36 V68", "M30 37 C30 27 43 27 43 37 V68", "M43 37 C43 27 56 27 56 37 V62 C56 72 68 74 76 64", "M76 64 L67 64", "M76 64 L77 73"], []),
    ("dhanu", "ධනු", ["M28 74 L74 28", "M54 28 H74 V48", "M36 52 L50 66"], []),
    ("makara", "මකර", ["M24 30 L36 60 L45 36 C47 28 57 29 57 39 V58 C57 70 50 78 42 76"], [(65, 62, 8)]),
    ("kumbha", "කුම්භ", ["M22 44 L33 35 L44 44 L55 35 L66 44 L77 35", "M22 65 L33 56 L44 65 L55 56 L66 65 L77 56"], []),
    ("meena", "මීන", ["M31 24 C44 38 44 62 31 76", "M69 24 C56 38 56 62 69 76", "M26 50 H74"], []),
]


def svg(paths, circles, i):
    # Three small stars on the ring, rotated per sign so the set does not look stamped.
    stars = ""
    for k, r in enumerate((1.6, 1.1, 1.3)):
        a = math.radians(i * 30 + k * 115 + 20)
        stars += f'<circle cx="{50 + 47 * math.sin(a):.1f}" cy="{50 - 47 * math.cos(a):.1f}" r="{r}" fill="{STAR}"/>'
    body = "".join(f'<path d="{d}"/>' for d in paths)
    body += "".join(f'<circle cx="{x}" cy="{y}" r="{r}"/>' for x, y, r in circles)
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="512" height="512">'
        f'<circle cx="50" cy="50" r="47" fill="none" stroke="{LINE}" stroke-width="1"/>'
        f"{stars}"
        f'<g fill="none" stroke="{GOLD}" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round">{body}</g>'
        "</svg>"
    )



if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    for i, (name, _si, paths, circles) in enumerate(RASHI):
        (OUT / f"rashi-{i + 1:02d}-{name}.svg").write_text(svg(paths, circles, i))
    print(f"wrote {len(RASHI)} symbols to {OUT}")
