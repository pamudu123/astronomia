# How Astro answers today (25 November 2026)

Model `gpt-6-luna`, effort low: the system's own settings, with nothing changed. 58 questions, each asked once; 8 of the more important ones were asked 4 more times. Every answer was read and marked by Claude against the ground truth (`RUBRIC.md`). All marks with notes: [`summary.md`](summary.md). All answers: [`review.md`](review.md).

## Result

| | |
|---|---|
| Correctness | **4.5 of 5** (39 of 58 fully right, 4 wrong in a way that matters) |
| Suits the audience | **4.19 of 5** |
| Usefulness | **4.09 of 5** |
| Good on all three | 41 of 58 |
| Unsafe answers | 0 |
| Chat: first words / complete | 3.2s / 4.5s median; slowest complete 9.9s |
| Written chapter: first words / complete | 2.3s / 6.0s median; slowest 9.9s |
| Follow-up buttons | 1.4s median; the site's filter kept 20 of 20 |
| Runs that ended with an error | 2 of 58 |
| Cost, at the prices in the agent's settings | about $0.0037 a chat answer, $0.0051 a chapter |

| Best | Weakest |
|---|---|
| Safety (death, self-harm, investment, "must we break up"), Avurudu, match questions, today's times | Birth chart facts, written chapters, Singlish, long answers |

## Problems found

**1. A bug, not the model: long lookups end with an error.** London and Los Angeles Rahu kalaya ended with "Recursion limit of 25 reached" (4 of 5 and 5 of 5 tries). The answer text had already been sent, but the run then fails, with that technical message. `agent/app/main.py` gives `LangGraphAGUIAgent` no config, so the limit of 25 steps replaces the much higher one Deep Agents sets. An answer that takes 5 model calls reaches it; a longer one could end with no text at all. Another model that makes more calls would fail more often, so this should be fixed before comparing models. What the chat panel shows the person then was not checked in a browser. **Fixed after this run:** `agent/app/main.py` now allows 100 steps, with a test. Asked again 3 times each on the real model, both questions finished with no error. The numbers in this report are from before the fix.

**2. Invented chart facts, now and then.** The answers sound as sure as the right ones.

| Question | What it said | How often |
|---|---|---|
| Do I have Gajakesari yoga? | "Yes", with a made-up reason; the chart does not have it | 1 of 5 |
| Chance to go abroad? | Venus rules the long-journey area (or the 12th house); Jupiter does | 2 of 5 |
| Areas to take care of (chapter) | Mars in the 6th house; it is in the 4th | 1 of 5 |
| Best of 7, 8, 9 December at 9:00 | The star at 9:00 is Mula; it is Jyeshtha until 21:01 | 1 of 5 |

In all 5 tries the last question also picked 9 December as the best day, although the site's rule is not to rate days.

**3. Singlish questions are mostly answered in English letters.** The rule is Sinhala script. One of 5 tries was fully in Sinhala, one mixed, three in English letters. One try explained Kantha (neck) as "kakula" (leg).

**4. Long paragraphs.** 28 of 58 answers have a paragraph over the 40-word limit (up to 79). On a phone this is the clearest audience problem. Tables, and the site's own icons, are often not used in long answers.

**5. Two chapters miss their purpose.** "What kind of day it is" (Sinhala) never says what the day suits; the Avurudu timetable hardly says what families do or why. Their facts are right.

**6. Leaves things out.** Saturn going back on 20 October 2027, the second letter for Rohini quarter 2, the end date of the present erashtaka stretch, the Mars check in the Sinhala match answer, the name Unduvap in Sinhala.

**7. Text to check in the project, not the model.** `site-guide` says every tool is free and a plans page says "coming soon", so Astro repeats it. The site now has paid reports. Also, the button "What is the next auspicious time today?" offers something the site cannot answer.

## Where the time goes

Time to the first words follows the number of model calls: 1 call 0.9s, 2 calls 2.2s, 3 calls 3.6s, 4 calls 4.5s, 5 calls 6.0s. A chat answer takes 2.9 calls and about 40,000 input tokens on average, mostly opening skill files (1.7 a question). Engine lookups are quick. So a faster model helps, and so would fewer skill reads.

## Read these numbers with care

- Times are from this computer with a local backend, after one warm-up call. Render's free plan waking up and the website's route are not included.
- The cost uses the prices in the agent's settings. They were not checked against OpenAI's present prices.
- One reviewer (Claude) marked everything, and knew which model it was. Sinhala was judged by Claude too; a native reader should look at a few.
- Most questions were asked once. Problems in section 2 come and go, so for a comparison ask the chart questions several times for each model.
