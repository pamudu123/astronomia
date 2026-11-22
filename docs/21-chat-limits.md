# Astro chat limits and cost controls (as built)

Date: 2026-11-22. Step 5 of the build order in `docs/18-saving-paid-and-compare.md` (section 5), plus the cost controls agreed with the owner.

## 1. What people get

| Who | What | What they see |
|---|---|---|
| Free | 2 questions a week per browser, counted by a cookie. The week starts at the first question and lasts 7 days | "2 free questions this week", then "1 free question left this week". When both are used, the chat box is replaced by "You've used this week's 2 free questions. They come back on Sunday 29 November. Get a full report to keep asking." with **Get the full report** |
| Paid | Each paid report (a paid order in `sidera.orders`) adds a chat allowance of about 20 questions' worth, measured by real cost. It is kept until used. Two reports give twice as much | "About 15 questions left". At 80% used: "You've used most of the chat that came with your reports." At the end, the free weekly questions are there as for anyone, with "You've used the chat that came with your reports." above them; once those are used too: "You've used the chat that came with your reports. Get another full report to keep asking." |

- **Full readings and Explain buttons** of a paid report use none of this: they go through `/api/explain`, which these limits do not touch.
- **Free and paid don't mix.** While an account has allowance left its questions are paid ones: they use no free questions and do not count toward the site's daily free ceiling. A free question never uses the allowance. A guest (anonymous sign in) has no allowance.
- **Typed text is never lost.** A message that is too long, or a question a limit refuses, stays in the input. The counter shows "123 / 1000" while typing; over the limit it says so and does not send.
- **Clearing cookies** gives 2 more free questions. Accepted (docs/18); the per-network limit below catches heavy use.
- **"Get the full report"** scrolls to the page's own "Get the full report" card (hadahan and porondam results, #66's flow). On other pages it opens the birth chart page, where a report can be made.

## 2. Cost controls

All quiet until reached, and none asks people to prove they are human (no Turnstile for now).

| Control | Default | What people see |
|---|---|---|
| Burst limit | 5 messages a minute per browser or account | "That's a lot of messages at once. Please wait a minute, then send yours." |
| Per-network limit (free) | 10 free questions a week per address (IPv6: per /64) | "Many free questions have come from your network this week. More come back on [date]. A full report comes with its own chat." |
| Daily ceiling for free chat | USD 5 a day for the whole site, midnight to midnight in Sri Lanka. Answers still being written count as an average answer until their cost arrives | "Astro is very busy today, so free questions are paused until [date]. A full report comes with its own chat." Paid chat goes on |
| Hard ceiling per account | USD 1 a day per account | "You've asked Astro a lot today. Your chat continues on [date]." |
| Message length | 1,000 characters | The counter, and "Please keep your message to 1000 characters. Your text is kept: shorten it, then send." |

Dates are shown in the reader's language on Sri Lanka's calendar ("Sunday 29 November", or the Sinhala date). All words are in `frontend/messages/en.json` and `si.json` under `assistant.limits`; the Sinhala needs the reviewer's eye.

## 3. Where the limits are enforced, and why there

```
Browser ──> Vercel /api/copilotkit ──(1) may this browser/account ask?──> Backend /v1/chat/turns
                 │                         <── question id, or refusal (reason, date)
                 └──(2) run + question id──> AI service ──(3) take question up once──> Backend .../start
                                                  │        (4) tokens and cost   ──> Backend .../usage
```

- **The backend holds the rules and every counter**, in the database (`sidera.chat_turns`, `backend/app/store/chat.py`, rules in `backend/app/tiers/chat.py`). The free AI service sleeps and forgets its memory; the database does not. A question is counted and recorded in one transaction, with the browser, network and account held (PostgreSQL advisory locks), so two messages sent at once cannot both take the last free question.
- **The website's chat route asks first** (`frontend/app/api/copilotkit/route.ts`, `frontend/lib/chatLimits.ts`). Only it knows all three things that name the asker: the browser's cookie, the network address Vercel reports (not something a browser can set), and the sign in. It computes the message length from the run itself. A refusal goes back as JSON with the reason and a date, and nothing reaches the AI service.
- **The AI service refuses any run the backend did not allow** (`agent/app/usage.py`). Every chat run and every follow-up-button run needs a question id, which it takes up with the backend: each question is answered once and gets its follow-up buttons once, within minutes. Without that it calls no model. It also refuses a message longer than the backend's limit, and measures every model call in the run (the guide, its helpers and the follow-ups) from the token usage the AI provider reports, then sends the tokens and their cost to the backend.

