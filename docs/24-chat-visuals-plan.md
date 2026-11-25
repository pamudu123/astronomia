# Charts in the chat (as built)

Date: 2026-11-25. Carries out the part of `docs/14-ai-assistant-plan.md`, section 5 ("Visuals in the chat"), that is about results already on the page.

When Astro answers about a chart or a match on screen, one diagram from that result appears with the answer. The diagrams are the ones the written chapters use.

## 1. How it works

```
Page:     tells the chat which diagrams its result can draw, under a random id
Astro:    show_visual(visual="houses", houses=[10, 11])
Agent:    checks the page offers it, answers {"shown": "houses", "page": "a1b2c3d4", "houses": [10, 11]}
Browser:  draws the houses from the result with that id
```

- **No new facts go to the AI.** The call carries a name, house numbers and an id. The result stays in the browser.
- **Nothing is calculated.** The diagrams lay out what the engine returned.

| Part | Where |
|---|---|
| The tool, and its checks | `agent/app/tools/visuals.py` |
| When to show one | `agent/app/prompts/guide.md`, "Showing a diagram" |
| At most one in an answer | `agent/app/graph.py` |
| What a result can draw, reading the call | `frontend/lib/assistant/pageVisuals.ts` |
| Pages hand over their result | `useAssistantVisuals` in `PageContext.tsx`, used by `HadahanResult` and `PorondamResult` |
| Keeping results by id | `Assistant.tsx` |
| Drawing in the chat | `VisualCard.tsx`, from `ToolCards.tsx`; `ChapterDiagram.tsx` draws |

## 2. The owner's decisions

| Decision | How it is met |
|---|---|
| Only questions the person asks count | The diagram is an agent tool, so a question stays one run. A CopilotKit frontend tool would start a second run, and the website counts every run of the guide. The follow-up buttons are not counted either (section 4) |
| An answer is right when it is given, and never changes after | Each result gets an id when its page opens; the answer draws the result with the id its question was sent with, even when the person changes page while it is written. The result, its words and the "today" mark are kept as they were for as long as the chat is open (the last 60 results) |
| Diagrams fit the panel and draw properly | They measure the space they are in, not the window. In the narrow panel the houses, checks, ring and periods bar are smaller; the written chapters keep their sizes |
| Nothing is hidden, paid or not | Every diagram a result can draw is offered. The Mars diagram in the chat names the conditions that apply, which the page keeps for paid reports (`full_detail`) |

## 3. Which diagram

| The question is about | Diagram |
|---|---|
| The chart as a whole, their nature | `pillars` |
| One part of life | `houses`, with one to three lit |
| The life period now, what is coming | `periods` |
| The planets, special combinations | `wheel` |
| The Mars check on a chart | `mars` |
| The match as a whole, the factors | `ring` |
| Rajju, Vedha, a couple's Mars check | `checks` |
| The two people | `people` |

None for a one-line fact, a safety or limits answer, a word's meaning, or the same diagram twice in a row.

## 4. Fixed on the way

- **The 25 step limit.** The same fix as in the evaluation work (`agent/app/main.py`, 100 steps), needed here because a diagram is one more tool call.
- **Follow-up buttons with chat limits on.** The installed CopilotKit asks for them as a run of the suggester, and the chat route only knew `agent/suggest`, so it did not pass the question's id on and the agent refuses a run without one. The route now knows both (`app/api/copilotkit/route.ts`). Still not counted as a question. Seen in a test of the route; not yet checked on staging.

- **New chat, and the 30 minute reset.** The panel has a "New chat" button (`NewChat.tsx`). Adding it showed that the idle reset cleared nothing: `startNewThread` changed an inner copy of the conversation's id that the chat never read, so old messages stayed and were sent again after 30 minutes, against the privacy notice. `Chat.tsx` now owns the id above the chat; both are covered in `tests/e2e/ai.spec.ts`.

## 5. Known gaps

- **A long conversation stops with "too large" (not caused by this).** The chat sends back every skill file the agent read, in the messages and again in the state. In a live run the seventh chart question was 507 KB, over the site's 500 KB limit, and got no answer. The diagrams add under 1 KB.
- **The model chooses.** In live runs it chose well; in one Sinhala run it left out the periods bar, and for a match whose Rajju fails it shows the ring or the checks. Run the evaluation again with the expected diagram for each case.
- **Two languages.** A diagram is in the page's language when the answer is in the other one, as the cards are.
- **Planet names in Sinhala.** The page's labels say ශනි and ශුක්‍ර; the `sinhala-style` skill says සෙනසුරු and සිකුරු, so a diagram and its answer can differ. Decide on one.
- Planet changes, the year ahead and New Year have no diagram: they could get a dates list from their tool results.

## 6. Checks

- Agent: `tests/test_visuals.py`. Refuses what the page doesn't offer, unknown names and houses; at most one; follows the page of each question; returns no chart data.
- Website: `tests/unit/page-visuals.test.ts`; `tests/e2e/ai.spec.ts` (a match's ring, one run a question, the old diagram kept when another match is opened, fits the panel).
- By hand with the real model: chart and match, English and Sinhala, panel at 340, 400 and 760 pixels, a phone, both themes.
