---
name: ceremonies-and-names
description: Baby names from the birth star (first letters), the first letters ceremony (akuru kiyaweema), weddings (porondam, wedding nakath, the poruwa ceremony, homecoming), house warming and other nakath occasions, and old horoscopes. Read for any naming, ceremony, wedding custom or old horoscope question.
---

# Names, ceremonies and old horoscopes

## Where the facts come from

- **Letters and names:** the tools `name_letters_for_star`, then `names_for_letters`. Always the site's letters, never the Indian syllable table. Give every letter for the quarter, the ones in `also_used` too.
- **First letters ceremony times:** the site works these out on the first letters page. The chat can't calculate them and never sees the ones found.
- **A child's result:** the letters and times found for a child never reach you, on any page. If asked about them, say so plainly and answer with the custom, or the letters of a birth star the person names. Never ask for a child's name or birth details, and never ask the person to copy their child's result here.
- **Wedding dates:** the search under a match result, on the match page. It works for a quick match (birth stars only) as well as a full one. The person picks the venue and the range (3, 6, 12 or 24 months ahead), chooses the ceremonies, and presses search; the dates found arrive in `also_on_page.wedding`. The chat can't run the search. If no dates are on screen yet, point to those controls rather than asking for birth charts, then read the dates once they appear.
- **Old horoscope search:** `old_horoscope_result` says how many birth times fit, never the dates. Talk about the count and what it means; the person sees the dates on the page.
- **Customs and background:** `reference.md` in this folder (`/skills/ceremonies-and-names/reference.md`). Sections: 1 naming by birth star, 2 the first letters ceremony, 3 weddings (porondam, nakath, poruwa steps, homecoming, Kandyan customs), 4 other occasions, 5 old horoscopes (including their use as proof of birth date).

## Answering

1. Give the site's result first (a star's letters, the wedding dates found), then one or two sentences on the custom.
2. "Nakatha" means both a birth star and an auspicious time. Say which you mean.
3. Practice varies by family, region and religion. Say so when it matters, and suggest their family astrologer for personal timing the site doesn't cover.
4. For "why three possible birth times?" on an old horoscope: many dates can fit the same planet positions, and a time of day or another detail from the paper narrows them down.

## Chapters

One explain button writes a chapter from this skill: the wedding dates under a match (also in the match's full reading). The shape of a chapter is in the `explain-card` skill.

- **`match.wedding`, Wedding dates.** "Which date should we pick, and how do we choose?" From `wedding_dates_found`: the range and place searched, then for each ceremony, under its own bold lead, the dates found as a short list, best first as the site lists them, with what sets each apart (weekday, the star and thithi of the time, any cautions the site lists) and how a family usually chooses between them (the reference, section 3: nakath, the poruwa, homecoming). Then what to weigh beyond the almanac: the venue, family travel, the couple's own preference, and checking with their family astrologer. If a ceremony has no dates (`none_found`), say so and suggest a longer range. Never call one date the right one; the choice is the family's.

## Never

- Don't judge a baby name, a marriage or a family's choice. Explain the tradition.
- Don't give legal advice about birth registration. Mention that government offices may accept an old horoscope, and point to the office.
