# Nakath Rules

The rules behind set C (nakath, see file 10): the panchanga, Avurudu nakath and the wedding nakath finder. For each rule: which sources say it, where they disagree, and what the site uses.

Everything here is provisional until a practising astrologer confirms it. The rules live in versioned files in `backend/app/data/rules/`, so they can be corrected without code changes.

Research done on 2026-11-13. Sources were read online. Where a site works nakath out itself, it was asked about made-up dates and places only, never a real person.

## 1. Sources

| # | Source | What it is | Used for |
|---|---|---|---|
| S1 | porondam.lk panchanga service (`/astrolib/common.php`) | Sri Lankan astrology site that works out the panchanga for any date, time and place | Thithi, nakatha, yoga, karana, weekday, sunrise. Queried for 40 made-up moments and 10 change times |
| S2 | porondam.lk Rahu kalaya page | Same site, Rahu kalaya for today | Rahu kalaya |
| S3 | lankahandahana.com, Rahu kalaya today | Sri Lankan site, Colombo, "part 4 of 8" | Rahu kalaya, sunrise |
| S4 | drikpanchang.com, Colombo day panchanga | Widely used Indian panchanga (Lahiri) | Change times, Rahu kalaya |
| S5 | Official Avurudu nakath lists 2022 to 2026 (Ada Derana reports of the lists from the Department of Cultural Affairs) | The official list each year | Avurudu dawn, punya kalaya, the list |
| S6 | Official Avurudu nakath list 2027, Department of Cultural Affairs, released by the Department of Government Information on 2026-08-25 (PDF via Ada Derana) | The official 2027 list | Avurudu 2027 |
| S7 | porondam.lk new year page | The full 2026 list in Sinhala | Avurudu 2026, item wording |
| S8 | Daily Mirror (Sri Lanka), "Significance of Nakshatra in Marriage Muhurta", 27 February 2021 | Sri Lankan jyotisha column | Wedding nakshatras, padas, exceptions |
| S9 | Muhurta Chintamani and B. V. Raman's Muhurtha, as quoted by several sites (dekhopanchang.com, astromedha.in, drikpanchang.com) | Classical muhurtha texts | Wedding thithis, weekdays, Venus and Jupiter combustion, Vishti karana, the 7th house |
| S10 | poruwa.lk blog | Sri Lankan wedding site | Which ceremonies get nakath |
| S11 | Swiss Ephemeris (Lahiri, mean node) | Our engine | The sky |
| S12 | ozlanka.com, "New Year Auspicious Times Australia 2025", prepared by a community astrologer in Sydney | Avurudu times for Australian cities | How the times are used abroad |

Not reachable: meteo.gov.lk (the Department of Meteorology sunrise tables) resets every connection, so the official sunrise table could not be read. Sunrise is checked against S1, S3 and S4 instead.

## 2. The panchanga

