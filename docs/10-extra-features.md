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
- All 20 porondam factors (11 are checked today).
- Years ahead for the couple: both dasha timelines and Saturn periods, facts only.

**B. Planet changes and forecasts**

- Rahu and Ketu change for your lagna (5 December 2026), then each Saturn and Jupiter change.
- Yearly forecast by lagna.

**C. Nakath (auspicious times)**

- Nakath engine: thithi, yoga, karana, Rahu kalaya, sunrise.
- Avurudu and daily nakath in your own time zone.
- Wedding nakath finder: engagement, poruwa, homecoming.

**D. Baby and child**

- Baby name letters from the birth star.
- First letters ceremony nakath (akuru kiyaweema).

**E. Old horoscopes**

- Rebuild a hadahan from an old paper kendara.

**Built separately, not part of these sets:** compare several proposals.

**Not planned:** selling remedies, gemstones or pujas.

## 3. Category A in detail

Three pull requests, in this order.

| # | Feature | Delivers | Check |
|---|---|---|---|
| A1 | **Which stars match mine** | `GET /v1/porondam/stars/{star}`, a page for each of the 27 stars in both languages, a list of all stars, a sitemap, and links that open the quick match with both stars filled in. | Open a star, see all 27 ranked. Change who is the bride. Follow a row into the quick match. |
| A2 | **All 20 factors** | Rule file `porondam_si_v2.yaml` with nine more factors (Vruksha, Ayusha, Pakshi, Bhutha, Gothra, Varna, Linga, Graha, weekday Dina), provisional. A factor that lacks its inputs is shown as not checked. | A test for each factor, pass and fail. A birth star only match leaves the weekday factor out of the total. |
| A3 | **Years ahead for the couple** | `POST /v1/porondam/timeline`: ten years of each person's dasha periods and Saturn periods from the Moon sign, and where they overlap. A section on the match result. | Saturn dates match the almanac. The match still shows if the timeline cannot load. |

Decisions made:

- The nine added factors come from public sources and stay provisional until the astrologer confirms them.
- The couple timeline shows facts only. It does not judge a dasha period as good or bad.

## 4. Needed from the astrologer

Best asked for together, early:

- The nine added porondam factors and their tables (A2).
- How to read Saturn and dasha periods for a couple (A3).
- The nakath rules (category C), the Sinhala name letter table (D) and the wedding rules (C).

## Sources

- [Lakpura porondam](https://www.lakpura.com/pages/porondam)
- [Kapruka guide to online astrology services](https://blog.kapruka.com/?p=17221)
- [Jyothishya App (App Store)](https://apps.apple.com/lk/app/jyothishya-app/id1459372211)
- [AstroSage free reports](https://www.astrosage.com/freekundali/)
- [KundliGPT calculators](https://kundligpt.com/calculators/)
- [OnlineJyotish baby names by birth star](https://www.onlinejyotish.com/articles/choosing-your-baby-name-with-vedic-astrology.php)