So **no endpoint skips the limits**: the backend's chat endpoints need the chat key, which only the website's server and the AI service hold (the site's `/api` forward never adds it); a visitor who calls the AI service directly, even with its access key, has no question id the backend issued; and a forged or reused id is refused. Enforcing only in the website would leave the AI service open; only in the AI service, it would not know the browser or the address; only in the backend, it could not see the tokens.

If the backend cannot be reached, the chat stops (fails closed) rather than running without limits. A question the AI service never took up within 2 minutes (an error on the way) is not counted.

## 4. Settings

All limits and amounts are on the server, never in the website's code.

Backend (Render, `astronomia-api`):

| Variable | Default | Meaning |
|---|---|---|
| `ASTRONOMIA_CHAT_KEY` | empty | Shared secret with the AI service and the website. Empty: the chat endpoints answer 503 and the site runs the chat without limits |
| `ASTRONOMIA_CHAT_FREE_PER_WEEK` | 2 | Free questions a week per browser |
| `ASTRONOMIA_CHAT_NETWORK_PER_WEEK` | 10 | Free questions a week per network address |
| `ASTRONOMIA_CHAT_BURST_PER_MINUTE` | 5 | Messages a minute per browser or account |
| `ASTRONOMIA_CHAT_MAX_LENGTH` | 1000 | Longest message, in characters |
| `ASTRONOMIA_CHAT_FREE_DAILY_USD` | 5.0 | What the site's free chat may cost in a day |
| `ASTRONOMIA_CHAT_REPORT_QUESTIONS` | 20 | Questions' worth of chat each paid report adds |
| `ASTRONOMIA_CHAT_ANSWER_USD` | 0.01 | The cost of an average answer: turns the allowance into money (20 x 0.01 = USD 0.20 a report) and money back into "About N questions" |
| `ASTRONOMIA_CHAT_ACCOUNT_DAILY_USD` | 1.0 | The hard daily ceiling per account |
| `ASTRONOMIA_CHAT_TIME_ZONE` | Asia/Colombo | Whose midnight starts a new day |

AI service (Render, `astronomia-agent`): `ASTRONOMIA_AGENT_CHAT_KEY` (copied from the backend by `render.yaml`; required in production), and the model's prices in US dollars per million tokens, `ASTRONOMIA_AGENT_PRICE_INPUT` (default 0.25), `ASTRONOMIA_AGENT_PRICE_CACHED_INPUT` (0.025) and `ASTRONOMIA_AGENT_PRICE_OUTPUT` (2.0). **The defaults are placeholders: set them to OpenAI's prices for the model in use**, or the measured cost and the allowance are off by the same factor.

Website (Vercel): `CHAT_KEY`, the same value as `ASTRONOMIA_CHAT_KEY`.

The allowance is worked out when it is read (paid orders x the setting), so changing `ASTRONOMIA_CHAT_REPORT_QUESTIONS` or `..._ANSWER_USD` changes every account's allowance, past reports included. A voided order takes its allowance away. Once `pamudu` users have chatted, compare the real average cost (`cost_micros / count` of paid rows) with `ASTRONOMIA_CHAT_ANSWER_USD` and adjust (docs/18, decision 3).

## 5. Turning it on

1. Apply `supabase/migrations/20261122090000_chat_turns.sql` to the Supabase project (needs the owner's approval). After applying with MCP, rename the file to the recorded version.
2. Make one long random value. Set it as `ASTRONOMIA_CHAT_KEY` on the backend in Render (the assistant copies it on its next deploy) and as `CHAT_KEY` in Vercel. Do both together and redeploy both: between the two, the chat refuses every question.
3. Set the model's prices on the assistant.
4. Check: the chat shows "2 free questions this week"; after two questions it shows the message with the date.

To turn the limits off again, remove `CHAT_KEY` in Vercel and `ASTRONOMIA_CHAT_KEY` in Render.

## 6. What is kept (privacy)

One row per question in `sidera.chat_turns`, only numbers and ids, **never the question or the answer**:

- free questions: the random id from the browser's chat cookie, a keyed hash of the network (HMAC with the chat key, so the address cannot be recovered by trying every address), the start of that browser's week; kept 8 days, then deleted;
- paid questions: the account; kept while the account exists and deleted with it (Delete account, and `on delete cascade`);
- for both: when it was asked and taken up, the input, cached and output tokens, and the cost in millionths of a US dollar.

Two cookies: `sidera_chat` (httpOnly, a random id, one year) counts the free questions; `sidera_chat_turn` (httpOnly, 30 minutes, only sent to `/api/copilotkit`) ties the follow-up buttons to the question just asked.

## 7. Not built

Bot protection with a human check (Turnstile), compare, the 7-day expiry of free saves, and payments. Explain buttons on free pages (nakath, baby names) are not counted against anything; if they get heavy use, they could share the daily ceiling.
