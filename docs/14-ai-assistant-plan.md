# AI Assistant Plan

Date: 2026-11-14. Updated 2026-11-15.

This is the plan for the AI chat assistant on the website. It builds on file 04 (AI research and guardrails) and replaces step 16 of file 08 ("AI explanations"). It is a plan only. No code has been written yet.

The tools are chosen: **Deep Agents** (LangChain) for the agent, **CopilotKit** for the chat on the website, and **AG-UI** as the protocol between them.

The OpenAI Agents SDK was also considered (2026-11-15). Deep Agents was kept because it has subagents, skills, memory, background jobs and dynamic subagents built in, and because it's CopilotKit's main documented path. Deep Agents works with any provider, so OpenAI models are still an option if they win the Sinhala test.

The rule from file 04 still holds: **the AI talks, the engine calculates.** The assistant never works out a chart, a match score or a good time by itself. It asks the engine we already have and explains the result.

## 1. How we work on this

- **Step by step.** Each step is one pull request. It goes to staging, we try it, then we pick the next step.
- **Plan only the next few steps in detail.** Later steps are a rough list, not a design.
- **Questions decide what we build.** Section 10 is a list of questions people ask. When we find a new question worth answering, we add a row, decide what it needs, and that becomes a step.
- **Deep Agents features are a toolbox, used when needed.** We add a feature to the build only when a question on the list needs it. When the assistant runs, it reaches for a subagent, a background job or a question to the person only when the request calls for it. A simple question gets a simple, fast answer.

## 2. What makes this assistant different

It answers about **this person** and **what they are looking at**:

1. It knows which page they are on and what result is on screen (section 3).
2. It knows the details they already entered, so it doesn't ask again (section 4).
3. It answers with visuals from the site, not walls of text (section 5).
4. It uses plain words (section 6).

Example. Someone has a match result open where the Rajju check didn't pass. They open the chat and see:

