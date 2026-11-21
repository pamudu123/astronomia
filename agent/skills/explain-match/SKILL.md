---
name: explain-match
description: How to explain a marriage match (porondam) result like a family astrologer - the overall picture, strengths and areas to work on grouped by theme, each factor in everyday words, the essential checks (Rajju, Vedha), the Mars check and each person's emotional style. Read before answering any question about a match result.
---

# Explaining a match result

A couple (or their parents) want to know three things: **are we well suited, where will it be easy, and where will we need to work at it**. Answer those, in that spirit, from the page's facts. The meaning of every factor in everyday words, the four themes, and how two Moon signs meet are in `reference.md` in this folder (open it at `/skills/explain-match/reference.md`). Open it before a full explanation.

## What the result contains

The App Context on the match page gives:

- `bride`, `groom`: each person's birth star, quarter, Moon sign and (for full details) rising sign.
- `score`: how many factors agree out of how many were counted ("12 of 15 factors agree").
- `essential_checks`: Rajju and Vedha, with `passes` and the site's `reason`. Kept apart from the count.
- `factors_agreeing` and `factors_not_agreeing`: each with its `name`, `meaning` and the site's `reason`.
- `softened_by` (on a factor or essential check that doesn't agree, when present): the site's sentences naming the traditional exceptions that soften it (dosha bhanga). The factor still counts as not agreeing; the page shows the same sentences under it.
- `factors_not_counted`: factors that need full birth details.
- `factor_themes` (in a written reading): the factors grouped by theme exactly as the page's ring groups them, each with its `agree` and `counted` counts and its `factors`. These counts add up to the score; use them as they are.
- `summary`: the site's one-line reading of the whole result.
- `mars_check`: whether each person's chart shows Kuja dosha, and how the two compare. Only with both birth details. In a written reading it also has, for each person, the `reasons` and each cancelling rule with whether it `applies`.
- `provisional`: true when the rules are still waiting for an astrologer to confirm them.
- `quick_match`: true when only the birth stars were entered, not full birth details. Then fewer factors are counted and there is no Mars check. Everything else on the page still works, including the wedding dates search.
- `wedding_dates`: present when the page has the wedding dates search. It says what the search needs: a venue and a range, nothing more.

## A full explanation ("explain my result", "tell me about our match")

1. **The overall picture**, in one or two sentences: the score and the site's summary, in warm plain words.
2. **The essential checks.** Say whether both pass. If one doesn't, say plainly that tradition treats this seriously whatever the count, calmly, and that a human astrologer reading both charts is the right next step.
3. **Where it comes easily.** Group the agreeing factors by theme (reference) and name the strongest one or two themes, with the reason behind one factor: "Your temperaments are in the same group (Gana), so you tend to react to life in a similar way."
4. **Where to give attention.** The non-agreeing factors, by theme and plain meaning, at most three, each with what it can look like in daily life and what couples do about it. Frame these as heads-ups, not verdicts. When a factor has `softened_by`, say so in the same breath: "it doesn't agree, but tradition softens it because..." (reference, "Softening").
5. **Each person's emotional style**, from the two Moon signs, and how they meet (reference). One or two sentences. Skip if there is no room.
6. **The Mars check**, in one sentence, if present.
7. **Close** with one offer: "Want me to go through any of these in more detail?"

For a short question, answer just that part. Don't run the whole structure for "what does Yoni mean?".

## Chapters

The match page offers a full reading in chapters, and explain buttons that show one or two of them. Each chapter has an id. The shape of every chapter (opening answer, short parts with bold leads, 150 to 350 words, no closing question) is in the `explain-card` skill. When someone asks the chat for their full match reading, or for one of these chapters, cover the same ground.

- **`match.people`, The two of you.** Each person's birth star and quarter, Moon sign and, with full details, rising sign, in plain words: what each placement says about how that person meets life. One part per person, then one short part on what the pairing brings. If `quick_match` is true, say that adding full birth details for both adds the rising signs, the Mars check and more factors.
- **`match.factors`, All the factors.** Every counted factor, grouped by `factor_themes`, in that order, under each theme's name as given. For each theme a bold lead with its `agree` of `counted` exactly as given (never recount or regroup), then each factor in one line: its name, agrees or not, and what it touches in married life (the reference's "what it is about" and "when it agrees / doesn't" columns), with the site's reason in simpler words where it helps. Then a short note on the factors not counted, if any, and why. Leave Rajju and Vedha to `match.checks`.
- **`match.checks`, The serious checks.** Rajju and Vedha: for each, what it is about, whether it passes here and the site's reason in plain words. If both pass, say so warmly and briefly. If one doesn't, follow "A full explanation" step 2: calm, serious, and a human astrologer reading both charts as the next step. If it has `softened_by` (for Rajju: one star ascending and the other descending), give that sentence and say many astrologers treat the check as softened in that case, but it still shows as not passing and a decision needs a human astrologer.
- **`match.mars`, The Mars check for both.** Open with whether each chart shows Kuja dosha and how the two compare (`mars_check.comparison`). Then, for each person who has it, the reason (`reasons`) and the cancelling rules that apply, in plain words; then what tradition reads into the comparison. Say that when both or neither have it, tradition treats them as balanced. If the Mars check is "not checked", say in two or three sentences what it is and that it needs full birth details for both, and stop.
- **`match.combinations`, Marriage combinations in each chart.** From `marriage_in_each_chart`: for each person, the 7th house (marriage and partnership) with its sign, where its ruler sits, the planets in it, Venus, and any combination found (`combinations`) that tradition reads for relationships (Ravi-Sukra, Kuja-Sukra, Chandra-Mangala, Shani-Mangala, Papa or Shubha Kartari on the 7th; meanings in the `personal-reading` reference, section 14). One part per person, then one on how the two fit. Possibilities, never a verdict; difficult ones with what helps. If it says full birth details are needed, say so in two sentences and stop.
- **`match.lords`, Your two 7th-house rulers.** From `seventh_lords`: the planet that rules each person's 7th house, how the two regard each other (`relation`: friends, neutral, enemies, mixed or the same planet), what tradition reads into it (reference, "The two 7th-house rulers") and what helps. Short: 120 to 200 words. If it says full birth details are needed, say so in two sentences and stop.
- **`match.years`, Your years ahead.** From `years_ahead`, the couple's next ten years (`window`). For each person, the life period running now (`now`) and the sub-periods and periods that follow, with their dates, each with its traditional theme (the `personal-reading` reference, section 8); and Saturn's harder stretches (`saturn`, with `kind` and the site's `text`). Then the stretches both share (`saturn_for_both`) and the windows that look easiest for both (where neither has a Saturn stretch). Possibilities and windows only, calm, with what helps in the harder stretches; never a date for an event. Call Saturn's stretches slower, more demanding times that ask for patience and steady pacing; if one is Saturn in the 8th from the Moon (`kind` "ashtama"), you may add once, for that person, the main rules' sentence about extra care with health and safety, and no more. If a person's `birth_details` is "quick", there are no life periods for them: say full birth details add them. A period whose `from` is "before this window" started earlier; give only its end.
- **`match.styles`, Emotional styles.** Each person's emotional style from the Moon sign, and how the two meet, using the elements (reference, "Each person's emotional style"). One part per person, one on the meeting, one on what helps day to day.
- **`match.summary`, Summing up.** A full explanation, as above (steps 1 to 6), as a chapter: the overall picture, the essential checks, where it comes easily, where to give attention. End with the next steps (talking it over with family; a human astrologer for a decision; adding full details if this was a quick match). Never a verdict, never a percentage.

Each chapter gets the whole match result. Use only the part the chapter is about, so chapters don't repeat each other.

## Explaining one factor

Say what it is about in everyday words (reference), then the site's `reason` in simpler words, keeping its facts exactly. Then what it can look like in real life and, if it doesn't agree, what helps. For example:

> Yoni is about natural attraction and physical ease between two people. Here it agrees: your two birth stars carry animal symbols that tradition pairs well. In daily life that often shows up as feeling comfortable with each other quickly.

> The Rajju check is about the stability and strength of the marriage. Here it doesn't pass, because both birth stars fall in the same group. Tradition takes this check seriously, so it's worth sitting down with your family and a human astrologer who can read both full charts.

> Gana is about temperament. It doesn't agree here: one of you is in the gentle group and the other in the fierce group, so you may react to things at different speeds. Tradition softens this, though, because the planets ruling your two Moon signs are friends. In practice, naming the difference early and agreeing how to disagree goes a long way.

## Things to keep in mind

- The count is not a percentage or a forecast. The page says so too.
- A factor that was "not counted" needs full birth details. Suggest a full match if they only did a quick match, but only for those factors and the Mars check: wedding dates don't need it.
- If `provisional` is true and the person is weighing a decision, mention that the rules are still being confirmed by an astrologer.
- Same birth star for both: traditions differ, so the site suggests an astrologer reviews it.
- Many matches have some factors that don't agree. Say this when someone is worried, without promising anything.
- The twenty factors come from the two birth stars and Moon signs only. Sri Lankan writers stress that the rest of both charts (the rising signs, the 7th houses, the planets) matters as much or more. Say so when someone is upset by a low count, and point to the chart-based chapters (Mars check, marriage combinations, 7th-house rulers) when they have full details.
- Where a factor's traditional meaning touches long life or health (Rajju, Ayusha, Nakath, Nadi), use the softer words in the reference. Never mention death or lifespan, never predict illness or problems with children.
- Varna is an old grouping. Talk about outlook and roles, never class or caste.

## Never

- Never say the couple should or shouldn't marry, or give a verdict like "good match" or "bad match". If asked "Is this a good match?", describe what agrees, what doesn't, and how the essential checks came out, then say the decision belongs to them, their family and an astrologer.
- Never invent a factor result, a reason or a remedy.
