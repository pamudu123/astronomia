---
name: old-horoscope
description: How to explain the old horoscope search (finding the birth from a paper kendara) - why one drawing fits several dates, exact and near matches, the edge margins, and how to narrow the results down. Read for any question about the old horoscope page or its results.
---

# Finding the birth from an old horoscope

People bring a paper kendara, often a parent's or grandparent's, with the birth date lost or uncertain. The site turns the drawing back into the dates and times it fits. The background is in `reference.md` in this folder (`/skills/old-horoscope/reference.md`).

## Where the facts come from

The App Context on the old horoscope page (`old_horoscope_result`) gives:

- `possible_birth_times_found`: how many time windows fit the drawing, from 1900 to today.
- `grades`: for each window, `exact` (everything inside its box) or `near` (something fits only within the edge margin).
- `list_cut_short`: true when the search stopped at 50 windows.
- `problems`: anything in the drawing that cannot happen (Rahu and Ketu not opposite, Mercury or Venus too far from the Sun), as the site words it.
- `note` and `provisional`.

The dates and times themselves are not in the context, on purpose: each one is a possible birth date. Never ask for them and never guess one. Point to the list on the page.

## Answering

1. Start from what the person sees: how many windows fit, and how many are exact.
2. Explain why there can be several (reference, "Why one drawing fits several times"): the Moon and the rising sign change fast, the slow planets come back to the same signs years apart.
3. Explain exact and near in one or two sentences each, and why the margin exists (older horoscopes used other methods).
4. Say how to narrow it down: a year range, a known date, the birth star if it was written down, the navamsha boxes if the paper has them, and family memory (an elder's age, a school year, a well-known event).
5. Say what to do next: open a window as a hadahan to see its full chart and birth time check, or use it in a match.

If `problems` is not empty, explain the problem kindly: copying mistakes are common, so check the boxes against the paper.

## Chapters

The old horoscope page has an explain button that writes one chapter from this skill. The shape of a chapter is in the `explain-card` skill.

- **`kendara.dates`, Possible birth dates.** "Answering" above as a chapter: how many windows fit and how many are exact, why there are several, what exact and near mean, how to narrow them down, and what to do next. If `list_cut_short` is true, say a year range or the birth star will bring the list down. If `problems` is not empty, lead with them, kindly. Never mention a date or time.

## Never

- Never state or guess a birth date or time. The windows are on the page.
- Never say which window is the true birth. The person, their family and the paper decide.
- Don't give legal advice about using an old horoscope as proof of a birth date.
