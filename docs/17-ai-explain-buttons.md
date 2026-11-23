# AI Explanations: Full Reading and Explain Buttons

Date: 2026-11-18. Updated the same day: cut to the main places only, then added the full detailed reading at the top of the chart and match results, modelled on two competitor samples. Steps 1 to 6 are built, except the paid lock, which waits for payments (docs/15). The readings have not yet been tried against the real model.

**Where the code is:** `agent/app/explain.py` (endpoint, chapter table, prompt), `agent/app/prompts/explain.md`, `agent/skills/explain-card/`, the "Chapters" part of `agent/skills/explain-match/SKILL.md`, `frontend/app/api/explain/route.ts`, `frontend/lib/assistant/explain.ts` (ids, store, text), `frontend/components/assistant/Explain.tsx`, `frontend/lib/entitlements.ts`. The words are under `assistant.explain` in `frontend/messages/*.json`.

Two kinds of AI explanation, both collapsible, both free for now and paid later:

1. **Full detailed reading** at the end of the birth chart and match results (moved down from the top on 2026-11-19: the long card pushed the chart and the match result off the first screen). A long reading in chapters, like the printed premium reports people buy today (section 2).
2. **Explain buttons** on the 15 main places across the site where people get stuck (section 3).

**Small questions stay in the chat.** "What is a karana?", "what does Yoni mean?" are one-line answers. Astro (file 14) handles those.

The rule from file 04 still holds: **the AI talks, the engine calculates.** A chapter is written only when the engine has the facts for it. Where it doesn't, the chapter is left out, not guessed.

## 1. How it looks

### At the end of a result

```
 ┌────────────────────────────────────────────────────┐
 │ ✦ Your full reading                                │
 │ 10 chapters: your nature, planets, the 12 parts    │
 │ of life, life periods with dates, Saturn periods,  │
 │ the year ahead...                                  │
 │                                  [Get full reading]│
 └────────────────────────────────────────────────────┘
 (tap)
 ┌────────────────────────────────────────────────────┐
 │ ✦ Your full reading       [Open all] [Hide all]    │
 │ ▸ 1. Birth summary                                 │
 │ ▾ 2. Your nature                                   │
 │     Your rising sign is Kataka and its ruler, the  │
 │     Moon, sits in the 9th house...                 │
 │     [Ask Astro about this →]                       │
 │ ▸ 3. The nine planets                              │
 │ ▸ ...                                              │
 │ AI reading · for guidance only   [Download PDF]    │
 └────────────────────────────────────────────────────┘
```

- The card starts **closed**: a short list of what's inside and one button.
- After the tap, the **chapters** show as a list. Each chapter opens and hides on its own. "Open all" and "Hide all" at the top.
- **Chapters are written when opened**, the first two straight away. A chapter once written is kept for the visit, so hiding and reopening costs nothing.
- Each chapter has **"Ask Astro about this"**, which opens the chat on that chapter.
- **Download PDF** (later) uses the existing report templates (`backend/app/reports/templates/hadahan.html`, `porondam.html`).
- **Locked state (later):** the card shows the chapter list with a lock, "Available on paid plans".

### On a place in the page

```
 Your match result                    [✦ Explain this]
 (tap)
 Your match result                    [✦ Hide ▴]
 ┌────────────────────────────────────────────────┐
 │ The overall picture ... Where it comes easily  │
 │ ... Where to give attention ...                │
 │ AI explanation · for guidance only             │
 │ [Ask Astro about this →]                       │
 └────────────────────────────────────────────────┘
```

**The two share text.** Several places are the same as a chapter (section 3 says which). The place shows that chapter, so it is written once and appears in both.

## 2. Full detailed reading

### 2.1 What the competitor samples have

Two samples from Porondam.lk, reviewed 2026-11-18:

