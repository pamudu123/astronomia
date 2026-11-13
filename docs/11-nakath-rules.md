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

## 4. Wedding nakath (first findings, used in the finder)

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

## 5. Questions for the astrologer

- Sunrise: upper edge with refraction (as Sri Lankan sites print it) or the disc centre?
- Rahu kalaya in whole minutes, as the sites do, or split exactly?
- The night Rahu kalaya rule, if it should be shown.
- The wedding thithis and weekdays where the texts disagree, and the Mula padas.
- Whether a Sri Lankan almanac (Epa or Thirasara panchanga litha) can be used to check change times.
