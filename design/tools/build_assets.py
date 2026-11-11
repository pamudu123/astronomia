"""Build the web-ready images in design/assets/web from the originals in design/assets/source.

Run from the repository root:  python3 design/tools/build_assets.py
Needs Pillow and numpy. The originals are never modified.
"""
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
SRC, WEB = ROOT / "assets" / "source", ROOT / "assets" / "web"
WEB.mkdir(parents=True, exist_ok=True)

# Rashi number and name -> original file. Simha has no original yet (see design/README.md).
RASHI = {
    "01-mesha": "01_first_set/02_mesha_aries.png",
    "02-vrishabha": "01_first_set/03_vrishabha_taurus.png",
    "03-mithuna": "01_first_set/04_mithuna_gemini.png",
    "04-kataka": "01_first_set/05_karka_cancer.png",
    "06-kanya": "01_first_set/06_kanya_virgo.png",
    "07-tula": "01_first_set/07_tula_libra.png",
    "08-vrischika": "01_first_set/08_vrischika_scorpio.png",
    "09-dhanu": "01_first_set/09_dhanu_sagittarius.png",
    "10-makara": "02_remaining_set/04_makara_capricorn.png",
    "11-kumbha": "02_remaining_set/02_kumbha_aquarius_person.png",
    "12-meena": "02_remaining_set/01_meena_pisces.png",
}

# Panels inside the composite image, as (left, top, right, bottom), inside the white divider lines.
COMPOSITE = "02_remaining_set/07_composite_all_remaining_visuals.png"
PANELS = {
    "card-hadahan": (1631, 2, 2170, 342),
    "card-porondam": (2, 346, 663, 722),
    "moon": (667, 346, 1181, 722),
}


def composite():
    """The composite has a transparency layer, so flatten it onto the site's indigo first."""
    im = Image.open(SRC / COMPOSITE).convert("RGBA")
    flat = Image.new("RGB", im.size, (11, 16, 38))
    flat.paste(im, (0, 0), im)
    return flat


def hero():
    Image.open(SRC / "01_first_set/01_hero_night_sky.png").convert("RGB").save(
        WEB / "hero-sky.jpg", quality=90, optimize=True, progressive=True
    )


def rashi():
    for name, src in RASHI.items():
        im = Image.open(SRC / src).convert("RGBA").resize((512, 512), Image.LANCZOS)
        im.save(WEB / f"rashi-{name}.webp", quality=88, method=6)


def cards():
    comp = composite()
    for name in ("card-hadahan", "card-porondam"):
        comp.crop(PANELS[name]).save(WEB / f"{name}.jpg", quality=92, optimize=True)


def moon():
    """Cut the moon disk out of its panel and give it a transparent background."""
    panel = composite().crop(PANELS["moon"])
    lum = np.asarray(panel.convert("L")).astype(np.float32)
    disk = lum > 80                                   # the moon is far brighter than the sky
    ys, xs = np.nonzero(disk)
    cx, cy = (xs.min() + xs.max()) / 2 + 0.5, (ys.min() + ys.max()) / 2 + 0.5
    r = np.sqrt(disk.sum() / np.pi) - 1.0             # stay just inside the edge
    ss = 4                                            # supersample the mask for a smooth edge
    mask = Image.new("L", (panel.width * ss, panel.height * ss), 0)
    ImageDraw.Draw(mask).ellipse(
        [(cx - r) * ss, (cy - r) * ss, (cx + r) * ss, (cy + r) * ss], fill=255
    )
    out = panel.convert("RGBA")
    out.putalpha(mask.resize(panel.size, Image.LANCZOS))
    pad = 4
    box = (int(cx - r - pad), int(cy - r - pad), int(cx + r + pad) + 1, int(cy + r + pad) + 1)
    out.crop(box).save(WEB / "moon.png", optimize=True)
    print(f"moon: centre ({cx:.1f}, {cy:.1f}), radius {r:.1f}px")


if __name__ == "__main__":
    hero(), rashi(), cards(), moon()
    for p in sorted(WEB.iterdir()):
        print(f"{p.name:28s} {p.stat().st_size // 1024:5d} KB")