- **Premium horoscope**, 76 pages: birth details and chart with navamsa, a birth table (thithi, yoga, karana, gana, yoni, nadi, bird, tree...), planet positions, six-fold strength numbers, house strength points (ashtakavarga), 12 divisional charts, a personal reading with lucky numbers, colours and days, special yogas and doshas, gems, rudraksha and mantras, a chapter for each of the 12 houses, warning areas (health, marriage and business, investments and children, travel and legal) each with the risky sub-periods and what to do, every main and sub life period with dates and a short meaning, every Saturn period (erashtaka from the Moon and the rising sign, 8th-house Saturn) with dates and ages, remedies for the current period, and the next 12 months of Sun, Jupiter, Saturn and Rahu movement.
- **Full porondam**, 2 pages: both charts side by side, a table of all 20 factors with each person's value, the result and **what that factor affects in married life**, a percentage, then a page on marriage-related doshas and yogas in each chart (Kuja dosha, Ravi-Sukra, Shani-Mangala, Papa Kartari, Kuja-Sukra, Chandra-Mangala) and whether the two 7th-house rulers are friends, ending with a recommendation.

### 2.2 Birth chart: chapters

Data: ✓ the engine has it today · ◐ a small addition (a look-up table or one engine field) · ✗ not now.

| # | Chapter | What it covers | Data | Skill |
|---|---|---|---|---|
| 1 | **Birth summary** | Rising sign, Moon sign, birth star and quarter, navamsa rising sign, the life period running at birth. The birth table: weekday, thithi, yoga, karana, and the star's gana, yoni, nadi, bird, tree, element | ✓ signs and periods. ◐ thithi, yoga and karana at the birth moment (the nakath engine works per day; add one "at this moment" call). Gana, yoni, nadi, bird, tree, element come from the match rule tables | birth-chart |
| 2 | **Your nature** | Rising sign and its ruler, Moon sign, birth star: temperament, strengths, what to watch | ✓ | personal-reading |
| 3 | **The nine planets** | Each planet: sign, house, own or exalted or weak sign, retrograde, same sign in the navamsa (vargottama) | ✓, vargottama is a look-up (sign equals navamsa sign) | personal-reading |
| 4 | **Special combinations** | The yogas found (Gajakesari, Budhaditya, Chandra-Mangala, the five great-person yogas), Kuja dosha, planets hemmed in by hard planets (papa kartari) | ✓ the current list in `chartFacts.ts`. ◐ more yogas from the sample (Kahala, Parvata and others) go in the same table, after the astrologer review | birth-chart |
| 5 | **The 12 parts of life** | One short part per house: self, wealth and speech, siblings and courage, home and mother, children and studies, health and rivals, marriage and partners, change and hidden matters, fortune and father, work and status, income and friends, spending and abroad. Each with its sign, where its ruler sits and which planets look at it | ✓ (`houseFacts`) | personal-reading |
| 6 | **Work and money** | Career direction from the 10th house and its ruler, income from the 2nd and 11th | ✓ | personal-reading |
| 7 | **Love and marriage** | The 7th house, Venus, the Mars check, the periods that tradition links to marriage | ✓ | personal-reading |
| 8 | **Life periods with dates** | Every main period and its sub-periods with dates and what each tends to bring. The current one in most detail | ✓ three levels from `dasha.py` | personal-reading |
| 9 | **Saturn periods** | Each erashtaka and 8th-house Saturn period with its dates and the age at the start, and what helps | ✓ from the Moon sign (life road). ◐ the same from the rising sign | birth-chart |
| 10 | **Areas to take care of** | Health, partnerships and business, investments, travel and legal matters, each with the sub-periods to be careful in and practical steps. Calm, no named illnesses, no death or lifespan | ✓ | personal-reading |
| 11 | **The next 12 months** | Sun, Jupiter, Saturn and Rahu moving through signs, counted from the Moon sign, with dates | ◐ the engine has it (`transits.py`, year ahead), but the chart page doesn't hold it: the page fetches the month forecast and planet changes separately. Add them to the reading's facts, or give the explain endpoint the year-ahead tool | birth-chart |

**Not included, and why:**

