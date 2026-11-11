"""Compose the 1200x630 share preview: the zodiac wheel with rashi symbols over the hero sky.

Run from the repository root:  python3 design/tools/gen_share.py
Needs Node with Playwright (Chromium) to render the page to an image.
"""
import math
import subprocess
import tempfile
from pathlib import Path

from gen_rashi import RASHI

WEB = Path(__file__).resolve().parents[1] / "assets" / "web"

ticks = "".join(f'<line x1="240" y1="18" x2="240" y2="70" transform="rotate({k * 30} 240 240)"/>' for k in range(12))
glyphs = ""
for i, (_name, _si, paths, circles) in enumerate(RASHI):
    a = math.radians(15 + 30 * i)
    x, y = 240 + 196 * math.sin(a) - 17, 240 - 196 * math.cos(a) - 17
    body = "".join(f'<path d="{d}"/>' for d in paths)
    body += "".join(f'<circle cx="{cx}" cy="{cy}" r="{r}"/>' for cx, cy, r in circles)
    glyphs += (
        f'<g transform="translate({x:.1f} {y:.1f}) scale(.34)" fill="none" stroke="#E3B866" '
        f'stroke-width="6" stroke-linecap="round" stroke-linejoin="round">{body}</g>'
    )

wheel = f"""<svg viewBox="0 0 480 480" width="520" height="520">
<defs>
<radialGradient id="s" cx="38%" cy="35%"><stop offset="0" stop-color="#FBE7B5"/><stop offset="1" stop-color="#D79B3C"/></radialGradient>
<radialGradient id="t" cx="35%" cy="30%"><stop offset="0" stop-color="#C9F3E9"/><stop offset="1" stop-color="#3E9C8A"/></radialGradient>
<radialGradient id="c" cx="35%" cy="30%"><stop offset="0" stop-color="#FBC9B1"/><stop offset="1" stop-color="#D2603A"/></radialGradient>
</defs>
<circle cx="240" cy="240" r="228" fill="none" stroke="#E3B866" stroke-opacity=".6" stroke-width="1.5" stroke-dasharray="2 12"/>
<circle cx="240" cy="240" r="222" fill="#0E1430" fill-opacity=".9" stroke="#2A3364"/>
<circle cx="240" cy="240" r="170" fill="#0B1026" stroke="#2A3364"/>
<g stroke="#2A3364">{ticks}</g>{glyphs}
<circle cx="240" cy="240" r="120" fill="none" stroke="#2A3364" stroke-dasharray="3 7"/>
<circle cx="240" cy="240" r="70" fill="none" stroke="#2A3364" stroke-dasharray="3 7"/>
<circle cx="240" cy="240" r="44" fill="#E3B866" opacity=".14"/><circle cx="240" cy="240" r="26" fill="url(#s)"/>
<circle cx="325" cy="155" r="10" fill="url(#t)"/><circle cx="190" cy="289" r="6.5" fill="url(#c)"/>
</svg>"""

page = (
    f'<body style="margin:0;width:1200px;height:630px;background:#0B1026 url({(WEB / "hero-sky.jpg").as_uri()}) '
    f'center/cover;display:flex;align-items:center;justify-content:center">{wheel}</body>'
)
shot = """
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await p.goto(process.argv[1]);
  await p.screenshot({ path: process.argv[2], type: 'jpeg', quality: 90 });
  await b.close();
})();
"""
with tempfile.TemporaryDirectory() as tmp:
    html = Path(tmp) / "share.html"
    html.write_text(page)
    subprocess.run(["node", "-e", shot, html.as_uri(), str(WEB / "share-preview.jpg")], check=True)
print("wrote", WEB / "share-preview.jpg")
