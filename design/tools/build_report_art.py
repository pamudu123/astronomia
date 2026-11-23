"""Build the report's pictures, and the chapter pictures of the website, from the third set of
originals (design/assets/source/03_report_set).

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
from PIL import Image, ImageDraw, ImageFile, ImageFilter

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "design" / "assets" / "source" / "03_report_set"
WEB = ROOT / "design" / "assets" / "web"
ART = ROOT / "backend" / "app" / "reports" / "art"

PAPER = (251, 248, 241)  # report.css
COVER = (1654, 2339)  # A4 at 200 dots an inch
BANNER = (1500, 525)

# Scraps of a neighbouring picture left when the sheets were cut up: (left, top, right, bottom).
SCRAPS = {
    "chapter-ahead": [(780, 655, 960, 720)],
    "chapter-checks": [(380, 80, 540, 112)],
    "chapter-factors": [(680, 665, 820, 720)],
}
# Grey haze, not gold: (left, top, right, bottom).
HAZE = {"chapter-work": [(480, 40, 800, 260)]}


def jpeg(im: Image.Image, path: Path, quality: int = 84) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    im.convert("RGB").save(path, quality=quality, optimize=True, progressive=True, subsampling=0)


def clean(name: str) -> Image.Image:
    """A see-through picture without scraps, haze and the faint noise around its edges."""
    pixels = np.asarray(Image.open(SRC / f"{name}.png").convert("RGBA")).copy()
    for left, top, right, bottom in SCRAPS.get(name, []):
        pixels[top:bottom, left:right, 3] = 0
    for left, top, right, bottom in HAZE.get(name, []):
        part = pixels[top:bottom, left:right]
        rgb = part[..., :3].astype(int)
        grey = rgb.max(axis=2) - rgb.min(axis=2) < 40
        part[grey & (part[..., 3] < 200), 3] = 0
    alpha = pixels[..., 3]
    alpha[alpha < 22] = 0
    return Image.fromarray(pixels, "RGBA")


def chapters() -> None:
    for path in sorted(SRC.glob("chapter-*.png")):
        name = path.stem.removeprefix("chapter-")
        im = clean(path.stem)
        out = WEB / "chapters" / f"{name}.webp"
        out.parent.mkdir(parents=True, exist_ok=True)
        im.resize((480, 320), Image.LANCZOS).save(out, quality=86, method=6)
        paper = Image.new("RGBA", im.size, (*PAPER, 255))
        paper.alpha_composite(im)
        jpeg(paper.resize((900, 600), Image.LANCZOS), ART / "chapters" / f"{name}.jpg", 90)


def without_lion(im: Image.Image) -> Image.Image:
    """The birth chart cover, without the lion painted into it: the cover shows the person's own
    Moon sign. The lion's disc is filled with the sky above the middle, turned upside down, which
    also completes the faint zodiac wheel behind it."""
    w, h = im.size
    middle = round(h * 420 / 848)
    flipped = Image.new("RGB", im.size)
    flipped.paste(im.crop((0, 0, w, middle)).transpose(Image.FLIP_TOP_BOTTOM), (0, middle))
    mask = Image.new("L", im.size, 0)
    cx, cy, r = w / 2, h * 651 / 848, w * 180 / 600
    ImageDraw.Draw(mask).ellipse((cx - r, cy - r, cx + r, cy + r), fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(w / 90))
    return Image.composite(flipped, im, mask)


def covers() -> None:
    hadahan = without_lion(Image.open(SRC / "cover-hadahan.png").convert("RGB"))
    jpeg(hadahan.resize(COVER, Image.LANCZOS), ART / "cover-hadahan.jpg")
    porondam = Image.open(SRC / "cover-porondam.png").convert("RGB")
    jpeg(porondam.resize(COVER, Image.LANCZOS), ART / "cover-porondam.jpg")
    # The back cover came with dark bars at its sides: cut them off and keep the A4 shape.
    back = Image.open(SRC / "back-cover.png").convert("RGB")
    w, h = back.size
    left, right = round(w * 0.034), round(w * 0.966)
    height = round((right - left) * h / w)
    top = round((h - height) * 0.75)
    jpeg(back.crop((left, top, right, top + height)).resize(COVER, Image.LANCZOS), ART / "back-cover.jpg")


def sections() -> None:
    # section-match.png arrived cut off near its bottom edge: what is there is used.
    ImageFile.LOAD_TRUNCATED_IMAGES = True
    for path in sorted(SRC.glob("section-*.png")):
        pixels = np.asarray(Image.open(path).convert("RGB")).astype(np.float32).copy()
        if path.stem == "section-match":
            last = int(np.nonzero(pixels.sum(axis=(1, 2)))[0].max())
            fade = 46
            pixels[last - fade : last + 1] *= np.linspace(1, 0, fade + 1)[:, None, None]
            pixels[last + 1 :] = 0
        # One black for every banner, so it meets the page's own black without a seam.
        pixels = np.clip(pixels - 8, 0, 255) * 255 / 247
        im = Image.fromarray(pixels.astype(np.uint8))
        jpeg(im.resize(BANNER, Image.LANCZOS), ART / "sections" / f"{path.stem.removeprefix('section-')}.jpg", 86)


def rashi() -> None:
    for path in sorted(WEB.glob("rashi-*.webp")):
        shutil.copyfile(path, ART / "rashi" / path.name)


if __name__ == "__main__":
    chapters(), covers(), sections(), rashi()
    total = sum(p.stat().st_size for p in ART.rglob("*") if p.is_file())
    print(f"report art: {total // 1024} KB")