| Rule | Sources | Agreement | Used |
|---|---|---|---|
| The day starts at sunrise. A moment before sunrise belongs to the day before | S1 (its "astrological day" changes at sunrise; 40 of 40 agree with ours), the brief | Agreed | Yes |
| Sunrise: upper edge of the Sun on the horizon, standard refraction | S1 (39 of 40 to the minute), S3, S4 | Agreed | Yes. The other option, the centre of the disc without refraction, comes about 4 minutes later in Colombo |
| Sunrise and sunset are printed with the seconds dropped | S1 (39 of 40), S3 | Agreed | Yes. Rounding instead matched only 18 of 40 |
| Thithi: each 12 degrees of the Moon ahead of the Sun, 30 a month, bright half then dark half | S1 (40 of 40), S4 | Agreed | Yes |
| Nakatha: the Moon's sidereal longitude in 27 parts | S1 (40 of 40), S4 | Agreed | Yes |
| Yoga: the sum of the Sun and Moon (sidereal) in 27 parts | S1 (40 of 40), S4 | Agreed | Yes |
| Karana: half a thithi. Kimstughna first, then bava, balava, kaulava, taitila, gara, vanija, vishti eight times, then shakuni, chatushpada, naga | S1 (40 of 40), S4 | Agreed | Yes |
| A change is printed at the first whole minute the new part holds | S1 (9 of 10 change times exact, the tenth 1 minute later) | One source | Yes |
| Change times | S1 matches us within 1 minute (10 of 10). S4 runs 1 to 2 minutes earlier on thithi and about 1 minute earlier on nakatha | Close | S1's convention |
| Rahu kalaya: daylight in 8 parts. Part by weekday: Sunday 8, Monday 2, Tuesday 7, Wednesday 5, Thursday 6, Friday 4, Saturday 3 | S2, S3 ("part 4 of 8" on a Friday), S4, Indian tables | Agreed | Yes |
| Rahu kalaya in whole minutes: each part is the daylight minutes divided by 8 and cut down, counted from the sunrise minute | S2 and S3 match this exactly on 2026-11-13 (10:24 to 11:52, and 10:23 to 11:51 from a sunrise one minute earlier) | Two Sri Lankan sources | Yes. S4 splits to the second, which comes 1 to 2 minutes later |
| Night Rahu kalaya | S2 and S3 show one, but their night spans do not follow one rule we could find (S3 uses a night of 17:43 to 05:27 for a 17:50 sunset) | Unclear | Not shown |
| Horawa (planetary hours) | Not needed by the Avurudu or wedding rules found | Not needed | Not built |

The engine lives in `backend/app/engine/panchanga.py`, the rules in `panchanga_v1.yaml`. The observed answers from S1 are kept in `backend/tests/golden/panchanga_observed.json` and replayed by the tests.

## 3. Avurudu (Sinhala and Tamil New Year)

| Rule | Sources | Agreement | Used |
|---|---|---|---|
| The new year dawns when the Sun enters Mesha (sidereal) | S5, S6, S7, Ada Derana's own explanation | Agreed | Yes |
| The dawn time | Official lists: 2022 08:41, 2023 14:59, 2024 21:05, 2025 03:21, 2026 09:32, 2027 15:29. Our engine: 08:41, 14:59, 21:04, 03:22, 09:33, 15:29 | Within 1 minute every year | Calculated, shown next to the official time |
| Punya kalaya: 6 hours 24 minutes either side of the dawn | Every official list 2022 to 2027 fits exactly (for example 2027: 09:05 to 21:53 around 15:29). The State Astrologers' Committee said so in 2024 ("within six hours and twenty-four minutes") | Agreed | Calculated |
| The other items (moon viewing, bathing for the old year, cooking, starting work and eating, anointing oil, leaving for work, planting) | Chosen by the national nakath committee each year, with colours and directions | No formula | Official values only, never calculated |
| The official times are standard Sri Lanka clock time and hold everywhere in Sri Lanka | S6 says so in its last line | One source, official | Times abroad are the same moments in local time |

| Times abroad | S12 gives the dawn and punya kalaya as the same moments on Australian clocks (03:21 in Sri Lanka is 07:51 in Sydney). But it gives its own cooking, work and oil times for each city, and other colours. Those times keep neither the Sri Lankan clock time nor the same lagna, and Perth does not follow the other cities, so we could not find their rule | Conflict | The official moments on the visitor's clock, with a note that some astrologers abroad prepare their own local times, which can differ |

The official lists are data in `backend/app/data/rules/avurudu_v1.yaml`, with the source of each year. Past years are shown with our calculated dawn and punya kalaya beside the official ones, and the difference in minutes.

## 4. Wedding nakath (used in the finder, rules in `wedding_si_v1.yaml`)

