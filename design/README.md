# Design

Visual design work for the Astronomia website (night sky look in black and bright gold, with an ivory light theme; teal and coral accents).

The screens live on a design canvas: https://claude.ai/artifact/7p29bNJpsgp6ZbZSVxYFWX (private, share it from the page's Share menu).

## Brand

The site is branded **Sidera**, with the tagline *The sky calculated* (domain idea: SideraSky.com). The repository and code keep the name Astronomia.

| Item | Rule |
|---|---|
| Logo | Two crossing orbits around a four pointed star, with a planet on the solid orbit. `Logo` in `frontend/components/Icons.tsx` |
| Small icon | Below about 48 px, use the bold single orbit (same tilt and planet position). `frontend/app/icon.svg` is the favicon |
| Tagline | Two lines, no punctuation: "The sky" in the display serif over "calculated" in mono brass. On one line, separate the parts with a gap or thin rule |
| Colours | Two themes; the site follows the device setting unless the visitor picks one in the header. Dark: black `#0a0a0a`, ivory `#f4f1ea` text, bright gold `#e8b84b`. Light: ivory `#f4f1ea`, near-black `#0a0a0a` text, bronze `#8a6212` for gold text and links (bright gold is too pale on ivory). Filled buttons and chips are bright gold with dark text in both (`--gold-fill`, `--on-gold`). Teal and coral stay for results. The tokens live in `frontend/app/globals.css` |
| Fonts | Marcellus for display, DM Sans for body, JetBrains Mono (`.mono`) for calculated values such as degrees and times |
| Avoid | Purple nebula gradients, glows, crystal balls and other mystic clichés. Blue: it reads as a generic tech site |

The logo story, for an About page: the two rings are great circles of the sky. Where they cross lie the points astronomers have measured for thousands of years, from the equinoxes to the lunar nodes, Rahu and Ketu.

## Folders

| Folder | Contents |
|---|---|
| `assets/source/` | The original generated images, exactly as delivered. Never edit these. |
| `assets/web/` | Web-ready versions the site uses. Built from the originals by the scripts below. |
| `assets/web/glyphs/` | Simple line symbols for the twelve rashi, drawn by code. Used where the artwork is too detailed to read. |
| `tools/` | The scripts that build `assets/web/`. |

## Web assets and where they are used

| File | Used for | Made from |
|---|---|---|
| `hero-sky.jpg` (1672 x 941) | Home hero background, mobile home, share preview | `01_first_set/01_hero_night_sky.png` |
| `rashi-NN-name.webp` (512 x 512, transparent) | Rashi row on the home page, lagna and rashi cards in results, the PDF report | The standalone rashi images in the three sets |
| `chapters/<name>.webp` (480 x 320, transparent) | The picture beside each AI reading chapter | `03_report_set/chapter-*.png`, by `tools/build_report_art.py` |
| `card-hadahan.jpg` (539 x 340) | Hadahan tool card on the home page | Cropped from the composite image |
| `card-porondam.jpg` (661 x 376) | Porondam tool card on the home page | Cropped from the composite image |
| `moon.png` (322 x 323, transparent) | Side illustration on the birth details form | Cut out of the composite image |
| `share-preview.jpg` (1200 x 630) | Link preview on WhatsApp, Facebook and similar | Zodiac wheel drawn by code over `hero-sky.jpg` |
| `glyphs/rashi-NN-name.svg` | Zodiac wheel, small icons | Drawn by `tools/gen_rashi.py` |
| `spots/<name>.svg`, `spots/<name>-light.svg` (480 x 320) | Spot illustrations: the picture beside each AI chapter's "In short" answer; free for social posts, slides and the PDF. One per topic (work, love, family, studies, travel, care, periods, saturn, wedding, lamp, Avurudu pot and more) | Drawn by `tools/gen_spots.py`, which also writes `frontend/lib/spots.ts` so the page draws them in theme colours (`components/Spot.tsx`) |

Rashi numbering: 01 Mesha, 02 Vrishabha, 03 Mithuna, 04 Kataka, 05 Simha, 06 Kanya, 07 Tula, 08 Vrischika, 09 Dhanu, 10 Makara, 11 Kumbha, 12 Meena.

The PDF report's own pictures are in `backend/app/reports/art/`, made by `tools/build_report_art.py`.

## Known gaps

- **`03_report_set/section-match.png` arrived cut off** near its bottom edge. What is there is used, faded out. A whole copy would replace it.
- **`03_report_set/cover-hadahan.png` has a lion painted into it.** `build_report_art.py` takes it out, because the cover shows each person's own Moon sign.
- **Soft originals.** Some chapter and rashi pictures of the third set were enlarged from a grouped sheet (its README). They are sharp at the sizes used.
- **The two card pictures and the moon are low resolution.** They exist only as panels inside `02_remaining_set/07_composite_all_remaining_visuals.png`, so they were cropped from it. They are sharp at normal size but soft on high density screens. Standalone versions at 1200 x 800 (cards) and 1000 x 1000 (moon) would replace them.
- **Kumbha, Makara and Meena** now come from the third set, to match the others. Their earlier versions stay in `source/`.
- The two Kumbha and Meena pair images in `source/` are not used yet.

## Rebuilding

From the repository root:

```
python3 design/tools/build_assets.py   # hero, rashi, card pictures, moon  (needs Pillow and numpy)
python3 design/tools/build_report_art.py  # the report's pictures and the chapter pictures (after build_assets.py)
python3 design/tools/gen_rashi.py      # line symbols
python3 design/tools/gen_spots.py      # spot illustrations (SVG files and frontend/lib/spots.ts)
python3 design/tools/gen_share.py      # share preview (needs Node with Playwright)
```

