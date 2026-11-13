# Baby and Child Rules

The rules behind set D (baby and child, see file 10): the starting letters for a baby's name, the names list, and the first letters ceremony. For each rule: which sources say it, where they disagree, and what the site uses.

Everything here is provisional until a practising astrologer confirms it. The tables live in versioned files in `backend/app/data/rules/`, so they can be corrected without code changes.

Research done on 2026-11-13. Where a site works the letters out itself, it was asked about made-up births only, never a real person.

## 1. Sources for the letter table

| # | Source | What it is | Counted |
|---|---|---|---|
| L1 | *Lanka Panchanga Grahasphuta Litha 2019-2020*, page 53, as quoted in a blog post on priyankaramanjusawa.blogspot.com (12 May 2020) | A Sinhala almanac. The most authoritative source we found, though we read it second hand | Yes. Ties go to it |
| L2 | lankahandahana.com, Sinhala baby names | Sri Lankan site that gives the letter for a birth time. Asked about 108 made-up births in Colombo, one in the middle of each star and pada | Yes |
| L3 | laksara.com, "Naming a newborn child" | Sri Lankan culture site with the full table, the lagna letters and the weekday letters | Yes |
| L4 | Sunday Lankadeepa, Rasawitha section | Sri Lankan newspaper column with the full table and the weekday letters. One pada (Uttara Bhadrapada 3) is missing | Yes |
| L5 | udendras blogspot (2016) | The same table as L3, letter for letter, with the same lagna letters | No. A copy of L3, so it would count the same text twice |
| L6 | The classical Indian table (Hindi "Chu Che Cho La", as on onlinejyotish.com and similar sites) | The common Indian table | No. Cross-check only. The Sinhala table wins |
| L7 | The Jyothishya app | Sri Lankan app with "auspicious letters for your name" | Not used. Its letters are behind its paywall and the app is not open to reading |

The star and pada that L2 printed for each of its 108 births agree with our engine 108 of 108. So its letters are tied to the same star and pada as ours.

## 2. The letter table

| Rule | Sources | Agreement | Used |
|---|---|---|---|
| One letter for each of the 108 padas | L1 to L4 | All four | `stars` in `rules/name_letters_si_v1.yaml` |
| Choosing between sources | Our choice | | The letter most of L1 to L4 give. A tie goes to L1, the almanac. The other letters are kept under `others` and shown on the page |
| The pada comes from the Moon at birth | L1 to L4, L6 | All | The Moon's star and pada from the hadahan engine (Lahiri) |

Of the 108 padas, 84 are the same in all four sources. The 24 that differ:

| Star, pada | Used | L1 almanac | L2 lankahandahana | L3 laksara | L4 Lankadeepa | Note |
|---|---|---|---|---|---|---|
| Ashwini 1 | චු | චු | චූ | චු | චූ | A tie on the vowel length. The almanac decides. L6 has the long vowel |
| Bharani 1 | ලි | ලී | ලි | ලි | ලි | Vowel length |
| Rohini 2, 3, 4 | ව වි වු | ව වි වු | same | same | ච චි චු | L4 alone has ච. ව and ච look alike in print |
| Mrigashira 1, 2 | වෙ වො | වෙ වො | same | same | චෙ චො | As above |
| Ardra 2 | ඝ | ඝ | ඝ | ඝ | ස | |
| Ardra 3 | ඞ | ඩ | ඞ | ඞ | ධ | ඩ and ඞ look alike in print |
| Ardra 4 | ඡ | ඡ | ච | ඡ | ජ | Two of four. L6 also has Chha |
| Pushya 1 | හු | හු | හු | හු | හූ | Vowel length |
| Magha 2, 3 | මි මු | මි මු | same | same | මී මූ | Vowel length |
| Purva Phalguni 2 | ට | ට | ට | ට | ම | |
| Uttara Phalguni 4 | පි | පි | පි | පි | කි | |
| Hasta 2 | ෂ | ෂ | ෂ | ෂ | ස | |
| Hasta 4 | ඨ | ඨ | ඨ | ඨ | ධි | |
| Mula 3, 4 | බ බි | බ බි | same | same | ඔ ඕ | |
| Purva Ashadha 3 | එ | එ | භ | එ | එ | **Check.** L6 has Bha or Pha (භ or ඵ). එ and ඵ look alike in print, so the Sinhala sources may share an old misprint. L2 gives භ |
| Purva Ashadha 4 | ඪ | ඪ | ඪ | ඪ | ඵ | |
| Uttara Ashadha 4 | ජි | ජි | ජි | ජි | පි | |
| Shravana 2 | ජෙ | ජේ | ජෙ | ජෙ | ජෙ | Vowel length |
| Shravana 4 | ෂ | ෂ | ඛ | ෂ | ප | **Check.** Two of four. L2 and L6 give ඛ (Kha) |
| Dhanishta 1 | ග | ග | ග | ග | ගැ | |
| Uttara Bhadrapada 2 | ථ | ථ | ථ | ථ | ථි | |
| Revati 3, 4 | ච චි | ව වී | ච චි | ච චි | ච චි | L1 alone has ව. ව and ච look alike in print |

Many of the differences are letters that look alike in print (ව and ච, ඩ and ඞ, එ and ඵ) or a long against a short vowel. The two that are not are marked **Check**.

## 3. Lagna and weekday letters

Some families also look at the lagna or the weekday. The page shows these as extra letters, after the birth star letter.

| Rule | Sources | Agreement | Used |
|---|---|---|---|
| Letters for each lagna | L3, L4, L5 | L3 and L5 are the same. L4 differs only in print for Mithuna (උෟ, සෘ, සෲ for ඌ, ඍ, ඎ) and has two letters for Kataka | `lagna` in the rule file, from L3 |
| Letters for each weekday | L3, L4 | Sunday to Saturday agree on the groups. L4 adds the long vowels for Sunday and has ස, ධ for Tuesday where L3 has ඝ, ඬ | `weekday` in the rule file, from L3 |
| The weekday starts at sunrise | File 11 | | A birth before sunrise belongs to the day before. The page says so |

## 4. The birth time check

The letter follows the pada, and a pada lasts about six hours. If the Moon changes pada within 15 minutes of the given time, the page shows the next or previous pada's letter and how many minutes away the change is. The lagna and star check from the hadahan is shown too. Both use the same 15 minutes as the hadahan.

## 5. Tables that rest on one source

- The almanac table (L1) is read from a blog that quotes it, not from the almanac itself. A copy of the almanac would settle the **Check** rows.
- The lagna and weekday letters rest on L3, with L4 as a partial check.

## 6. Questions for the astrologer

1. Purva Ashadha pada 3: එ (the Sinhala sources) or භ or ඵ?
2. Shravana pada 4: ෂ or ඛ?
3. Ardra pada 4: ඡ, ච or ජ?
4. Ashwini pada 1 and the other vowel length rows: does the length matter for the name?
5. Is the lagna or weekday letter used when the star letter does not suit the family? Which comes first?
6. When the birth time is near a pada change, which letter should the family use?