| Rule | Sources | Agreement | Used |
|---|---|---|---|
| 11 nakshatras for marriage: Rohini, Mrigashira, Magha, Uttara Phalguni, Hasta, Swati, Anuradha, Mula, Uttara Ashadha, Uttara Bhadrapada, Revati | S8 (Sri Lankan), S9 | Agreed. One quote of Muhurta Chintamani gives 13 | The 11 |
| Avoid Magha pada 1, Mula pada 1, Revati pada 4 | S8 | One source. Another site avoids Mula padas 1 to 3 | S8 |
| Avoid the rikta thithis (4, 9, 14 of each half) and the new moon | S9 (several quotes) | Agreed | Yes |
| The full moon and the 6th, 8th and 12th thithis | Some quotes avoid them, Muhurta Chintamani as quoted allows 6, 12 | Conflict | See the rule file |
| Weekdays: Monday, Wednesday, Thursday, Friday good; Tuesday avoided | Most quotes of S9. One quote of Muhurta Chintamani gives Sunday instead of Monday | Mostly agreed | See the rule file |
| Some nakshatra and thithi, and nakshatra and weekday pairs that are bad for other work are still good for marriage | S8 lists them | One source | Recorded |
| Avoid Vishti karana | S9 | Agreed | Yes |
| Venus and Jupiter not combust | S9 ("overrides everything") | Agreed | Yes |
| Tara bala and chandra bala from each person's birth star and Moon sign | S9 | Agreed | Yes |
| The 7th house from the ceremony lagna free of malefics | S9 | Agreed in general, details differ | Yes |
| Avoid Rahu kalaya | Sri Lankan practice (S2, S3 present it as the time to avoid for any good work) | Agreed | Yes |
| Which ceremonies get nakath: engagement, the poruwa, homecoming and more | S10 | One source | Engagement, poruwa, homecoming |
| Venus 10 degrees (8 when retrograde) and Jupiter 11 degrees from the Sun count as combust | Parashara's orbs, as quoted by several sites | Agreed on the orbs; tools differ at the edges | Yes |
| The day's star being a person's own birth star (janma tara) | Muhurtha sites treat it as weaker | Mixed | A caution, not a rejection |
| Yogas Vyatipata and Vaidhriti | Muhurtha sites list them as unfavourable for good work | Several sites | A caution |
| Engagement: the marriage nakathas, plus Pushya and Shravana; the bright half preferred | One source each (kundligpt.com, grahaguru.in) | Thin | Yes, the bright half as a caution only |
| Homecoming: Rohini, Mrigashira, Uttara Phalguni, Chitra, Anuradha, Uttara Ashadha, Uttara Bhadrapada, Revati | Griha pravesha lists (several property and astrology sites); none for the Sri Lankan homecoming itself | Mostly agreed, not Sri Lankan | Yes |
| Months to avoid for weddings in Sri Lanka | No source found | None | Not used |
| Daylight only | The ceremonies the sources describe are held in the day | Practice | Yes |

## 5. How well each rule is supported

**Well supported** (several sources agree, or checked against observed answers):
- Sunrise, thithi, nakatha, yoga, karana and the weekday from sunrise (40 of 40 moments on porondam.lk, drikpanchang.com within minutes).
- Rahu kalaya parts by weekday, and the whole minute rule (two Sri Lankan sites, exact).
- The Avurudu dawn as the Sun entering Mesha, and punya kalaya as 6 hours 24 minutes either side (every official list 2022 to 2027).
- The 11 marriage nakathas, the rikta thithis and the new moon, Vishti karana, Venus and Jupiter combust, tara bala and chandra bala.

**Resting on one source:**
- Times printed at the first whole minute a change holds (porondam.lk).
- The Magha, Mula and Revati padas to avoid (Daily Mirror). Another site avoids Mula padas 1 to 3.
- The engagement additions (Pushya, Shravana, the bright half).
- The weekday rule's Sunday (sources disagree with Monday).

**Not Sri Lankan, used for now:**
- The homecoming nakathas come from griha pravesha lists.
- The 7th house rule for the poruwa lagna comes from Indian muhurtha texts.

## 6. Questions for the astrologer

