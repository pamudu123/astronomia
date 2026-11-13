# Old Horoscopes

Set E: from an old paper kendara back to the possible births, from 1900 to today.

## The drawing

A Sri Lankan kendara puts the lagna in the top centre box. The houses run anticlockwise from there: 2 and 3 in the top left corner, 4 on the left, and so on. The lagna's sign is written in the middle. The owner confirmed this against a real paper horoscope (2026-11-13), and the site's drawing (`frontend/components/hadahan/Kendara.tsx`) follows it.

So a drawing is the lagna sign plus the house of each planet. The house turns into a sign by counting from the lagna sign. The navamsha kendara is entered the same way, with its own lagna sign.

## How the search works

1. **Check the drawing.**
   - Rahu and Ketu must be in opposite boxes, in the rashi and the navamsha.
   - Mercury is never more than one sign from the Sun, and Venus never more than two.
   - A drawing that breaks one of these gets a plain message instead of a search.
2. **Days, from a table.**
   - `backend/app/kendara/table.py` holds where all nine bodies are at 00:00 UTC each day, from 1900 to 2035, in hundredths of a degree (Lahiri, mean node).
   - It is built once, like the place index: in the Docker image, and on first use if missing (about 10 seconds, 750 KB).
   - A day is kept when every planet's path that day passes through its sign, widened by the edge margin.
3. **Minutes, from the ephemeris.**
   - Each run of kept days is stepped through every 5 minutes at the birth place, checking every planet, the lagna and, when given, the navamsha boxes.
   - Window edges are then found to the minute.
4. **Grade each window.**
   - "Exact": everything is inside its box.
   - "Near": something only fits within the edge margin. The result names it.
5. **Narrow.** A year range, a known date (that local day only) or the birth star cut the results down.

A full search from 1900 to today takes well under a second for a complete drawing. Each drawing usually fits only a few times in all those years. The Moon stays about 2.5 days in a sign, so a drawing often fits once a day for two or three days in a row.

The navamsha narrows each window from about 2 hours to about 13 minutes. Usually only one window is left.

## The edge margins (`backend/app/data/rules/kendara_v1.yaml`, provisional)

- **Signs:** 2 degrees, for the planets and the lagna.
- **Navamsha boxes:** 1 degree, since each one is only 3 degrees 20 minutes wide.

Why: older horoscopes may not use our method.

- **Our method:** Lahiri ayanamsa and the mean node. Sri Lankan horoscope sites mostly use Lahiri (sinhalahoroscope.com, induwara.lk).
- **Other ayanamsas:** one Sri Lankan app (MyStar) says Thirukanitam is the official Sri Lankan ayanamsa, and says Lahiri can move a planet by nearly a degree. The Raman ayanamsa differs from Lahiri by about 1.4 degrees. KP differs by about 0.1 degrees.
- **Older almanacs:** those based on the Surya Siddhanta use their own model, so their planets can be off by a degree or two.
- **The node:** the true node and the mean node differ by up to about 1.7 degrees.

A 2 degree margin covers all of these. A planet that fits only inside it is shown as "near", so people know to check that box.

Sources:
- [induwara.lk nakshatra tool](https://induwara.lk/tools/sri-lanka-nakshatra-name-letter-finder)
- [sinhalahoroscope.com](https://sinhalahoroscope.com/)
- [MyStar on lankawebsites.com](https://lankawebsites.com/blog/careers/mystar-is-live-sri-lankas-own-vedic-astrology-platform-is-finally-here)
- [Ayanamsa explained](https://vedika.io/blog/ayanamsa-explained-lahiri-raman-kp)

## Using a result

Each window in the results has three buttons:

- **Open as a hadahan:** opens the hadahan form with the date, time and place filled in.
- **Use as the bride** and **Use as the groom:** open the porondam form in full birth details mode, with that person filled in. The other person stays empty.

How it works:

- **The time:** the middle of the window, in the place's own UTC offset (`middleOf()` in `frontend/lib/kendara.ts`). A window longer than half an hour says so, and points to the hadahan's birth time check, which shows what may change inside the window.
- **The place:** the place given on the kendara form, or Colombo when none was given, the same default as the search.
- **Nothing is sent yet:** the form opens filled in, with a line saying where the values came from. The person checks them and presses the button.
- **Handing over:** the details go through session storage, never the URL. The form reads them once and removes them, so a reload shows an empty form. A saved earlier result does not override them.

When every window has the same single birth star and pada, a box above the list says so. It links to the birth star porondam match (`/{lang}/porondam?bride=star.pada` or `?groom=star.pada`). A star and pada alone are not birth details; the star pages use the same links.

## Privacy

- **Birth data:** a kendara is birth data. It travels in the body of a POST (`/v1/kendara/search`), never in the URL.
- **Handing a result to a form:** through session storage, used once, never the URL.
- **Nothing kept:** the drawing is not stored or logged.

## Free for now

- **Decision:** set E is free for now, and kept apart so a paid check can be added in one place.
- **Backend lock:** `kendara_access()` in `backend/app/api/kendara.py`.
- **Frontend:** the page is `frontend/components/kendara/`.

## Limits

- **Search range:** births from 1900 to today only.
- **Edges of windows:** a birth very near the edge of a window may fall just outside it, if the paper was drawn with another method.
- **Missing planets:** a planet left out of the drawing is not checked. With few planets there can be many matches. The search stops at 50 and asks for a year range or the birth star.

## Later

- **Read a photo:** read the kendara from a photo of the paper horoscope, so nobody has to copy it box by box.
