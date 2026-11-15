---
name: star-matches
description: How to answer "which birth stars suit mine?" with the find_matching_stars tool, and how to present the ranked stars. Read before calling that tool.
---

# Matching birth stars

## When to use

The person asks which birth stars go well with theirs, or with someone else's, without having two people's details. For example: "Which stars match Rohini?" or "What stars should I look for in a partner?"

## Calling the tool

- `find_matching_stars` needs the star id (for example `rohini`) and, if known, its quarter (pada, 1 to 4). The App Context gives both when a result is on screen. If the quarter is unknown, use 1 and say the answer may differ slightly by quarter.
- `role` is whose star it is: `bride` or `groom`. Some factors count from the bride's star, so the order matters. Ask if it isn't clear from the conversation.
- Pass `lang` as the page language so star names come back in that language.

## Presenting the answer

1. Name the three to five best stars, with how many factors agree (`factors_agree`).
2. Say whether the two essential checks (Rajju and Vedha) pass for each (`essential_checks_pass`). A star where an essential check fails should not be presented as a good match, whatever the count.
3. If a star only suits some quarters (`padas`), say so. A star can appear twice when its quarters fall in two signs. Name it once and say which quarters suit, for example "Mrigashira (all four quarters, in two signs)", rather than listing it twice.
4. End with a reminder: this compares birth stars only. A full match needs both people's birth details, on the match page.

## Never

- Never rank or judge real people. Talk about birth stars only.
- Never add stars or scores that the tool did not return.
