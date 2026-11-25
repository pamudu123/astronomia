---
name: calendar-and-nakath
description: Background on nakath (auspicious times), the litha almanac (thithi, nakatha, yoga, karana), Rahu kalaya, poya days and the Sinhala months, and how to answer "is this time good?". Read for any question about a day's times, almanac words, poya or lucky days.
---

# Nakath, the litha and poya

## Where the facts come from

- **Times for a day or month:** the App Context (`good_times_day`, `litha_month`) or the tools `good_times_for_day` and `month_calendar`. Default place: Colombo. Say which place the times are for.
- **Today, tomorrow, yesterday:** the date in the Today note for Sri Lanka; `current_date` with the place's time zone for anywhere else. Look up that exact date and say it in the answer.
- **What the words and customs mean:** `reference.md` in this folder (`/skills/calendar-and-nakath/reference.md`). Sections: 1 nakath, 2 the five parts of the litha, 3 Rahu kalaya, 4 the twelve poya days and Adhi poya, 5 Sinhala months, 6 directions and colours, 7 what a day's star and lunar day are linked to.

## Answering "is this time good for…?"

The site shows the day's parts (Rahu kalaya, thithi, nakatha, yoga, karana). It doesn't rate a time for a particular purpose. So:

1. Give the facts for that time: inside or outside Rahu kalaya, and which thithi and nakatha it falls in.
2. Say what tradition says about those, from the reference: people avoid starting new things in Rahu kalaya, and the day's star and lunar day are each linked to some kinds of work (section 7). Open the reference for this.
3. For an important personal event, suggest asking their astrologer. For a wedding, point to the wedding dates search under a match result (birth stars are enough). For a first letters ceremony, point to the first letters page.

**At a certain hour.** When they name an hour, call `good_times_for_day` with `time` for every day asked about and use its `at_time`: whether the hour is inside Rahu kalaya, and the star and lunar day then. Don't compare times yourself. On the day's own page, where there is no `at_time`, look the day up with the tool too.

**Several days to choose from.** The site doesn't rank days, so don't name a best one, not even "by the almanac". For each day asked about, every one of them, give its Rahu kalaya with its times and whether the hour falls inside it (`inside_rahu_kalaya`), and the star and lunar day at that hour with what tradition links them to. Open by saying which of the days fall inside Rahu kalaya. Then leave the choice to them and their astrologer.

## Poya

- Poya days from the page or the tools are calculated full moons: that is the date to give. The official calendar can differ by a day: say so for religious observance. Section 5 of the reference says which poya falls in which month now.
- Always give the poya's name with its date, and one sentence on what it commemorates (reference, section 4), even when only the date was asked. More only if they ask. In Sinhala, use the Sinhala name from the same table.

## Chapters

The day's nakath page has an explain button that writes one chapter from this skill. The shape of a chapter is in the `explain-card` skill.

- **`nakath.day`, What kind of day it is.** "What kind of day is today, and what is it good for?" Open with what the day suits, in plain words: what tradition links the day's star to (reference, section 7), named as everyday work (building, travel, learning, meeting people, quiet work). Rahu kalaya and "ask an astrologer" are not an opening. Then, from the page's day (`good_times_day`): the date, weekday and place, and what the day's thithi (the Moon's day) and nakatha (the star of the day) are (with their times when they change during the day), what tradition links them to, and Rahu kalaya with its time and what people avoid starting in it. Say what each of them is linked to, not only its name and time; when the star or lunar day changes during the day, say what changes with it. Then what the day suits and what people usually put off, as tradition, with a note that a family astrologer sets the time for a big event. If `provisional` is true, say once that the rules are still being confirmed. Use only the times given.

## Never

- Don't invent a nakath time, a direction or a colour. Those come only from the tools or the page.
- Present lucky and unlucky times as tradition ("traditionally", "astrologers say"), never as fact.
