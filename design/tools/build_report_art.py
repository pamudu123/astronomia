"""Build the report's pictures, and the chapter pictures of the website, from the third
and fourth sets of originals (design/assets/source/). A picture made again is in the fourth.

Run from the repository root, after build_assets.py:  python3 design/tools/build_report_art.py
Needs Pillow and numpy. The originals are never modified: what needed repair is repaired here.

- backend/app/reports/art/: covers, section banners, the back cover and the chapter pictures.
  JPEG, because the PDF keeps a JPEG as it is and stores anything else many times bigger. The
  chapter pictures are laid on the report's paper colour for the same reason.
- design/assets/web/chapters/: the chapter pictures for the website, see-through.
- backend/app/reports/art/rashi/: copies of the rashi pictures build_assets.py made.
"""

import shutil
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "design" / "assets" / "source"
SETS = (SOURCE / "04_remade_set", SOURCE / "03_report_set")  # the newer one first
WEB = ROOT / "design" / "assets" / "web"
ART = ROOT / "backend" / "app" / "reports" / "art"

PAPER = (251, 248, 241)  # report.css
COVER = (1654, 2339)  # A4 at 200 dots an inch, the most a page is kept at
BANNER = (1500, 525)

# Scraps of a neighbouring picture left when the sheets were cut up: (left, top, right, bottom).
SCRAPS = {
    "chapter-checks": [(380, 80, 540, 112)],
    "chapter-factors": [(680, 665, 820, 720)],
}
# Grey haze, not gold: (left, top, right, bottom).
HAZE = {"chapter-work": [(480, 40, 800, 260)]}


# Small in the middle of a large empty picture: cut to what is drawn, with this much room around.
TIGHT = {"chapter-people": 0.06}


def original(name: str) -> Path:
    return next(folder / f"{name}.png" for folder in SETS if (folder / f"{name}.png").exists())


def names(prefix: str) -> list[str]:
    return sorted({path.stem for folder in SETS for path in folder.glob(f"{prefix}-*.png")})


def jpeg(im: Image.Image, path: Path, quality: int = 84) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    im.convert("RGB").save(path, quality=quality, optimize=True, progressive=True, subsampling=0)


def clean(name: str) -> Image.Image:
    """A see-through picture without scraps, haze and the faint noise around its edges."""
    pixels = np.asarray(Image.open(original(name)).convert("RGBA")).copy()
    for left, top, right, bottom in SCRAPS.get(name, []):
        pixels[top:bottom, left:right, 3] = 0
    for left, top, right, bottom in HAZE.get(name, []):
        part = pixels[top:bottom, left:right]
        rgb = part[..., :3].astype(int)
        grey = rgb.max(axis=2) - rgb.min(axis=2) < 40
        part[grey & (part[..., 3] < 200), 3] = 0
    alpha = pixels[..., 3]
    alpha[alpha < 22] = 0
    im = Image.fromarray(pixels, "RGBA")
    if name in TIGHT:
        left, top, right, bottom = im.getchannel("A").getbbox()
        room = TIGHT[name] * (right - left)
        width = right - left + 2 * room
        height = max(bottom - top + 2 * room, width * 2 / 3)
        cx, cy = (left + right) / 2, (top + bottom) / 2
        box = (cx - width / 2, cy - height / 2, cx + width / 2, cy + height / 2)
        im = im.crop(tuple(round(v) for v in box))
    return im


def chapters() -> None:
    for stem in names("chapter"):
        name = stem.removeprefix("chapter-")
        im = clean(stem)
        out = WEB / "chapters" / f"{name}.webp"
        out.parent.mkdir(parents=True, exist_ok=True)
        im.resize((480, 320), Image.LANCZOS).save(out, quality=86, method=6)
        paper = Image.new("RGBA", im.size, (*PAPER, 255))
        paper.alpha_composite(im)
        jpeg(paper.resize((900, 600), Image.LANCZOS), ART / "chapters" / f"{name}.jpg", 90)


def covers() -> None:
    for name in ("cover-hadahan", "cover-porondam", "back-cover"):
        im = Image.open(original(name)).convert("RGB")
        # Never made larger than it is: that adds size and no detail.
        jpeg(im.resize(COVER, Image.LANCZOS) if im.width > COVER[0] else im, ART / f"{name}.jpg", 88)


def sections() -> None:
    for stem in names("section"):
        pixels = np.asarray(Image.open(original(stem)).convert("RGB")).astype(np.float32)
        # One black for every banner, so it meets the page's own black without a seam.
        pixels = np.clip(pixels - 8, 0, 255) * 255 / 247
        im = Image.fromarray(pixels.astype(np.uint8))
        jpeg(im.resize(BANNER, Image.LANCZOS), ART / "sections" / f"{stem.removeprefix('section-')}.jpg", 86)


def rashi() -> None:
    for path in sorted(WEB.glob("rashi-*.webp")):
        shutil.copyfile(path, ART / "rashi" / path.name)


if __name__ == "__main__":
    chapters(), covers(), sections(), rashi()
    total = sum(p.stat().st_size for p in ART.rglob("*") if p.is_file())
    print(f"report art: {total // 1024} KB")
