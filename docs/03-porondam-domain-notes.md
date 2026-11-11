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