> I can see your match result. 14 of 20 checks passed. The one people usually ask about is the Rajju check. Want me to explain it?
>
> [Explain the Rajju check] [Which checks didn't pass?] [Is this a good match overall?]

The greeting and the buttons come from the real result, not a fixed list.

## 3. Knowing where the person is

### 3.1 What the chat knows

| Item | Example | Why |
|---|---|---|
| Page | "Match result", "Good times for a wedding" | So "explain this" works without saying what "this" is |
| Language | Sinhala | Answers in the same language as the page |
| What's on screen | Match: score, which checks passed and failed. Chart: rising sign, birth star, current life period | So answers are about their result, not results in general |
| The part they're looking at | The Rajju card they tapped, or the section scrolled into view | So "what does this one mean?" points at the right thing |
| Recent pages on this visit | Birth chart, then Match | So the assistant can connect them ("you looked at your chart earlier...") |
| People entered | "Me" and "Partner" from the forms | Section 4 |

### 3.2 What each page shares

| Page | Shares | Typical question |
|---|---|---|
| Birth chart (`/hadahan`) | Rising sign, birth star, planets summary, current and next life period | "What does my chart say about my work?" |
| Match (`/porondam`) | Score, each check passed or failed, Rajju, Vedha, Mars check result | "Which checks didn't pass, and does it matter?" |
| Star match (`/porondam/stars`) | The two birth stars, quick result | "Is this enough, or do we need full charts?" |
| Good times (`/nakath`) | Date, place, the good and bad times shown | "Is 10:30 good for signing a lease?" |
| Wedding dates | Search inputs and dates found | "Which of these dates is best for us?" |
| Baby names, first letters | Birth star, letters, names shown | "Which letter is best?" |
| Old horoscope (`/kendara`) | What was typed from the paper chart, matches found | "Why are there three possible dates?" |
| Year ahead, changes, forecast | Year, sign, the changes shown | "How does this change affect me?" |
| Shared result (`/s/[code]`) | That it's someone else's shared result, and its summary | "What does this match mean?" (answers about "this person", not "you") |
| Home, plans, other pages | Page name only | "What can this site do?" |

### 3.3 How it works

- Each page publishes what's on screen with one shared helper, for example `useAssistantContext(page, data)`. The helper wraps CopilotKit's context hook (`useAgentContext` in v2; check the name at build time).
- The context updates when the result changes. The agent gets it with every message, clearly marked as data, not instructions.
- Only a short summary goes, not the whole page. Large results stay in the browser until the agent needs them.

### 3.4 Point and ask

A small "ask" icon on cards: each match check, each life period, each good time, each name letter. Tapping it opens the chat with that item selected. The question can be short ("what does this mean?") because the chat already knows what "this" is.

### 3.5 Answers that point back at the page

The agent can act on the page with frontend tools:

| Tool | What it does | Example |
|---|---|---|
| `highlight_on_page` | Scrolls to an item and highlights it | "The Rajju check is here" and the card glows |
| `open_page` | Opens another page of the site | "See your full chart" opens `/hadahan` with the details filled in |
| `fill_form` | Fills a form with details from the chat | "Check our match" fills both people on `/porondam` |

### 3.6 Limits

- Only our own site. The assistant never sees other tabs or browsing history.
- Recent pages are page types ("Match result"), not full addresses.
- Page context is never written to logs.

## 4. Keeping what the person entered

**Today:** each page keeps its last result and form draft for that browser tab only (`saveSession` in `frontend/lib/hadahan.ts`). The old horoscope page hands details to the forms (`frontend/lib/kendara.ts`). Nothing leaves the browser. Details entered on one page don't reach the others.

**The plan:** one shared **people list** for the visit.

- People: "Me", "Partner", "Child" and anyone else the person adds.
- Filled from any form (birth chart, match, wedding, baby names) or from the chat.
- Used by every form and by the chat. Details entered once on the birth chart page fill the match form, and the chat knows them too.
- Chat and forms work both ways. Details given in the chat show up in the form. Details typed in a form are available in the chat.

**Where it's kept:**

| Who | Where | How long |
|---|---|---|
| Visitor (default) | This browser tab, as today | Until the tab closes |
| Visitor who ticks "Remember on this device" | This device only | Until they press "Forget" or clear the browser |
| Signed in, with consent (later, after file 08 step 17) | Our database, as personal memory | Until deleted from the account page |

**Rules:**

- Never ask for a detail that's already on the list. Confirm instead: "Use Nimal's details from before?"
- If someone changes a person's details, the chat is told, and older answers are marked as based on the old details.
- Send the agent only the people a question needs. Names can be replaced with "Person 1" if the person prefers.

## 5. Visuals in the chat

**Show, then tell.** Every result appears as a card. The text explains the card in two to four sentences.

| Card | When it appears | Built from |
|---|---|---|
| Person chip | Whenever a saved person is used | New, small |
| Birth details form | When details are missing | `BirthForm`, `PlaceSearch` |
| Choice buttons | Short answers ("Exact time" / "Roughly" / "Don't know") | New |
| Chart summary | Questions about a person's chart | `SummaryCards` |
| Chart wheel | "Show me my chart" | `ZodiacWheel`, `Kendara` |
| Life periods timeline | "When does my period change?" | `DashaTimeline` |
| Match result | Match questions | `FactorVisual`, parts of `PorondamResult` |
| Mars check | Mars check questions | `KujaDials` |
| Couple timeline | "What's ahead for us?" | `CoupleTimeline` |
| Good times list | Nakath and wedding questions | Nakath and wedding components |
| Baby letters and names | Naming questions | `PadaCards`, `NameSuggestions` |
| Proposal comparison | Several matches side by side | New table |
| "Based on" facts | Under answers that use chart facts | New, small |
| Action buttons | Open the full page, download PDF, share | New, small |
| Confirm card | Before saving, sharing or using a paid credit | New |
| Job progress | Long background jobs (later) | New |

**Rules for cards:**

- Use the site's own components, so a result looks the same in the chat as on its page.
- The chat is narrow (about 380 pixels). Some components need a compact version. Check each one when it's first used.
- Both languages. Sinhala font in the chat.
- Every card has a short text version, for screen readers and for a future WhatsApp bot.

**How:** results from engine tools show as cards through CopilotKit's `useRenderToolCall`. A `show_card` frontend tool can also show a card for something already on the page, without a new calculation.

## 6. Plain words first

This is a public site, so the assistant talks like a helpful friend, not a textbook.

1. Answer first, then explain why.
2. Use everyday words. Put the traditional term in brackets only the first time, and only if it helps: "your birth star (nakshatra)".
3. If the person uses a traditional term, the assistant can use it back.
4. No degrees, house numbers or technical tables unless someone asks.
5. Short sentences. Natural spoken Sinhala. Singlish questions are fine.

**Word list** (draft, the owner should check it)

| Traditional term | What the assistant says first |
|---|---|
| Lagna | Rising sign |
| Rashi | Sign |
| Nakshatra | Birth star |
| Graha | Planet |
| Dasha / bhukti | Life period / current period |
| Porondam | Match, or compatibility check |
| Rajju, Vedha | The two most important match checks |
| Kuja dosha | The Mars check |
| Nakath / subha muhurtha | Good time, lucky time |
| Kendara / jathaka | Birth chart, horoscope |
| Gochara / transit | Where the planets are now |

These go in a new `plain` field in the backend label files (`backend/app/data/labels/*.yaml`), because file 08 keeps astrology words in the backend. Tests count traditional terms in answers and flag answers that use too many.

## 7. The Deep Agents toolbox: used when needed

| Feature | The assistant reaches for it when | Example | Added when |
|---|---|---|---|
| **Answer from the page** | The answer is already on screen | "What does Rajju mean?" on a match result: no engine call | Step 1 |
| **Engine tools** | It needs a fact that isn't on screen | "When does my next period start?" | Step 1 |
| **Skills** | A topic needs its own guidance. Loaded only when the topic comes up | `explain-match` loads only for match questions | One skill per new topic, from step 1 |
| **Asking the person** | A missing detail would change the answer and isn't on the page or the people list | No birth time: a choice card | Step 3 |
| **Approvals** | Before saving, sharing, using a paid credit or starting a long job | Confirm card | When the first such action exists |
| **Fact checker** | An answer mentions chart facts | Checks every planet, sign and check against the tool results | Step 6 |
| **Subagents** | A request covers several people or topics and would crowd the conversation | "Explain both our charts and our match" | When a question needs it |
| **Dynamic subagents** | Many similar jobs at once | Compare 3 or more proposals. Check a date for a whole family | When a question needs it |
| **Async subagents** | A job takes longer than about 30 seconds | Full written report. Wide old horoscope search | When a question needs it |
| **Code interpreter (QuickJS)** | Arranging many results: sorting, comparing, date sums. Also runs dynamic subagents | Rank 6 wedding dates by how many people they suit | With dynamic subagents |
| **Sandbox (full Python)** | Only if a real need appears | Custom table or chart for a paid user | Maybe never |
| **Personal memory** | A signed in person agrees to be remembered | Preferred language, short answers, saved people | After sign in |
| **Feedback memory** | Someone gives feedback | "Too long" changes their next answers. Shared lessons go through a weekly review | With memory |

**Notes:**

- The main agent's instructions say: start simple. Use the page first, then one tool, and only then the heavier features.
- Code never calculates astrology. It only arranges results from the engine.
- Dynamic subagents are beta in Deep Agents. Keep them behind a setting, with a cap on how many one request can start.
- Async subagents need an Agent Protocol server (option B in section 8).
- The sandbox, if ever used, has no network and no secrets.
- The agent never writes shared memory from public chat. Anyone could type false "lessons", so only reviewed changes reach everyone.

**Engine tools** (call the existing API, with the same free and paid trimming as the site):

`find_place`, `check_birth_time`, `get_birth_chart`, `get_life_periods`, `check_match`, `find_good_dates`, `baby_name_letters`, `search_old_horoscope`, `year_outlook`, `make_pdf_report` (approval if paid), `make_share_link` (approval).

## 8. How the parts fit

```
 Browser
   Next.js pages  ->  page context + people list (sections 3 and 4)
   CopilotKit chat:  cards, forms, point and ask, page actions
        |
        v
 Next.js route  /api/copilotkit   (CopilotRuntime)
        |
        |  AG-UI over HTTP (streamed text, tool calls, cards, questions)
        v
 Agent service  (new, Python, Deep Agents)
        |                  |
        |  engine tools    |  Postgres: conversations, later memory and feedback
        |  (HTTP, key)     |  AI model provider
        v
 Existing backend  (FastAPI engine)
```

**Why a separate agent service:** the engine stays clean and well tested. The agent brings large libraries, a provider key and costs that grow with use. It calls the engine like the website does, so it can't see more than the person could.

**Where it runs.** Step 1 tries both and the owner picks:

| | A. FastAPI + `ag-ui-langgraph` | B. LangGraph Agent Server |
|---|---|---|
| What | The agent mounted on FastAPI with `add_langgraph_fastapi_endpoint`, on Render like the backend | LangGraph's own server, self hosted or on LangSmith Deployment. CopilotKit connects with `LangGraphAgent` |
| Good | Same tools and hosting as today. Cheapest | CopilotKit's documented path. Questions, conversations and background jobs built in |
| Risk | Some CopilotKit docs say pausing to ask a question doesn't work on the FastAPI bridge | More moving parts, possibly a hosting fee |

Recommendation: B, unless A handles questions well in the trial.

**Routing:** `frontend/next.config.ts` sends `/api/*` to the backend. Next.js applies that rewrite after fixed routes but *before* dynamic ones, so CopilotKit's usual catch-all route (`api/copilotkit/[[...slug]]`) would be sent to the backend. Step 1 uses a fixed route, `app/api/copilotkit/route.ts`, with CopilotKit's single-endpoint mode. The staging password in `frontend/proxy.ts` already covers it.

**Step 1 choices** (2026-11-15):

- Hosting: option A (FastAPI + `ag-ui-langgraph`) for now, because it runs like the backend. Revisit at step 3, when questions to the person need interrupts. Staging runs it on Render as `astronomia-agent`, from `agent/Dockerfile` (docs/09).
- Model: `openai:gpt-6-luna`, low reasoning effort, through the Responses API with `store=False`, so OpenAI keeps no copy of conversations. The model is a setting.
- Rules for every answer (plain words, safety, format) live in `agent/app/prompts/guide.md`, which is always loaded. Topic guidance lives in skills (`explain-match`, `sinhala-style`, `star-matches`), read only when the topic comes up.
- The page context sends no names, birth dates, times or places. Only the results shown on screen.
- The assistant is called **Astro** (chosen 2026-11-15). The chat is a panel on the right, like a browser's side panel: on a laptop it pushes the page aside, on a phone it covers the screen. Its header names the page it is reading, and its suggestion chips change with the page (`frontend/components/assistant/Chat.tsx`).

## 9. Steps

Only the first steps are detailed. After step 6, we pick the next step from the question list.

| Step | What | Done when |
|---|---|---|
| **1. Chat that sees the page** | Agent service with one engine tool. CopilotKit chat button. Match result page shares its context. Plain words skill. Try hosting A and B. Sinhala test on two or three models. Cost of a typical chat | On a match result, "explain my result" answers from the real result, in both languages. Owner picks hosting and model |
| **2. Cards in the chat** | Match and chart summary cards. Point and ask on match checks. Greeting and suggestion buttons built from the result | Tapping a check card's ask icon gives an answer about that check, with the card shown |
| **3. People list and asking** | One people list shared by forms and chat. Birth details form and choice buttons in the chat. Chat fills forms and forms fill the chat | Details entered on the birth chart page are used by the chat without asking again |
| **4. All main pages** | Context from birth chart, good times, wedding, baby names, year ahead, old horoscope, shared results. Matching skills and cards | Each page's typical question (section 3.2) gets an answer about what's on screen |

**Step 4, text part (2026-11-15):** every page now tells the chat what it shows (`frontend/lib/assistant/pages.ts`), or the chat reads the page address and looks the facts up. Ten engine tools cover the public endpoints (calendar, Avurudu, names, planet changes, star matches). Topic skills with researched reference notes cover birth charts, the almanac and poya, Avurudu, and ceremonies and names. Two helpers: `researcher` and `date-checker`, at most 4 per question. Cards come with step 2.
| **5. Answers point at the page** | `highlight_on_page`, `open_page`, `fill_form` | "Where is that?" highlights the right card |
| **6. Ready for testers** | Fact checker, sensitive topics, limits, bot protection, off switch, privacy page update | Safety and fact check tests pass. Test group uses it on staging for a week |

**Likely later**, in whatever order the questions call for: "Remember on this device", subagents for multi-person questions, proposal comparison with dynamic subagents, reports as background jobs, sign in with personal memory and feedback, voice in Sinhala, WhatsApp, handover to a human astrologer.

## 10. Question list

This list grows as we go. A new row is added when we find a question worth answering. Then we decide what it needs, and it becomes part of a step.

| # | Question | Where | Needs | Step | Status |
|---|---|---|---|---|---|
| 1 | What does my match result mean? | Match | Page context, plain words | 1 | Done (local) |
| 2 | Is this a good match? | Match | Safe reply: the factors and trade-offs, no yes or no | 1 | Done (local) |
| 2a | Which birth stars suit mine? | Match | `find_matching_stars` tool, `star-matches` skill | 1 | Done (local) |
| 3 | Which checks didn't pass, and does it matter? | Match | Point and ask, match card, `explain-match` skill | 2 | Planned |
| 4 | What does my chart say about me? | Birth chart | Chart page context, `birth-chart` skill (card later) | 4 | Done (text answers, no card yet) |
| 5 | Check our match (no details entered yet) | Any | People list, birth details form | 3 | Planned |
| 6 | Which life period am I in, and when does it change? | Birth chart | Chart page context (current and next period), timeline card later | 4 | Done (text answers, no card yet) |
| 7 | Is today a good day for ...? | Good times | `good_times_for_day`, `calendar-and-nakath` skill | 4 | Done (text answers, no card yet) |
| 8 | Find a wedding date in March | Wedding | Ask for place and event, good times card | 4 | Planned |
| 9 | Which letter should my baby's name start with? | Baby names | `name_letters_for_star`, `names_for_letters`, `ceremonies-and-names` skill | 4 | Done (text answers, no card yet) |
| 10 | Where is that on the page? | Any | `highlight_on_page` | 5 | Planned |
| 11 | Compare my 4 proposals | Match | Dynamic subagents, comparison card | Later | Idea |
| 12 | Make me a full report | Birth chart | Async subagent, progress card | Later | Idea |
| 13 | Remember me next time | Any | "Remember on this device", later sign in and memory | Later | Idea |
| 14 | What is on this page? (any page) | Any | Page context or address, `site-guide` skill | 4 | Done |
| 15 | When is the next poya, and what is it about? | Litha | `month_calendar`, `calendar-and-nakath` skill | 4 | Done |
| 16 | When are the New Year nakath, and what do we do? | Avurudu | `new_year_times`, `avurudu` skill | 4 | Done |
| 17 | How does Saturn's change affect my sign? | Changes, forecast | `planet_change_for_sign`, `year_ahead_for_sign`, `birth-chart` skill | 4 | Done |
| 18 | Compare these dates or places | Good times | `date-checker` helper, one per date or place | 4 | Done |
| 19 | Customs: poruwa, akuru kiyaweema, house warming, poya | Any | Reference notes, `researcher` helper for broad questions | 4 | Done |
| 20 | What does my chart say about my career, love, money, family, studies? | Birth chart | `personal-reading` skill and reference (house meanings, house lord table) | 4 | Done (text, needs astrologer review) |
| 21a | Read my whole chart (like a printed premium horoscope) | Birth chart | Chart facts in the page context (house rulers, aspects, strength, yogas, sub-period dates), chapter-by-chapter reading in `personal-reading` | 4 | Done (text, needs astrologer review) |
| 21b | Explain our match in detail | Match | Reasons for every factor in the page context, `explain-match` reference (factor meanings, four themes, Moon sign styles) | 4 | Done (text, needs astrologer review) |
| 21 | What could the next few years look like for me? | Birth chart | Life period from the chart, `year_ahead_for_sign`, `personal-reading` | 4 | Done (text, needs astrologer review) |

**Personal readings (2026-11-16).** People consult an astrologer to see themselves in the chart, to understand work, love and family, to know what is coming and when, and to feel calmer. Research on how astrologers work (reading order, house lords, life periods and transits) and on consultation ethics (tendencies not certainties, no fear, no remedy selling, no health diagnosis) fed a rewrite of `guide.md` and the new `personal-reading` skill. This relaxed one rule from step 1: the guide used to answer in at most four 15-word points and to avoid any prediction. It now gives fuller, personal answers and talks about the future as possibilities and windows. Update the same day: hard subjects (illness, relationship strain, money trouble, remedies) are now answered as possibilities with a human astrologer for the full reading, not refused. Death and lifespan are never named, even when the chart has traditional pointers (it says only "a period calling for extra care with health and safety"). The ban on frightening predictions, certain outcomes, a final marriage verdict, exact dates, named diseases and investment or legal advice stays. A competitor's premium horoscope (Porondam.lk, reviewed 2026-11-16) walks through each of the 12 houses (its sign, where its ruler sits, which planets look at it), yogas and doshas, every sub-period with dates and themes, Saturn periods, and caution windows with what to do. The chart page now sends the facts needed to read it that way (`frontend/lib/assistant/chartFacts.ts`), and the skills give the reading in chapters. Left out on purpose: lucky numbers and colours, gems, mantras and yantras. **Owner decision needed:** confirm this loosening, and have an astrologer review `skills/personal-reading/reference.md` (the nakshatra keywords and planet-in-house patterns are a teaching summary).

**How the list grows:**

- Questions the assistant couldn't answer well (it said it couldn't help, or got a thumbs down) are collected without birth details and reviewed each week.
- Ideas from the owner and testers.

