# Report artwork

The pictures the PDF report prints, kept here so the backend image holds everything it needs (it
only copies `backend/app`). Don't edit them: rebuild with `design/tools/build_report_art.py`, after
`build_assets.py`, from the originals in `design/assets/source/`.

| Here | Used for |
|---|---|
| `cover-hadahan.jpg`, `cover-porondam.jpg`, `back-cover.jpg` | The first and last pages of the paid report |
| `sections/<name>.jpg` | The banner over each main part, and the reading's opening page |
| `chapters/<name>.jpg` | The picture at the top of each AI chapter, laid on the paper colour (`report.css`) |
| `rashi/rashi-NN-name.webp` | The Moon sign's artwork on the cover and beside each person in a match |
| `glyphs/rashi-NN-name.svg` | The twelve signs around the sky wheel and in the houses (`design/assets/web/glyphs/`) |

`app/reports/pdf.py` lets a report load these files and the fonts, and nothing else.
