# Extra Features

Features beyond the first release, grouped by category and split into sets. We plan and build one set at a time.

Checked on 2026-11-12 from web search summaries and app store listings only. Treat the competitor details as unconfirmed.

## 1. What other sites offer

- **Sri Lankan sites (Lakpura, Kapruka's astrologers, Kendra, Grahachara):** mostly porondam and nakath. Wedding nakath is usually bought from an astrologer after the match. No online wedding nakath finder was found.
- **Jyothishya app (Sri Lanka):** the closest rival. Charts, four levels of dasha, porondam, an auspicious time finder, "auspicious letters for your name", and details worked out from an old kendara. Users complain about its paywall.
- **Indian sites (AstroSage, KundliGPT, OnlineJyotish):** many free calculators that bring search traffic: baby name letters from the birth star, wedding muhurat, panchang, a Saturn period checker and yearly forecasts.

## 2. Categories

**A. Porondam depth**

- Which stars match mine (27 star pages). **Built.**
- All 20 porondam factors. **Built.** Gothra, Pakshi, Linga and Dina came first, then Varna, Bhutha, Vruksha, Ayusha and Graha.
- Years ahead for the couple: both dasha timelines and Saturn periods, facts only. **Built.**

**B. Planet changes and forecasts**

- Rahu and Ketu change for your lagna (5 December 2026). **Built.**
- Each Saturn and Jupiter change. **Built.**
- Yearly forecast by lagna for 2027. **Built**, open for now, paid later.

**C. Nakath (auspicious times)**

- Nakath engine: thithi, yoga, karana, Rahu kalaya, sunrise. **Built.**
- Avurudu and daily nakath in your own time zone. **Built.**
- Wedding nakath finder: engagement, poruwa, homecoming. **Built**, open for now, paid later.

**D. Baby and child**

- Baby name letters from the birth star.
- First letters ceremony nakath (akuru kiyaweema).

**E. Old horoscopes**

- Rebuild a hadahan from an old paper kendara. **Form and search built**, free for now (`docs/13-old-horoscopes.md`). Using a result on the hadahan and porondam pages comes next. Reading a photo of the paper is a later step.

**Built separately, not part of these sets:** compare several proposals.

**Not planned:** selling remedies, gemstones or pujas.

## 3. Category A in detail

Planned as three pull requests. All three were built in one (#12).

| # | Feature | Delivers | Check |
|---|---|---|---|
| A1 | **Which stars match mine** | `GET /v1/porondam/stars/{star}`, a page for each of the 27 stars in both languages, a list of all stars, a sitemap, and links that open the quick match with both stars filled in. | Open a star, see all 27 ranked. Change who is the bride. Follow a row into the quick match. |
| A2 | **More porondam factors** | Rule file `porondam_si_v2.yaml` with Gothra, Pakshi, Linga and Dina (the birth weekdays), from the results of a Sri Lankan porondam site. A factor that lacks its inputs is shown as not counted. Varna, Bhutha, Vruksha, Ayusha and Graha still need their rules. | A test for each factor, and a replay of 34 of the site's results. A birth star only match leaves Dina out of the total. |
| A3 | **Years ahead for the couple** | `POST /v1/porondam/timeline`: ten years of each person's dasha periods and Saturn periods from the Moon sign, and where they overlap. A section on the match result. | Saturn dates match the almanac. The match still shows if the timeline cannot load. |

Decisions made:

- The added factors come from the published descriptions and the results of a Sri Lankan porondam site.
- The couple timeline shows facts only. It does not judge a dasha period as good or bad.

## 4. Category B in detail

Planned as three pull requests, so the Rahu and Ketu pages are live before 5 December 2026.

| # | Feature | Delivers | Check |
|---|---|---|---|
| B1 | **Rahu and Ketu change** | The change engine and endpoints for every Saturn, Jupiter, Rahu and Ketu change. A list of changes, a page for the Rahu and Ketu change, and a page for each of the 12 lagnas, in both languages. "Your own version" from the birth details, counted from the lagna and the Moon sign (gochara). "Planet changes for you" on the hadahan. **Built.** | The times match the almanac. The houses match a table worked out by hand for all 12 lagnas. The pages carry a title and description as served. Birth details never reach the address. |
| B2 | **Saturn and Jupiter changes** | Pages for the five Saturn and Jupiter changes in 2027, with the backward steps and returns explained, and Saturn's Erashtaka and 8th sign periods counted from the Moon. **Built.** | Each page shows the right return date. Every change has its own title. |
| B3 | **Yearly forecast 2027** | A page for each lagna, and a personal version. **Built.** Paid by decision but open to everyone for now. Its code is kept apart, so the lock goes in `yearly_access()` and `YearlyGate` (see file 07, section 4.6). | The year's changes and houses match the change pages. |

Decisions made:

- One page per change, plus one page per change and lagna. The change page serves broad searches. The lagna pages serve lagna searches.
- The personal version counts from the lagna and also from the Moon sign (gochara).
- Planet change pages are free.
- The yearly forecast is paid, built open for now. The 12 general yearly pages stay public for now.
- Times are Sri Lanka time, as the almanacs print them.

## 5. Category C in detail

Planned as three pull requests. Rules and their sources are in file 11.

| # | Feature | Delivers | Check |
|---|---|---|---|
| C1 | **Nakath engine** | Sunrise and sunset for any place. The weekday from sunrise, thithi, nakatha, yoga and karana with their start and end times, and Rahu kalaya. `GET /v1/panchanga`. **Built.** | Matches porondam.lk for 40 made-up moments and 10 change times, and two Sri Lankan sites for Rahu kalaya. |
| C2 | **Avurudu and daily nakath** (free) | The new year moment and punya kalaya, the official lists, past years next to our times, in the visitor's own time zone. A daily page for any place. **Built.** | The new year moment matches the official lists 2022 to 2027 within a minute. |
| C3 | **Wedding nakath finder** (paid, open for now) | Good dates and times for the engagement, the poruwa and the homecoming after a porondam match, with reasons. **Built.** Paid by decision but open to everyone for now. Its code is kept apart, so the lock goes in `wedding_access()` and `WeddingGate` (see file 07, section 4.7). | Each suggestion passes the rules it lists. |

Decisions made:

- Avurudu and daily nakath are free. The wedding finder is paid, built open for now.
- The rules are checked against several sources and kept in versioned rule files, marked provisional.
- An Avurudu nakath time is published only when it comes from the official list or matches it. Times we calculate are marked as calculated.

## 6. Needed from the astrologer

Best asked for together, early:

- A check of all nine added porondam factors and the methods chosen for Varna and Graha (A2).
- How to read Saturn and dasha periods for a couple (A3).
- What each house means when Saturn, Jupiter, Rahu or Ketu moves through it, for the change pages (B).
- The nakath rules (category C): see the questions at the end of file 11.
- The nakath rules (category C), the Sinhala name letter table (D) and the wedding rules (C).

## Sources

- [Lakpura porondam](https://www.lakpura.com/pages/porondam)
- [Kapruka guide to online astrology services](https://blog.kapruka.com/?p=17221)
- [Jyothishya App (App Store)](https://apps.apple.com/lk/app/jyothishya-app/id1459372211)
- [AstroSage free reports](https://www.astrosage.com/freekundali/)
- [KundliGPT calculators](https://kundligpt.com/calculators/)
- [OnlineJyotish baby names by birth star](https://www.onlinejyotish.com/articles/choosing-your-baby-name-with-vedic-astrology.php)