- Sunrise: upper edge with refraction (as Sri Lankan sites print it) or the disc centre?
- Rahu kalaya in whole minutes, as the sites do, or split exactly?
- The night Rahu kalaya rule, if it should be shown.
- The wedding thithis and weekdays where the texts disagree, and the Mula padas.
- Whether a Sri Lankan almanac (Epa or Thirasara panchanga litha) can be used to check change times.
- The homecoming nakathas, and whether a Sri Lankan homecoming follows the griha pravesha rules.
- Whether the poruwa lagna rule (no Sun, Mars, Saturn, Rahu or Ketu in the 7th house) is the one used in Sri Lanka, and whether other lagna rules apply.
- Whether janma tara should exclude a date rather than only be a caution.
- Any months or seasons Sri Lankan astrologers avoid for weddings.
- How astrologers abroad set the local Avurudu times for their city.

## 7. First letters ceremony (akuru kiyaweema)

Used in the first letters finder (set D, file 10). Rules in `first_letters_si_v1.yaml`. Free for now. Research done on 2026-11-13.

### Sources

| # | Source | What it is | Used for |
|---|---|---|---|
| A1 | porondam.lk, "අකුරු කියවීම" | Sri Lankan astrology site, a full guide to the ceremony | Nakathas, weekdays, tara from the birth star, dual lagna, empty 8th house, local sunrise, age |
| A2 | Divaina, "සතියේ සුබ නැකැත්", published 2026-07-11 | Sri Lankan newspaper's weekly nakath column | Two first letters times (15 and 16 July 2026) and the birth stars each suits |
| A3 | Divaina, "සතියේ සුබ නැකැත්", published 2026-03-22 | The same column | A Monday time (23 March 2026) and the stars it suits |
| A4 | Lankadeepa, Rasawitha column (2018) | Sri Lankan newspaper column | A Monday time (1 October 2018), the stars it does not suit, and the age |
| A5 | kaladasava.com, "සුබ නැකතට වැඩ අරඹමු නිසි වයසේ" | Sri Lankan article on the right age for each ceremony | Age, quoting Muhurta Chintamani and a Sinhala verse |
| A6 | drikpanchang.com, Vidyarambha muhurat | Indian panchanga site | Cross-check: nakshatras, thithis, weekdays, fixed lagnas, 8th house |
| A7 | dekhopanchang.com, module 17-4 | Indian muhurta course | Cross-check: nakshatras, weekdays, thithis, yogas, karana, Rahu kalaya |
| A8 | astromedha.in, Vidyarambh muhurat | Indian muhurta site | Cross-check: nakshatras, weekdays, thithis |

Not reachable: silumina.lk and lakpura.com refuse automated requests, and womanly.lk did not answer, even after their hosts were allowed. panchangbodh.com was read but adds nothing beyond A6 to A8.

### Rules

