# Porondam Domain Notes

Background for the matching engine. **None of this is validated by a Sri Lankan astrologer.** Treat it as a starting point and get it reviewed before coding the rules.

## What porondam is

Families compare the bride's and groom's birth charts to see how well they agree. Sinhala: porondam (පොරොන්දම්). Tamil: porutham (பொருத்தம்). Sri Lankan astrologers traditionally check **twenty points**, called the **visi porondam**.

## Points mentioned in the sources I found

Confirmed by search results (Lakpura and others):

| Point | What it is said to indicate |
|---|---|
| Dina | Health, prosperity, longevity |
| Gana | Personality / temperament (Deva, Manushya, Rakshasa) |
| Mahendra | Wealth, fertility, family growth |
| Stree Deergha | Wellbeing of the bride, prosperity |
| Yoni | Physical compatibility |
| Rashi | Moon signs and emotional bonding |
| Rashyadhipathi | Ruling planets of the two moon signs |
| Vashya | Mutual attraction and understanding |
| Rajju | Longevity of the couple |
| Vedha | Mutually afflicting stars (pass or fail style check) |
| Nadi | Health and genetic compatibility |

The full list of 20 is **not confirmed**. One search summary gave a garbled list. Do not assume the remaining names. Get the authoritative list from an astrologer or a standard Sinhala text.

## Rules sources agree on

- A match with **more than half of the points** is treated as acceptable in published Sinhala guidance.
- **Rajju and yoni** are treated as essential in both Sinhala and Tamil practice. Missing either is taken seriously regardless of the total.
- Tamil porutham uses a shorter list (commonly 10 points, with 8 of 10 often wanted).
- A score is a starting point. Astrologers also read the full charts.

## Kuja dosha (Mars affliction)

Sources disagree on which houses count:

- Houses 1, 2, 4, 7, 8, 12 counted from lagna, Moon or Venus (one Sri Lankan source)
- Houses 1, 4, 7, 8, 12 (another source)
- Houses 2, 4, 7, 8, 12 (a Tamil tradition source)

A Daily Mirror column warns that many astrologers declare the dosha too quickly and that many planetary combinations cancel or reduce it. The engine should support **cancellation rules** and show the reasoning, not just a yes or no. The rules must be fixed with your astrologer.

## Inputs the engine needs

- Birth date, exact time, place (latitude, longitude, time zone at that date)
- Moon nakshatra and pada, moon rashi, lagna, planetary positions
- Birth weekday (used for Dina in some systems)

## Edge cases to plan for

- Unknown birth time (offer a rashi or nakath only match)
- Birth near midnight or near a nakshatra boundary
- Historical Sri Lankan time zone changes
- Birth abroad
- Same nakshatra for both people
- Two systems (Sinhala, Tamil) giving different answers on the same pair

## Privacy

Birth details plus marriage intent are sensitive. Prefer no storage by default, minimal logging, clear deletion, and no selling of data.

## What the site uses now (provisional)

The engine applies all 20 factors from `backend/app/data/rules/porondam_si_v3.yaml` (versions 1 and 2, with 11 and 15, are kept). "Count" means the groom's star counted from the bride's, both included.

| Factor | Rule used |
|---|---|
| Nakath (id `dina`) | Count divided by 9 leaves 2, 4, 6, 8 or 0 |
| Gana | Same gana, or Deva with Manushya |
| Mahendra | Count is 4, 7, 10, 13, 16, 19, 22 or 25 |
| Stree Deergha | Count is more than 13 |
| Yoni | The two star animals are not an enemy pair |
| Rashi | The groom's Moon sign is not 2nd, 6th, 8th or 12th from the bride's |
| Rashyadhipathi | Neither sign lord counts the other as an enemy |
| Vashya | Either sign holds the other in vashya |
| Gothra | The two stars belong to different sages (table below) |
| Pakshi | The two birds are not enemies (table below) |
| Linga | Bride and groom, in that order: female and male, female and female, or one neuter star with a female one |
| Dina (id `weekday`) | The groom's birth weekday, counted from the bride's, is not 6th or 7th. Needs both birth dates, so a birth star only match leaves it out of the count |
| Varna | The groom's varna is the same as or higher than the bride's, by Moon sign: Kataka, Vrischika, Meena Brahmana; Mesha, Simha, Dhanu Kshatriya; Vrishabha, Kanya, Makara Vaishya; Mithuna, Tula, Kumbha Shudra |
| Bhutha | The two stars' elements are not water and fire (table below) |
| Vruksha | Not two hard trees (table below) |
| Ayusha | The two stars are not 3, 4 or 5 apart in the 28 star count |
| Graha | At least 2 of 4 checks between the lagna lords and the Moon sign lords are friendly or neutral. Needs both lagnas, so a birth star only match leaves it out of the count |
| Nadi | Different nadi |
| Rajju (essential) | Different rajju |
| Vedha (essential) | Not an afflicting star pair |

