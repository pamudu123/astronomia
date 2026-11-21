---
name: calendar-and-nakath
description: Background on nakath (auspicious times), the litha almanac (thithi, nakatha, yoga, karana), Rahu kalaya, poya days and the Sinhala months, and how to answer "is this time good?". Read for any question about a day's times, almanac words, poya or lucky days.
---

# Nakath, the litha and poya

## Where the facts come from

- **Times for a day or month:** the App Context (`good_times_day`, `litha_month`) or the tools `good_times_for_day` and `month_calendar`. Default place: Colombo. Say which place the times are for.
- **Today, tomorrow, yesterday:** the date in the Today note for Sri Lanka; `current_date` with the place's time zone for anywhere else. Look up that exact date and say it in the answer.
- **What the words and customs mean:** `reference.md` in this folder (`/skills/calendar-and-nakath/reference.md`). Sections: 1 nakath, 2 the five parts of the litha, 3 Rahu kalaya, 4 the twelve poya days and Adhi poya, 5 Sinhala months, 6 directions and colours.

## Answering "is this time good for…?"

The site shows the day's parts (Rahu kalaya, thithi, nakatha, yoga, karana). It doesn't rate a time for a particular purpose. So:

1. Give the facts for that time: inside or outside Rahu kalaya, and which thithi and nakatha it falls in.
2. Say what tradition says about those, from the reference: for example, people avoid starting new things in Rahu kalaya.
3. For an important personal event, suggest asking their astrologer. For a wedding, point to the wedding dates search under a match result (birth stars are enough). For a first letters ceremony, point to the first letters page.

## Poya

- Poya days from the tools are calculated full moons. The official calendar can differ by a day: say so for religious observance.
- What each poya commemorates is in the reference. Keep it to one or two sentences unless they ask for more.

## Chapters

The day's nakath page has an explain button that writes one chapter from this skill. The shape of a chapter is in the `explain-card` skill.

- **`nakath.day`, What kind of day it is.** "What kind of day is today, and what is it good for?" Open with what the day suits, in plain words. Then, from the page's day (`good_times_day`): the date, weekday and place, and what the day's thithi (the Moon's day) and nakatha (the star of the day) are (with their times when they change during the day), what tradition links them to, and Rahu kalaya with its time and what people avoid starting in it. Then what the day suits and what people usually put off, as tradition, with a note that a family astrologer sets the time for a big event. If `provisional` is true, say once that the rules are still being confirmed. Use only the times given.

## Never

- Don't invent a nakath time, a direction or a colour. Those come only from the tools or the page.
- Present lucky and unlucky times as tradition ("traditionally", "astrologers say"), never as fact.
