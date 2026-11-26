# Model comparison, 25 November 2026

Three runs of the same 58 questions: the system as it was (`current`), after the fixes (`fixed`), and Claude Haiku 5.5 from OpenRouter on the fixed system (`haiku-5.5`). Plus 15 Sinhala questions on both models. Every answer was read and marked by Claude (`../RUBRIC.md`).

| | gpt-6-luna, before | gpt-6-luna, fixed | Haiku 5.5, fixed |
|---|---|---|---|
| Correctness (0 to 5) | 4.5 | **4.81** | 3.93 |
| Suits the audience | 4.19 | **4.33** | 3.03 |
| Usefulness | 4.09 | **4.52** | 3.84 |
| Good on all three and safe | 41 of 58 | **52 of 58** | 21 of 58 |
| Unsafe answers | 0 | 0 | 1 |
| Runs that ended with an error | 2 | 0 | 0 |
| Sinhala fluency, in the 58 (10 answers) | not marked | **3.8** | 2.3 |
| Sinhala fluency, Sinhala set (15 answers) | not marked | **4.0** | 2.27 |
| Sinhala set: correctness | not marked | **4.87** | 3.13 |
| Chat complete, median | 4.5s | 5.3s | **3.9s** |
| Chat, 90% within | 6.7s | 10.3s | 9.3s |
| Cost per chat answer | $0.0014 | $0.0015 | $0.0024 |

**Decision (25 November 2026): keep gpt-6-luna.** Haiku is a little quicker, but it gets more facts wrong and its Sinhala is much weaker.

## Haiku 5.5

- **Wrong facts, mostly in Sinhala.** Wrong life periods in both Sinhala chart questions of the 58, an invented poruwa ceremony, and "12 of 15 factors agree" copied from the skill's example (the result was 11 of 16). One whole chapter was the wrong chapter.
- **Talks about its own workings.** 23 of 50 chat answers open with lines such as "I'll read the personal-reading skill first" or "The App Context shows". Some Sinhala answers start with a paragraph of thinking in English. The guide forbids this.
- **One unsafe answer.** Asked "When will I die?", it said the chart "shows a period that calls for extra care with your body and safety". No such period is listed.
- **What it does better.** Quicker, often names the next periods with dates, the best poruwa answer in English, the only one to name the later window for going abroad. Every "do I have X yoga?" was right on both charts tried.

## Sinhala fluency

| | gpt-6-luna | Haiku 5.5 |
|---|---|---|
| Fluency, Sinhala set | 4.0 | 2.27 |
| English words per 100 Sinhala words | 0 | 17.7 |
| Sentences over 20 words | 22 of 163 | 11 of 250 |
| Answers with letters of another script | 2 of 15 | 0 of 15 |

- **gpt-6-luna** reads naturally, best in short and everyday answers (Avurudu, poruwa, a worried person). Weaker in chapters, where some phrases sound translated ("ප්‍රදේශය" for a part of the chart). **Its one real fault: a word sometimes breaks into Russian letters** ("කෙළින් ярьж", "ඉලээм"): 2 of 61 saved Sinhala answers, and two more seen in a run that was replaced.
- **Haiku** mixes English into almost every answer, mixes spoken and written forms, and some sentences make no sense.
- In the Sinhala set, Singlish was answered in Sinhala script by gpt-6-luna when the question was about a chart. The match question is still answered in English letters (left as it was, as asked).

A native reader should check some of these. The marks are Claude's.

## What the fixes changed (gpt-6-luna)

Checked on questions not used for the fixes, 3 runs each (`holdout/`): facts found rose from 80% to 92%. That set was looked at while fixing, so a second unseen set with a third made-up person was added (`holdout2/`, after the fixes only). Its yoga answers were right 12 of 12 times, and no wrong house or ruler was found in the answers read.

| Fixed | Not fixed, or only partly |
|---|---|
| Invented yoga: right 5 of 5 (was 4 of 5) | Off-topic code question: back to the site in 2 of 5 |
| House rulers (going abroad): right 5 of 5 (was 3 of 5) | Comparing days: still calls one day better at times, and 2 of 5 openings contradict their own table |
| Erashtaka: both counts and what comes next | Later windows for going abroad |
| Rahu kalaya already passed, right date abroad | "Am I in a Saturn period?" read as a life period |
| Day chapter says what the day suits | Saturn chapter's opening mixes up which count is the main one |
| Avurudu chapter says what families do | A technical word on its own, now and then |

## Found on the way

1. **Helpers' text leaks into the chat.** When the guide starts helpers (`date-checker`), their own writing streams into the chat mixed together until the answer ends. Shown with a stand-in model, so it can happen with any model. **Fixed after these runs** in `agent/app/main.py` (`subagent_visibility="hidden"`), with a test.
2. **The project disagrees with itself on planet names.** The site's labels say ශනි and ශුක්‍ර (`backend/app/data/labels/si.yaml`); the `sinhala-style` skill says සෙනසුරු and සිකුරු. Both were accepted here. **Decided after these runs:** Astro writes සෙනසුරු and සිකුරු. The site's pages, PDFs and labels were then changed to the same names.
3. **The prices in `agent/app/config.py` are higher than OpenRouter's list** for gpt-6-luna ($0.25 / $0.025 / $2.00 there, $0.10 / $0.01 / $0.50 listed). The costs here use the list. Chat limits use the settings.
4. **Star and lunar day meanings** were added to the almanac notes from Indian sources, marked unverified for Sri Lanka. An astrologer should check them.

## Read these numbers with care

- Haiku ran with thinking off, through chat completions on OpenRouter. gpt-6-luna ran as in production (low effort, which used almost no thinking). Haiku may do better with thinking on; that was not tried.
- Costs leave out Anthropic's extra charge for writing to the cache.
- Times are from this computer. OpenAI answered more slowly in the later runs, so the fixed system's times look worse than the fixes alone would make them.
- One reviewer, who knew which model was which. Most questions were asked once; the important ones five times.

## Files

Every run is kept in [`history/`](history/index.md), never written over, with the model, date, questions and a fingerprint of the prompts. A few early repeat runs were replaced before this was added. Side by side tables: the `compare-*.md` files. Each run's marks and answers: `summary.md` and `review.md` in its folder.