The star count factor was shown as "Dina" until rule set 2. The Sri Lankan sites call it the Nakath porondama and use "Dina" for the birth weekdays, so the names now follow them. The ids did not change.

## The 20 factors, and where the added four came from (2026-11-12)

**The 20 names.** Three Sri Lankan sites agree on the list: Nakath, Gana, Mahendra, Stree Deergha, Yoni, Rashi, Rashyadhipathi, Vashya, Rajju, Vedha, Vruksha, Ayusha, Pakshi, Bhutha, Gothra, Varna, Linga, Nadi, Dina and Graha (purahada.lk, porondam.lk, kendra.lk, and an older list on oocities.org). They describe each one but publish no tables.

**The tables.** purahada.lk works out all 20 and shows, for each factor, each person's value (bird, gothra and so on) and a result of good, medium or bad. Its total counts good as 1 and medium as a half. We sent it 34 made-up couples (no real person's details), chosen so that every star appears on both sides, and read the results. The data is in `backend/tests/golden/porondam_observed.json`, and `backend/tests/test_porondam_observed.py` checks the added factors against all 34. A result of medium counts as agreeing.

**Gothra.** The seven sages take four stars each in the 28 star count, where Abhijit lies between Uttara Ashadha and Shravana:

| Sage | Stars |
|---|---|
| Marichi | Ashwini, Bharani, Krittika, Rohini |
| Atri | Mrigashira, Ardra, Punarvasu, Pushya |
| Vasishta | Ashlesha, Magha, Purva Phalguni, Uttara Phalguni |
| Angirasa | Hasta, Chitra, Swati, Vishakha |
| Pulasthi | Anuradha, Jyeshtha, Mula, Purva Ashadha |
| Pulaha | Uttara Ashadha, (Abhijit), Shravana, Dhanishta |
| Kratu | Shatabhisha, Purva Bhadrapada, Uttara Bhadrapada, Revati |

The site's picture lists the gothra by the 27 star count (it puts Shatabhisha with Pulaha), but its results follow the table above in every case.

**Pakshi.** Eagle: Ashwini to Mrigashira. Owl: Ardra to Purva Phalguni. Crow: Uttara Phalguni to Vishakha. Cock: Anuradha to Shravana. Peacock: Dhanishta to Revati. The owl is the enemy of every other bird, and the eagle of the cock and the peacock. The eagle with the crow came out as good one way round and medium the other; both count as agreeing.

**Linga.** Male: Ashwini, Bharani, Rohini, Ardra, Punarvasu, Pushya, Magha, Chitra, Swati, Jyeshtha, Shravana, Purva Bhadrapada, Uttara Bhadrapada. Female: Krittika, Ashlesha, Purva Phalguni, Uttara Phalguni, Hasta, Vishakha, Anuradha, Purva Ashadha, Uttara Ashadha, Dhanishta, Revati. Neuter: Mrigashira, Mula, Shatabhisha. The rule matches the site's own description: a female bride with a male groom is best, two female stars also agree.

**Dina.** Every weekday pair we saw fits one rule: it does not agree when the groom was born on the weekday one or two days before the bride's. We used births between 08:00 and 20:00, so this does not show whether the day starts at midnight or at sunrise. We use the calendar date.

## The last five factors (2026-11-13)

We read lankahandahana.com's article on each factor, searched Sinhala and English sources, and sent purahada.lk 40 more made-up couples: 74 results in all, 61 different star pairs. The data is in `backend/tests/golden/porondam_observed.json`.

**Bhutha.** It agrees with the site on all 61 pairs.

- **Table** (lankahandahana.com, Sinhala Wikipedia):
  - Pathavi: Ashwini to Mrigashira.
  - Apo: Ardra to Purva Phalguni.
  - Thejo: Uttara Phalguni to Vishakha.
  - Vayo: Anuradha to Shravana.
  - Akasha: Dhanishta to Revati.
- **Rule:** the same element is good, and water with fire is bad, either way round. Any other pair partly agrees. The Prabhashwara astrology blog states the same rule.
- **The site's picture** shows a table one star off, as it does for Gothra.