## 11. Safety, privacy and trust

File 04 lists the guardrails. These are the parts that make them work:

| Risk | What we build |
|---|---|
| The AI makes up facts | Fact checker on answers that mention chart facts. "Based on" card under the answer |
| Sensitive topics | Self harm, abuse or a medical emergency get a calm reply with local help lines (checked before launch) and no astrology |
| Fear and pressure | No alarming predictions, no selling remedies, no yes or no on marriages |
| Prompt injection | Page context, names and typed text are treated as data. Tools are read only except the ones needing approval |
| Privacy | Page context and birth details never go in logs or traces. People list stays in the browser unless the person signs in and agrees. Provider set not to keep data. Privacy page says what goes to the AI provider |
| Cost and abuse | Limits per visitor and per account, daily free messages, caps per request, bot protection, an off switch |
| Honesty | AI answers are labelled. Short note: for guidance and cultural interest, not professional advice |

## 12. Decisions needed from the owner

| # | Decision | When |
|---|---|---|
| 1 | Hosting option A or B. Step 1 uses A | Step 3 |
| 2 | ~~AI model~~ Decided: `openai:gpt-6-luna` (2026-11-15) | Done |
| 3 | Check the word list in section 6 | Step 1 |
| 4 | The assistant's name and personality. A friendly name, not "astrologer", fits a public site | Before step 6 |
| 5 | Should "Remember on this device" be offered, and ticked by default or not? | Step 3 |
| 6 | Should real names go to the AI provider? Step 1 sends none ("the bride", "the groom") | Step 3 |
| 7 | Daily free message limit | Before step 6 |
| 8 | Tracing: LangSmith or self hosted Langfuse | Before step 6 |