| From the sample | Why not |
|---|---|
| Six-fold strength numbers (shadbala) | Our strength is own, exalted or weak sign only. Full shadbala is a large engine job; maybe later |
| House strength points (ashtakavarga) | Not calculated. A medium engine job; maybe later |
| Divisional charts D2 to D12 | Only the navamsa (D9) is calculated. Others are simple to add if a chapter needs them |
| Lucky numbers, colours, days | Left out on purpose (file 14, "Personal readings") |
| Gems, rudraksha, mantras, yantras, fasting | Left out on purpose. No remedy selling. If someone asks Astro, it describes the tradition as personal belief |
| A percentage for the match | We show the count, never a percentage (file 03) |

### 2.3 Match: chapters

Full birth details for both people. With only the birth stars (quick match), every chapter still shows; a chapter whose facts need full details (the Mars check) says so in a sentence and points to the full match.

Each chapter gets the whole match summary (the same one the chat gets, about 6 KB) and uses only its own part. One summary means one cache key per chapter, so a button and the reading share text.

| # | Chapter | What it covers | Data | Skill |
|---|---|---|---|---|
| 1 | **The two of you** | Each person's birth star and quarter, Moon sign, rising sign, navamsa, and the life period each is in now | ✓ | explain-match |
| 2 | **All the factors** | Every factor with both values, the result, and what it affects in married life (the sample's last column), grouped by theme | ✓ factor results and reasons. The "what it affects" text is in the `explain-match` reference | explain-match |
| 3 | **The serious checks** | Rajju and Vedha, what each means here, and what to do if one doesn't pass | ✓ | explain-match |
| 4 | **The Mars check for both** | Each person's Kuja dosha, the cancelling rules, how the two compare | ✓ | explain-match |
| 5 | **Marriage combinations in each chart** | The 7th house, its ruler, Venus, and the sample's list: Ravi-Sukra, Kuja-Sukra, Chandra-Mangala, Shani-Mangala, papa kartari on the 7th | ◐ a small table of these combinations next to `chartFacts.ts`, after the astrologer review | explain-match |
| 6 | **Your two 7th-house rulers** | Whether the two rulers of marriage are friends, neutral or enemies | ◐ the classical planet friendship table | explain-match |
| 7 | **Emotional styles** | How each Moon sign feels and shows care, and how the two meet | ✓ | explain-match |
| 8 | **Your years ahead** | Both life periods side by side, the shared Saturn periods, the clear and rough stretches | ✓ (`couple.py`, couple road) | explain-match (new part) |
| 9 | **Wedding dates** | Only if the date search was run: how the dates differ | ✓ | ceremonies-and-names |
| 10 | **Summing up** | Strengths, areas to work on, next steps | ✓ | explain-match |

**Different from the sample:** no percentage and no "this marriage is recommended". Chapter 10 sums up strengths and areas to work on and leaves the decision to the couple, their family and an astrologer (the `explain-match` skill already says this).

## 3. Explain buttons: the 15 main places

Each place joins several components that people read together, so one explanation answers the question in their head. "Same as chapter" means the place shows that chapter's text.

### Birth chart (`/hadahan`)

| # | Place | Joins these components | The question it answers | Same as chapter |
|---|---|---|---|---|
| 1 | **My chart** | `SummaryCards`, `Kendara` square, planets table, birth time check | "What does my chart say about me?" | Chart 2 |
| 2 | **Kuja dosha** | Kuja section and its check rows | "Do I have Kuja dosha, and does it matter?" | `chart.mars`, its own chapter |
| 3 | **My life periods** | `DashaTimeline`, `LifeRoad`, `Forecast` | "Where am I in life now and what's coming?" | Chart 8 (current period) |
| 4 | **Life topics** (chips: your nature, work and money, love and marriage, family and home, studies, travel and going abroad) | Below the summary cards and chart | "What does my chart say about my work?" | Chart 2, 6, 7; family, studies and abroad are chapters of their own, shown only by the chips |

### Match (`/porondam`)

| # | Place | Joins these components | The question it answers | Same as chapter |
|---|---|---|---|---|
| 5 | **Our match result** | Score, `MatchGlance`, person cards, factor list, not counted factors | "What does our result mean?" | Match 10 |
| 6 | **The serious checks** | Rajju, Vedha, Kuja comparison | "Is anything serious wrong?" | Match 3 and 4 |
| 7 | **Our years ahead** | `CoupleTimeline`, `CoupleRoad` | "What's ahead for us?" | Match 8 |
| 8 | **Wedding dates** | Wedding dates on the match page and on `WeddingFinder` | "Which date should we pick?" | Match 9 |

### Other pages

| # | Place | Joins these components | The question it answers | Skill |
|---|---|---|---|---|
| 9 | **Today's nakath** | `DailyView`: Rahu kalaya, thithi, nakatha, yoga, karana, sunrise | "What kind of day is today, and what is it good for?" | calendar-and-nakath |
| 10 | **Avurudu timetable** | `AvuruduView`: every nakath, official vs calculated, times abroad | "What do we do, and when?" | avurudu |
| 11 | **Baby name letters** | `BabyLettersApp`, `StarLetters`, extra letters, `NameSuggestions` | "Which letter, and why?" | ceremonies-and-names |
| 12 | **First letters times** | `FirstLettersFinder` result | "Which time for akuru kiyaweema?" | ceremonies-and-names |
| 13 | **This change for me** | `ChangeDetail`, Moon sign notes, `PersonalChange` | "How does this planet change affect me?" | birth-chart, personal-reading |
| 14 | **My year ahead** | `YearView`, `PersonalYearly` | "What does next year look like for me?" | birth-chart, personal-reading |
| 15 | **Possible birth dates** | `KendaraApp` results | "Why several dates, and how do I find the right one?" | old-horoscope (new) |

Shared results and saved reports (`/s/[code]`, `/my/[id]`) get the full reading card and the buttons, written about "this person", not "you".

## 4. Facts sent

Every chapter and button sends three things, never more:

| Field | Example | From |
|---|---|---|
| `id` | `chart.periods` (a chapter) or `match.result` (a place) | One fixed list for both |
| `topic` | `work` | Only for the life topic chips |
| `facts` | The page's context, trimmed to what this chapter needs | The same builders the chat uses (`frontend/lib/assistant/pages.ts`, `chartFacts.ts`) |

Same privacy rule as the chat: **no names, birth dates, birth times or birth places.** Only results. Life period dates are sent (they are results), but not the first period's start, which would give away the birth date (`pages.ts` already leaves it out).

## 5. One set of skills for the reading, the buttons and the chat

```
                    agent/skills/
                    ├── personal-reading/    the chart chapters (already "chapter by chapter")
                    ├── birth-chart/         birth summary, combinations, Saturn, transits
                    ├── explain-match/       the match chapters
                    ├── calendar-and-nakath/, avurudu/, ceremonies-and-names/
                    ├── old-horoscope/       NEW
                    ├── sinhala-style/
                    └── explain-card/        NEW: shape of a chapter or an inline explanation
                         ▲                          ▲
                         │                          │
     Astro chat (POST /agent)        Reading and buttons (POST /agent/explain)
     guide.md + any skill            explain.md + the skill for this id + explain-card
```

**Agent service:**

1. **`POST /agent/explain`**, next to `/agent` and `/agent/suggest` in `agent/app/main.py`. One model call per chapter or place, no chat history, no subagents. Chapters run in parallel.
2. **`agent/app/prompts/explain.md`**, sharing the safety and plain-words rules with `guide.md` through one shared file, so they can't drift.
3. **`agent/app/explain_ids.py`**: each id with its skill and its part of that skill. The skill text goes straight into the prompt (faster and cheaper than the chat reading it).
4. **`explain-card` skill**: the shape of the text. A chapter: a heading, then short parts, 150 to 400 words. A place: two to four short headed parts. No greeting, no "want me to…?" at the end.
5. **Each topic skill gets a "Chapters" part** listing its chapter ids and what each must cover, taken from section 2. `personal-reading` already reads a chart chapter by chapter, so most of this is naming what is there. The chat reads the same part when someone asks for "my full reading".
6. **Skill gaps:** `old-horoscope` (place 15). The couple part of `explain-match` (match chapter 8). Marriage combinations and the friendship table in the `explain-match` reference (match 5 and 6).

**Engine and look-up tables (the ◐ rows):**

| Addition | Where | For |
|---|---|---|
| Thithi, yoga, karana at the birth moment | `backend/app/engine/panchanga.py`, returned with the chart | Chart 1 |
| Star profile (gana, yoni, nadi, bird, tree, element) | From the match rule tables, returned with the chart | Chart 1 |
| Vargottama, papa kartari | `chartFacts.ts` | Chart 3 and 4, match 5 |
| More yogas, marriage combinations | `chartFacts.ts`, after the astrologer review | Chart 4, match 5 |
| Planet friendship table | `chartFacts.ts` | Match 6 |
| Erashtaka from the rising sign | `journey.py` | Chart 9 |

**Website:**

1. **`AiExplain`** (one place) and **`FullReading`** (the chapter card), in `frontend/components/assistant/`. Both share the streaming, the label, errors, "Ask Astro about this" and the locked state.
2. **One registry, `frontend/lib/assistant/explain.ts`**: every chapter and place id, its title in both languages, and which builder trims its facts.
3. Requests go through the route next to `app/api/copilotkit/route.ts`, so the staging password and access key already cover them.
4. **Kept for the visit:** each text is kept in the tab (session storage, keyed by id, topic, language and a hash of the facts).

## 6. Ready for paid later

- **One switch:** `canUse("ai_reading")` and `canUse("ai_explain")` in a new `frontend/lib/entitlements.ts`. Both `true` for everyone now.
- **The agent checks too**, through `backend/app/tiers/`, the one place for "who gets what" (it already decides saving).
- **Free once paid** (owner decides): the full reading's chapter list and the first chapter as a taste, plus places 6 and 9.
- **Paid reports are saved:** a bought full reading is kept in "My reports" (file 16), so it isn't written again.
- **Cost:** a full chart reading is about 11 model calls. Each chapter is cached by its facts hash, so reopening or downloading the PDF costs nothing. Places 9 and 10 are the same for everyone in a city on a day, so they are cached on the agent side.

## 6a. The PDF reports (built 2026-11-22, changed 2026-11-23)

**Free PDF:** a short report of what the free page shows: the chart, the planets, the life periods, the navamsa and the Kuja dosha result (for a match: the two people, the factors and the checks). No cover, no AI text, and none of the Kuja dosha conditions the page locks (`full_detail`).

**Paid PDF** (`full_pdf`, and everyone while paid reports are off, docs/18): the cover, a contents page, the sky wheel, the 12 houses, every condition that applies, and the whole AI reading, whether or not the person opened it on the page.

- **Every chapter is written first.** Download PDF writes each chapter not written yet (four at a time, a failed one asked for once more), with "Writing your full reading: 5 of 15…" on the button. Chart: the 12 reading chapters and the 3 topic-only ones. Match: the reading's chapters, with the years ahead and wedding dates when the page has them. A paid PDF with a chapter missing is not handed over: trying again writes only the missing ones.
- **The AI notice comes first.** If it has not been accepted, it shows under the button and nothing goes to the AI until it is.
- **Written once, kept with the report.** The first text of each chapter is the one a paid report keeps, per order and language (`sidera.report_chapters`, `backend/app/store/chapters.py`). The AI route (`frontend/app/api/explain`) looks there before asking the AI and keeps a chapter once it is complete (`frontend/lib/keptChapters.ts`). So the words never change, on any device of the account, and the PDF prints the kept words whatever the browser sends. Only the website's server can keep a chapter (`CHAT_KEY`, the key shared for the chat limits): **without `CHAT_KEY` in Vercel and `ASTRONOMIA_CHAT_KEY` in Render nothing is kept on the server.** The chapters go when the account is deleted.
- **On the device too**, for 30 days (`KEEP_DAYS` in `frontend/lib/assistant/explain.ts`), so a page reload asks nothing. A report that isn't paid shows none of them.
- **The chat knows.** The written chapters go to Astro under `also_on_page.reading`: each one's title, short answer and part headings (`frontend/components/assistant/useReading.ts`). `guide.md` tells Astro to stay in step with them and point to the chapter.
- **The design** (`backend/app/reports/`): diagrams drawn from the person's own results (`visuals.py`), then one chapter a page, each with its picture, its short answer, its diagram and its parts tinted like the page. Artwork is in `backend/app/reports/art/`. Images still to be made: `docs/22-report-images.md`.
- **The same diagrams on the website**, under each reading chapter (`components/assistant/ChapterDiagram.tsx`). Which chapter shows which is one table on each side, kept in step: `CHAPTER_VISUAL` in `frontend/lib/assistant/visuals.ts` and in `backend/app/reports/render.py`.

**Database:** `supabase/migrations/20261123030734_report_chapters.sql`, applied to staging on 2026-11-23. Apply it to production before deploying the backend there: the PDF and account deletion need its table. The privacy notice must say that a paid report's AI chapters are stored, and that the device keeps AI text for 30 days (owner: later).

## 7. Build steps

Each step is one pull request, like file 14.

| Step | What | Done when |
|---|---|---|
| 1 | `/agent/explain`, `explain.md`, `explain-card`, `AiExplain`, `FullReading`, registry, `canUse`. Match full reading chapters 1 to 4, 7 and 10. Places 5 and 6 | Built 2026-11-18, not yet tried against the real model. Checked in the browser with a stand-in agent: chapters open and hide, write once per visit (a button reuses the chapter), a failed chapter offers "Try again", fits a phone |
| 2 | Chart full reading chapters 2, 3, 5 to 8 and 10, plus the Mars check as its own chapter (8 chapters). Places 1 to 4, with three chip-only chapters (family, studies, abroad) | Built 2026-11-18, not yet tried against the real model. Checked in the browser with a stand-in agent: the chip and the button for "Your nature" reuse the reading's chapter (5 AI calls for 5 different chapters), fits a phone. Chapter 11 moved to step 3: its facts aren't on the page |
| 3 | The ◐ additions and the chapters they unlock. Chart: Birth summary (the birth table: weekday, thithi, yoga, karana and the star's groups, now returned by `/v1/hadahan`), Special combinations (adds Sunapha, Anapha, Durudhara, Ravi-Sukra, Kuja-Sukra, Shani-Mangala, Papa and Shubha Kartari), Saturn periods (erashtaka and Jupiter's returns from the life road) and The planet changes ahead (from the coming changes): 12 chapters in all. Match: Marriage combinations in each chart (`/v1/porondam` now returns each person's planet signs and houses with full details) and Your two 7th-house rulers (planet friendship table): 8 chapters | Built 2026-11-18, not yet tried against the real model. Checked in the browser against the real backend with a stand-in agent: 12 chart chapters, 12 AI calls, and only the Saturn and planet-change chapters carry the extra facts. **Done later (2026-11-18, leftovers):** erashtaka counted from the rising sign (`erashtaka_lagna` on `/v1/journey`), and the Sun's sign for each month ahead (`sun_months` on `/v1/changes/personal`), both in the reading's facts. **Needs the astrologer review:** the new combinations, the friendship table and the 7th-ruler reading (all marked provisional). **Note:** the birth table's weekday is the Sinhala day (from sunrise), while the match's weekday factor uses the calendar date, so the two differ for a birth before sunrise. The birth table now also gives the calendar weekday when they differ (`calendar_weekday`), and the Birth summary chapter explains it. Whether the match should count by the Sinhala day instead is for the astrologer review: it would change match results |
| 4 | Match chapters 8 (Your years ahead) and 9 (Wedding dates), and places 7 (in the couple timeline) and 8 (under the dates found) | Built 2026-11-18, not yet tried against the real model. The years ahead come from the couple timeline the page already loads (the request is now shared), only on the couple's own match. The wedding chapter joins the reading once a search has found dates; its facts are the top 5 dates per ceremony with 3 reasons each, so a Sinhala search stays well inside the agent's 40 KB. A life period that began before the ten-year window has no start date, since it could be the birth date. Checked in the browser against the real backend with a stand-in agent: 10 chapters, 10 AI calls, both buttons reuse the reading's chapters |
| 5 | Places 9 to 14: one explain button each on the day's nakath, the Avurudu times, the baby name letters, the first letters times, a planet change for your own chart, and your own year ahead | Built 2026-11-18, not yet tried against the real model. Each button reads the summary the page already gives the chat, so no new facts are sent. Chapter guidance in calendar-and-nakath, avurudu, ceremonies-and-names and birth-chart. Checked in the browser against the real backend with a stand-in agent on the day's nakath and Avurudu pages; the four pages that need a birth form were checked by types and tests only |
| 6 | `old-horoscope` skill and place 15 (Possible birth dates, on the old horoscope results; never a date or time). The full reading in the PDF: the report request takes the chapters already written in this visit (`reading`, at most 16 chapters of 8,000 characters) and prints them in their own section, "AI reading", after the engine's results, escaped as text (`backend/app/reports/reading.py`). The reading card says "Chapters you open are added to the PDF report" | Built 2026-11-18. Checked against the real backend with a stand-in agent: the match PDF request carried the 9 chapters written in the visit and the PDF was made; the backend tests read the section back out of the PDF. **Not done: the paid lock.** Payments (docs/15) are not built yet, so there is nothing to check against: `canUse()` still allows everyone, and the agent has no check. Wire both when payments land |

## 7a. Browser tests with the AI on

Whether the AI is on is decided when the pages are built (`AGENT_URL`, read by the layout), so the
browser tests for it run against a second build, in `.next-ai` (`NEXT_DIST_DIR`), started by
`frontend/scripts/e2e-ai-server.mjs` with an agent address that points nowhere. The tests in
`frontend/tests/e2e/ai.spec.ts` answer `/api/explain` themselves. They cover the full match
reading, an explain button reusing the reading's chapters, hiding and reopening without a new
request, and "Try again" after a failure. The other browser tests keep running with the AI off,
and the quick match test checks that no reading or button shows then. CI builds `.next-ai` in
its own step; a local run builds it the first time.

## 7b. Checked against the real model (2026-11-19)

The readings were run on the real agent (`gpt-6-luna`) for a sample chart in English and Sinhala and a full match in English. The facts were right throughout and the tone stayed within the care rules. What it found, and what changed:

| Found | Fix |
|---|---|
| The match factors chapter miscounted its themes: the skill's four themes differed from the page's ring | The facts now carry `factor_themes` with the page's own counts; the reference's themes match the page |
| A Saturn period cut at the life road's end was mentioned, which reads like a lifespan | Such periods are left out of the facts; the skill never mentions the road's end |
| The care chapter flagged a health period in one language and not the other | The facts now carry `care_periods` (the running or next sub-period whose planet rules or sits in the 8th house), so both languages say the same |
| Yoga names in English letters and ISO dates in Sinhala text | `sinhala-style` lists the Sinhala yoga names and the date format |
| The birth summary said thithi, yoga and karana have no meaning | The birth chart reference explains every item of the birth table |
| "The 12 parts of life" ran to about 600 words | One sentence of at most 30 words per house |
| Most chapters ended with "provisional, see an astrologer" | Only the checks, the Mars check and the summing up (match) and love, the Mars check and care (chart) carry it, once |
| The match's Mars chapter was thin | The facts carry each person's Mars reasons and cancelling rules |

Speed: a full chart reading takes 20 to 30 seconds with the chapters written in parallel; one chapter about 7 seconds. Size: each chapter sends its topic's notes, about 7,000 to 17,000 tokens (the personal-reading notes are the largest), so a full chart reading is roughly 200,000 tokens in and 6,000 out. Sending only the part of the notes a chapter needs is the main saving left, worth doing before pricing.

## 8. Decisions needed from the owner

| # | Decision |
|---|---|
| 1 | Button text: "Get full reading" and "Explain this", or other words |
| 2 | Free once paid: the first chapter as a taste? Places 6 and 9? |
| 3 | Price of the full reading against file 15 (one-off per chart, or part of a plan) |
| 4 | Whether shadbala, ashtakavarga or more divisional charts are worth an engine step |
| 5 | An astrologer to review the new yogas, marriage combinations and friendship table before chapters 4, 5 and 6 go live |