**Vruksha.** It agrees with the site on all 61 pairs.

- **Milk trees:** Pushya, Ashlesha, Magha, Purva Phalguni, Uttara Phalguni, Jyeshtha, Mula, Uttara Ashadha, Shravana, Purva Bhadrapada and Revati. The other 16 are hard trees.
- **Sources for the list:** the Dinamina newspaper names the first ten and says there are 11 milk and 16 hard. nonshout.com adds Revati.
- **Rule, bride first:**
  - A milk tree bride agrees.
  - A hard tree bride with a milk tree groom partly agrees.
  - Two hard trees do not agree.
- **Points:** this matches lankahandahana.com's 5, 3, 1 and 0 out of 5.
- **Purva Ashadha** is hard in every source, but the site's results cannot tell it apart.

**Ayusha.** It agrees with the site on all 61 pairs.

- **Count:** in the 28 star count, take how far apart the two stars are the nearer way round, both ends included (1 to 15).
- **Results:** 1 to 2 apart is good, 3 to 5 is bad, 6 to 10 partly agrees, and 11 to 15 is good.
- **The published method** (lankahandahana.com, a Lankadeepa column, and purahada.lk's own text): count both ways, take each remainder after dividing by 28, and the larger remainder belongs to the person who lives longer. No version of that formula gives the site's results, so the bands above are used.

**Varna.** The site's results depend on both the Moon star and the lagna in a way 74 couples could not pin down.

- **What we use:** the Moon sign table with the rule most sources give: the groom's varna the same as or higher than the bride's (induwara.lk, kendra.lk, and most Indian sources).
- **Star table:** lankahandahana.com and the site also show one, a cycle of six from Ashwini: Brahmana, Kshatriya, Vaishya, Shudra, Panchama, Sankara. No source says how to compare it.

**Graha.** The site says "bad" for 59 of the 74 couples and changes with the birth time. No rule we tried does better than always "bad".

- **What we use:** lankahandahana.com's method.
  - Four checks, each with the same planet, a friend or a neutral counting: each lagna lord towards the other, and each Moon sign lord towards the other.
  - It agrees with 2 or more of the 4.
  - Their own points: 4 gives 5, 3 gives 4, 2 gives 3, 1 gives 1, 0 gives 0.
- **Sinhala Wikipedia** describes another method: malefics in the 7th or 8th house of the bride's chart. It is close to the Kuja dosha check, so it was not used.

**Vedha.** On the first 34 couples the site agreed with our Vedha every time. The new couples show three more pairs the site counts as afflicting: Ashwini with Mrigashira, Magha with Dhanishta, and Hasta with Dhanishta. Our table is unchanged.

**Where the site and our existing factors differ.** Over the first 34 couples, the site agreed with our Yoni, Nadi and Vedha every time (Yoni and Nadi still agree on all 74). It often differs on Vashya (4 of 34 agree), Rashyadhipathi (19), Rajju (22), Mahendra (26), Nakath (27), Stree Deergha (30) and Gana (31). For its Rashi and Rajju rows, the site's picture shows the lagna signs, not the Moon signs, so it may use the lagna for some of these. These are questions for the astrologer. We have not changed the existing factors.

## Questions for the astrologer

1. A check of all the tables above, and of the methods chosen for Varna (Moon sign) and Graha (lagna and Moon sign lords).
2. Is the Stree Deergha threshold 13, or another number (some sources use 9 or 15)?
3. Which Rashi distances fail: 2/12 and 6/8 only, or also 5/9?
4. Is Yoni an essential check, like Rajju and Vedha?
5. How should the same birth star for both people be treated?
6. Should Gana count direction (for example a Manushya bride with a Deva groom)?
7. Is the planet friendship table the natural one, or a Sinhala variant?
8. Is the pass mark "more than half of the scored factors"?

9. Does the birth weekday (Dina) start at midnight or at sunrise?
10. Should Vashya, Rashyadhipathi and Rajju use the Moon sign or the lagna?
11. Years ahead for the couple shows Saturn in the 12th, 1st and 2nd sign from the Moon (Erashtaka) and in the 8th. Are these the right periods to show, and should any others be added (for example Saturn in the 4th)?
12. How should a couple read these Saturn periods and their dasha periods together? Until this is answered the page shows dates only.
13. Ayusha: is the site's distance table right, or the published remainder method? How should the remainder method be read?
14. Vedha: are Ashwini with Mrigashira, Magha with Dhanishta, and Hasta with Dhanishta afflicting pairs?
