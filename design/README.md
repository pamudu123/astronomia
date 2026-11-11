# Design

Visual design work for the Astronomia website (night sky look: deep indigo, soft gold, teal and coral accents).

The screens live on a design canvas: https://claude.ai/artifact/7p29bNJpsgp6ZbZSVxYFWX (private, share it from the page's Share menu).

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
| `rashi-NN-name.webp` (512 x 512, transparent) | Rashi row on the home page, lagna and rashi cards in results | The standalone rashi images in both sets |
| `card-hadahan.jpg` (539 x 340) | Hadahan tool card on the home page | Cropped from the composite image |
| `card-porondam.jpg` (661 x 376) | Porondam tool card on the home page | Cropped from the composite image |
| `moon.png` (322 x 323, transparent) | Side illustration on the birth details form | Cut out of the composite image |
| `share-preview.jpg` (1200 x 630) | Link preview on WhatsApp, Facebook and similar | Zodiac wheel drawn by code over `hero-sky.jpg` |
| `glyphs/rashi-NN-name.svg` | Zodiac wheel, small icons | Drawn by `tools/gen_rashi.py` |

Rashi numbering: 01 Mesha, 02 Vrishabha, 03 Mithuna, 04 Kataka, 05 Simha, 06 Kanya, 07 Tula, 08 Vrischika, 09 Dhanu, 10 Makara, 11 Kumbha, 12 Meena.

## Known gaps

- **Simha (Leo) artwork is missing.** There is no `rashi-05-simha.webp`. The design uses `glyphs/rashi-05-simha.svg` in its place until the artwork is made.
- **The two card pictures and the moon are low resolution.** They exist only as panels inside `02_remaining_set/07_composite_all_remaining_visuals.png`, so they were cropped from it. They are sharp at normal size but soft on high density screens. Standalone versions at 1200 x 800 (cards) and 1000 x 1000 (moon) would replace them.
- **Kumbha has two versions.** The site uses the figure pouring water (`02_kumbha_aquarius_person.png`). The urn version is kept in `source/` as an alternative.
- **Style differs slightly across the rashi set.** The first eight have a gold ring and are all gold. Meena, Kumbha and Makara have no ring and use teal accents.
- The two Kumbha and Meena pair images in `source/` are not used yet.

## Rebuilding

From the repository root:

```
python3 design/tools/build_assets.py   # hero, rashi, card pictures, moon  (needs Pillow and numpy)
python3 design/tools/gen_rashi.py      # line symbols
python3 design/tools/gen_share.py      # share preview (needs Node with Playwright)
```

To add the Simha artwork later: put the PNG in `assets/source/`, add a `"05-simha"` line to `RASHI` in `tools/build_assets.py`, and run the build.