## Sources

- [Deep Agents overview](https://www.langchain.com/deep-agents)
- [Deep Agents harness (Python)](https://docs.langchain.com/oss/python/deepagents/harness)
- [Deep Agents subagents](https://docs.langchain.com/oss/python/deepagents/subagents)
- [Deep Agents dynamic subagents](https://docs.langchain.com/oss/python/deepagents/dynamic-subagents) and [launch post](https://langchain.com/blog/introducing-dynamic-subagents-in-deep-agents)
- [Deep Agents sandboxes](https://docs.langchain.com/oss/python/deepagents/sandboxes)
- [Deep Agents with AG-UI](https://docs.langchain.com/oss/python/deepagents/ag-ui)
- [CopilotKit with Deep Agents](https://docs.copilotkit.ai/deepagents)
- [CopilotKit interrupt flow for Deep Agents](https://docs.copilotkit.ai/deepagents/human-in-the-loop/interrupt-flow)
- [CopilotKit: which hook for which job](https://docs.copilotkit.ai/concepts/which-hook)
- [CopilotKit LangGraph (FastAPI) human in the loop notes](https://docs.showcase.copilotkit.ai/langgraph-fastapi/human-in-the-loop)
- [ag-ui-langgraph on PyPI](https://pypi.org/project/ag-ui-langgraph/)
