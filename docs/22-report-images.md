# Images to make for the report

Date: 2026-11-23. **All 34 images arrived and are in use the same day** (`design/assets/source/03_report_set/`, made with OpenAI image generation), and 8 of them were made again (`04_remade_set/`).

The images the owner will generate for the paid PDF (and the matching places on the website). Nothing waits for them: until an image arrives, the report keeps the artwork or line drawing it has now. Send them in any order.

## How to send them

- **Names:** exactly as in the tables, so each goes straight to its place.
- **Format:** PNG, the largest size the tool gives. They are resized here.
- **No words, letters, numbers or logos in any image.** Image tools spell Sinhala wrongly, and the report prints every word itself, in both languages.
- **Transparent background** where the table says so. If the tool can't, use plain black `#0a0a0a`.

## The style, to paste before every prompt

The existing artwork (`design/assets/web/rashi-08-vrischika.webp`, the scorpion) is the reference. If your tool takes a reference image, attach it.

> Elegant fine-line gold engraving, thin luminous gold lines (#E8B84B) with small four-pointed star accents, constellation dots at the joints, subtle warm brown shading, refined Sri Lankan temple-art influence, calm and dignified, high detail, symmetrical composition, generous empty space around the subject, print quality. No text, no letters, no numbers, no watermark, no purple, no neon, no nebula glow, no crystal balls, no blue tones.

## 1. Needed first

| File | Size | Background | Where it goes | Prompt (after the style) |
|---|---|---|---|---|
| `rashi-05-simha.png` | 1024 x 1024 | Transparent | Cover, medallions, rashi cards. The only sign with no artwork: a Leo Moon gets a plain symbol on the cover today | A majestic lion standing in profile, flowing mane drawn as fine gold lines, stars at the joints, inside a thin gold circle broken at the sides, a four-pointed star at the top and bottom of the circle. Match the scorpion reference exactly |
| `cover-hadahan.png` | 2480 x 3508 (A4 portrait) | Full picture | Cover of the birth chart report. Today: a landscape sky, cropped | A vertical night sky, deep black, fine scattered gold stars, a faint Milky Way in warm gold rising from the lower right to the upper left, a very faint engraved zodiac wheel behind the centre. **The middle and the upper third must stay dark and empty**: the title and the sign's circle go there |
| `cover-porondam.png` | 2480 x 3508 (A4 portrait) | Full picture | Cover of the match report | A vertical night sky, deep black, fine gold stars, two faint engraved orbits crossing at the centre, two soft streams of gold stars meeting in the middle, small lotus buds along the bottom edge. **The middle and the upper third must stay dark and empty** |

## 2. Section pictures

Wide pictures at the top of the report's main parts. 2000 x 700, black background, subject to the right, **left half dark and empty** (the section title goes there).

| File | Where it goes | Prompt (after the style) |
|---|---|---|
| `section-sky.png` | Your sky at birth | An antique armillary sphere with engraved rings and small planets |
| `section-houses.png` | The 12 houses | A traditional Sri Lankan house doorway with a carved frame, an oil lamp lit beside it, twelve faint stars above |
| `section-periods.png` | Your life periods | A winding path of gold stones under a night sky, the moon's phases along it from crescent to full |
| `section-kuja.png` | Kuja dosha | The planet Mars as a finely engraved sphere with a thin orbit and a small guardian spear motif, calm, not threatening |
| `section-match.png` | The two of you | Two oil lamps side by side, their flames leaning towards each other, stars above |
| `section-checks.png` | The serious checks | Two temple guard stones (moonstone pattern, sandakada pahana) facing each other, a thin gold thread between them |
| `section-reading.png` | Opening page of the reading | An open ola-leaf manuscript with blank leaves, a stylus resting on it, stars rising from the pages |
| `back-cover.png` (2480 x 3508) | Last page (new) | A quiet night horizon over still water, a single bright gold star and its reflection, a thin engraved lotus at the bottom |

## 3. Chapter pictures

One per chapter, at the top right. 1200 x 800, transparent. They replace the small line drawings there now. Each stands alone with a lot of empty space around it.

| File | Chapters | Prompt (after the style) |
|---|---|---|
| `chapter-summary.png` | Birth summary, Summing up | A compass rose with eight engraved points |
| `chapter-nature.png` | Your nature | A sunrise over hills, rays drawn as fine lines |
| `chapter-planets.png` | The nine planets, Your two 7th-house rulers | Nine small engraved planets on thin orbits |
| `chapter-combinations.png` | Special combinations, Marriage combinations | Constellation lines joining stars into a lotus shape |
| `chapter-mars.png` | The Mars check | The engraved planet Mars on a thin orbit |
| `chapter-houses.png` | The 12 parts of life | A square Sri Lankan chart drawn as a garden of twelve plots, with no writing |
| `chapter-work.png` | Work and money | A palmyra basket of grain with a few gold coins and a rising stair |
| `chapter-love.png` | Love and marriage | A pair of intertwined betel leaves and a jasmine garland |
| `chapter-family.png` | Family and home | A small village house under a wide tree, a lamp in the window |
| `chapter-studies.png` | Studies | A stack of ola-leaf books and a brass inkwell |
| `chapter-abroad.png` | Travel and going abroad | A sailing ship under stars, a thin dotted route to the horizon |
| `chapter-periods.png` | Your life periods, Your years ahead | The phases of the moon in an arc |
| `chapter-saturn.png` | Saturn periods | The ringed planet Saturn, finely engraved |
| `chapter-care.png` | Areas to take care of | A lotus opening on still water |
| `chapter-ahead.png` | The planet changes ahead | A road curving to a horizon with planets rising over it |
| `chapter-people.png` | The two of you | Two stars joined by a thin gold arc |
| `chapter-factors.png` | All the factors | Twenty small stars set in a ring, some bright, some faint |
| `chapter-checks.png` | The serious checks | An engraved shield with a lotus at its centre |
| `chapter-styles.png` | Emotional styles | Two crescent moons facing each other |
| `chapter-wedding.png` | Wedding dates | A poruwa (Sri Lankan wedding platform) with flower garlands and two lamps |

## 4. Better versions of what we have

| File | Size | Why |
|---|---|---|
| `rashi-10-makara.png`, `rashi-11-kumbha.png`, `rashi-12-meena.png` | 1024 x 1024, transparent | These three have no gold ring and use teal, so they don't match the other eight. Same composition as the scorpion reference: the sea-goat, a figure pouring water from an urn, two fish circling |

## What to check before sending

- The gold is a warm gold, not yellow or orange.
- No writing has crept in (look in books, wheels and borders).
- Planets and people look dignified, and nothing looks frightening: people read this about their own lives.
- Images of the Buddha, deities or religious relics are not used.
- The tool's terms allow commercial use. Keep a note of which tool made which image, for the credits page.

## When they arrive

The originals go to `design/assets/source/`, web sizes are built by `design/tools/build_assets.py`, and the report's copies go to `backend/app/reports/art/` (its README says which). Simha needs no code change: its picture is used as soon as `rashi-05-simha.webp` is there. The covers, section pictures and chapter pictures each need a small change to the templates.
