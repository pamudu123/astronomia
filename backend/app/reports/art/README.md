# Report artwork

The pictures the PDF report prints, copied from `design/assets/web/` so the backend image holds
everything it needs (it only copies `backend/app`). Rebuild them there, then copy them here.

| Here | From | Used for |
|---|---|---|
| `hero-sky.jpg` | `design/assets/web/hero-sky.jpg` | The night sky on the cover |
| `rashi/rashi-NN-name.webp` | `design/assets/web/rashi-NN-name.webp` | The Moon sign's artwork on the cover and beside each person in a match. Simha has no artwork yet: its line symbol stands in |
| `glyphs/rashi-NN-name.svg` | `design/assets/web/glyphs/` | The twelve signs around the sky wheel, and Simha's stand-in |
| `spots/<name>.svg` | `design/assets/web/spots/<name>-light.svg` | The picture at the top of each AI chapter (the light theme, for paper) |

`app/reports/pdf.py` lets a report load these files and the fonts, and nothing else.
