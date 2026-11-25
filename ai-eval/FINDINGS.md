# AI evaluation: findings to keep

System as it was on 25 November 2026: model `gpt-6-luna`, effort low. 58 questions (50 chat, 8 written chapters), asked once; 8 important ones asked 5 times. Marked by Claude against ground truth from the calculation engine. Nothing below has been acted on except the bug.

The scripts, questions, answers and full report are in the `ai-eval/` folder of the worktree `site-shell-fixes-770238` (not committed there yet).

## Marks

| Answers | Number | Correct | Audience | Useful |
|---|---|---|---|---|
| All | 58 | 4.50 | 4.19 | 4.09 |
| Short chat answers | 36 | | 4.47 | 4.17 |
| Long chat answers | 14 | | 3.93 | 4.21 |
| Written chapters | 8 | 4.50 | 3.38 | 3.50 |

41 of 58 good on all three. No unsafe answer. Chat: first words 3.2s, complete 4.5s (median). Chapter: complete 6.0s. Times are from a local computer, before the fix below.

## Why audience is lower

1. Long paragraphs: 28 answers break the 40-word rule and average 3.89; the other 30 average 4.47. 11 of 14 long chat answers break it.
2. Little structure in long chat answers: mostly no bold leads, no tables, and icons outside the site's set.
3. Language: Singlish answered in English letters (fully in Sinhala in 1 of 5 tries); some Sinhala awkward or technical.
4. Jargon with no plain words ("debilitated", "8th house").

## Why usefulness is lower

1. Right facts, but not what the person came for: the Sinhala day chapter never says what the day suits; the Avurudu chapter hardly explains customs.
2. Wrong answers: 4 wrong answers are 11 of the 53 points lost. Gajakesari yoga invented (1 of 5), wrong house ruler (2 of 5), Mars in the wrong house (1 of 5), wrong star at 9:00 (1 of 5).
3. Generic or incomplete: the rising sign answer uses nothing from the chart; the erashtaka answer gives no date for what comes next.

## Likely causes in the prompts (not tested yet)

- The example answer in `guide.md` has paragraphs of 67 and 42 words and no bold leads; `explain-match` has examples of 48 and 61 words.
- `guide.md` asks for icons "from the `explain-card` set", but no chat answer opened that skill.
- The Sinhala script rule for Singlish is mainly in `sinhala-style`, which the Singlish answer did not open.
- `site-guide` says every tool is free and a plans page says "coming soon"; the site now has paid reports.

## Bug, fixed but not committed

Answers that needed five model calls ended with "Recursion limit of 25 reached". `agent/app/main.py` now sets 100 steps, with a test in `agent/tests/test_app.py`. Both changes are in the worktree `site-shell-fixes-770238`.

## Agreed order

Test other models with the prompts as they are, then fix the prompts and run again on the best model.

## Visuals in the chat

Not part of the marks: the evaluation read the text and the tool calls. Charts were added to the chat after this run (`docs/24-chat-visuals-plan.md`), so run the baseline again before comparing models, and score the diagram too.

## Correction

One Sinhala answer was marked down partly for saying ශනි "where the site says සෙනසුරු". The site's own labels say ශනි; only the `sinhala-style` skill says සෙනසුරු. The answer followed the page, and the two need to agree.