| Rule | Sources | Agreement | Used |
|---|---|---|---|
| Nakatha | A1: Ashwini, Rohini, Mrigashira, Punarvasu, Pushya, Hasta, Chitra, Swati, Anuradha, Shravana, Shatabhisha, Revati. A2 used Pushya and Ashlesha, A4 Mrigashira. A6 to A8 agree on most of A1's list, add Dhanishta, and A6 allows many more | A1 is the only Sri Lankan list. A7 avoids Ashlesha, which A2 used | A1's twelve. Other options: Dhanishta (A6 to A8), Ashlesha (A2) |
| Tara from the child's birth star | A1 (with two worked examples), A2, A3, A4 | The columns' lists of stars match tara bala exactly: they leave out 1 Janma, 3 Vipat, 5 Pratyari and 7 Vadha | Taras 1, 3, 5 and 7 are avoided |
| Weekday | A1: Wednesday, Thursday, Friday. A7, A8: Wednesday and Thursday best, Monday (and A8 Friday) close behind. A6: any day but Monday, Tuesday, Saturday. A2 to A4 used a Wednesday, a Thursday and two Mondays with special yogas | All avoid Tuesday and Saturday | Wednesday, Thursday and Friday. Monday and Sunday allowed with a caution |
| Lagna | A1: a dual (ubhaya) lagna. A2: Mithuna is "the lagna for letters". A4: Kanya. A6: avoid the fixed lagnas. A3 used Vrishabha with a special yoga | Three Sri Lankan sources point to the dual lagnas | Mithuna, Kanya, Dhanu or Meena |
| 8th house from the lagna empty | A1, A6 | Agree | No planet, the Moon included |
| Thithi | A6: 2, 3, 5, 6, 10, 11, 12 of either half. A7: Nanda and Bhadra (1, 6, 11, 2, 7, 12); avoid the rikta thithis. A8: avoid rikta and the new moon. The bright half preferred by all three | Agree on the rikta thithis and the new moon | Avoid 4, 9, 14 of each half and the new moon. 8, 13, 15, 23 and 28 (in neither good list) and the dark half are cautions |
| Karana and yoga | A7: avoid Vishti, Vyatipata and Vaidhriti. A2 and A4 speak of panchanga purity | Vishti is avoided for all good work (file 11, section 4) | Vishti avoided. Vyatipata and Vaidhriti are cautions |
| Rahu kalaya | A7, A8, Sri Lankan practice | Agree | Avoided |
| Time of day | A2, A3, A4 all give early morning times. A8 also suggests midday | | Daylight only. Morning windows rank first |
| Local sunrise | A1: the time changes from place to place | | The ceremony place's own sunrise and lagna, in its time zone |
| Age | A1: before the 5th birthday. A4: between 2 and 3. A5: the classical texts say the 5th year. A7: 3 to 5 | Disagree | Shown as a note when the range falls outside 2 to 5. Never used to hide a date |
| Hora (planetary hour) | A1, A4 and A7 favour a good hora (A7: Mercury or Jupiter; A4 used the Moon's) | Sources disagree on which hora, and on how the hora is counted | Not used. A question for the astrologer |
| Direction to face | A2: north, then east. A3: east. A4: south | No rule found | Not shown |

### Checked against the columns

Saved in `backend/tests/golden/first_letters_observed.json` and tested:

- **15 July 2026, 06:02, Colombo (A2):** our engine gives Pushya and Mithuna lagna, as the column says. Its 15 stars are exactly those with a good tara, and the moment passes every rule for each of them and fails for the rest. The finder offers that day, at a longer Kanya window later in the morning, because the Mithuna lagna lasts only a few minutes after sunrise.
- **16 July 2026, 06:22 (A2):** Ashlesha, and the column's stars match its tara exactly. Ashlesha is not in A1's list, so we do not offer it. The column says Mithuna lagna; with the Lahiri ayanamsa the lagna is Kataka by then.
- **23 March 2026, 07:02 (A3):** the Moon is exalted in Vrishabha, as the column says, in Krittika. The column's list of stars fits Mrigashira's tara, not Krittika's, so it is not used as a check.
- **1 October 2018, 06:22 (A4):** our engine gives Mrigashira, the Moon in Vrishabha and Kanya lagna, as the column says, and the stars it does not suit are exactly the avoided taras. Our rules reject the moment because the karana is Vishti and the yoga Vyatipata. The column itself says the panchanga is not pure that day and relies on the planets' strength.

### Well supported, and resting on one source

- **Well supported:** tara from the birth star (four Sri Lankan sources and the columns' own lists), avoiding Tuesday and Saturday, the rikta thithis and the new moon, Vishti karana, Rahu kalaya, a dual lagna (three Sri Lankan sources), early morning times.
- **One Sri Lankan source:** the twelve nakathas (A1), Friday (A1, with A6 and A8), the empty 8th house (A1, with A6).

### Questions for the astrologer

- Is A1's list of twelve nakathas the one to use? Should Ashlesha (used by A2) or Dhanishta be added?
- Should Monday count fully, as A2 to A4 used it?
- Should a dual lagna be required, or is avoiding the fixed lagnas enough?
- Which hora, and how is it counted in Sri Lanka?
- Which direction should the child face, and how is it chosen?
- The right age, and whether the ceremony is avoided in some months.
