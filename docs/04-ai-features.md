# AI Features: Competitor Check and Recommendations

Date of research: 2026-11-03

## Correction to file 01

My first pass missed the AI-first Sri Lankan sites. Several already market an AI astrologer chat, so "AI chat" is **not** a gap. It is becoming table stakes. Differentiation has to come from quality, trust and workflow.

Same caveat as before: I could not open these sites. Everything comes from search summaries and the sites' own marketing. **Verify each one yourself.**

## Sri Lankan sites with AI features

| Site | Reported AI features | Confidence |
|---|---|---|
| **MyHoroscope.LK** (myhoroscope.lk) | "AI Powered Vedic Astrology". Calls itself Sri Lanka's first AI astrologer. Chat covers lagna, porondam and daily predictions. | Medium |
| **AstroGPT Lanka** (sinhala.astrogptlanka.com) | Sinhala version of an AstroGPT model with a chatbot window on the site. | Medium |
| **Gurunnanse AI** (gurunnanse.lk) | Sri Lanka focused AI astrology for horoscopes and porondam. Sinhala daily horoscope and birth chart analysis. | Medium |
| **sinhalahoroscope.com** | Free Sinhala kendara site with an AI chatbot that answers questions about your kendraya in Sinhala. | Low to medium (an earlier search could not find the site, so confirm) |
| **Viber horoscope bot** (2020) | Rule based horoscope bot in Sinhala, English, Tamil. Not modern AI. | Medium, old |
| **Kendra.lk** | Human astrologers by online consultation, free first chat. Not AI, but a competitor for the same need. | Medium |
| **Tharukirana** (tharukirana.com) | Sinhala astrology site. AI features not confirmed. | Low |
| **Sinhala Astrology Pro** (Android app, Universl) | Sinhala astrology app on Google Play. AI features not confirmed. | Low |

Sources: [MyHoroscope.LK](https://www.myhoroscope.lk/en), [AstroGPT Lanka](https://sinhala.astrogptlanka.com/), [Gurunnanse AI](https://www.gurunnanse.lk/), [Kendra.lk](https://kendra.lk/), [sinhalahoroscope.com](https://sinhalahoroscope.com/), [Tharukirana](https://www.tharukirana.com/), [Sinhala Astrology Pro on Google Play](https://play.google.com/store/apps/details?id=com.universl.sinhalaastrologyapp&hl=en), [Viber bot (Colombo Gazette)](https://colombogazette.com/2020/10/19/viber-introduces-sri-lankas-first-ever-localised-horoscope-bot/)

## What Indian leaders offer (benchmark)

From app listings and roundups, all self reported:

- **AstroSage Kundli AI**: AI Kundli ("talk to your birth chart"), AI horoscope, multiple AI astrologers (Vedic, Western, numerology, Vastu), phone call with an AI astrologer in many Indian languages 24/7, free Guna Milan matching, PDF reports, paid human astrologers.
- **AstroSure AI**: chat assistant named Agastyaa answering questions from the user's predictions.
- **Astro Talk AI**: unlimited AI chat with AI astrologers.
- **AjmerAstro AI app**: AI chat 24/7 in 12 Indian languages, free kundali and AI chat, paid per minute 1:1 chat with verified human astrologers.
- **Melooha**: AI predictions, compatibility analysis, family profile management.

Pattern: free AI chat and chart as the hook, paid human astrologers as the revenue. Worth copying.

## Likely weaknesses to exploit (hypotheses, not verified)

1. **Hallucinated charts.** General chatbots calculate planetary positions badly. Check whether the Sri Lankan AI sites compute charts with real ephemeris data or let the model guess.
2. **Sinhala quality.** Sinhala is a lower resource language. Test each site with 10 Sinhala questions and note awkward or wrong replies.
3. **Porondam logic.** Check whether the AI uses a rule engine for the 20 factors or just writes plausible text.
4. **No explanation of sources.** Replies that cite which chart facts they used would stand out.
5. **No handoff.** Few seem to connect AI chat to a real astrologer.

## Recommended AI features

### Phase 1 (with MVP)

1. **Ask your kendara (chat grounded in the chart).** Chat in Sinhala, English and Singlish. The assistant answers using the user's computed chart and porondam result, not its own memory.
2. **Plain language explanations.** After the porondam result, one tap: "Explain this result in Sinhala". Per factor explanation of why it passed or failed.
3. **Suggested questions.** Chips such as "Is Kuja dosha cancelled?", "Which factors failed?", "What are good months for marriage?"

### Phase 2

4. **Proposal assistant.** Compare 3 to 10 proposals side by side and summarise the trade offs. Highlights hard fails (Rajju, Vedha).
5. **Daily palapala written by AI from real transits**, not generic text, personalised to the user's lagna and current dasha.
6. **Nakath assistant.** "Find a good time for a house warming in March" using the nakath engine as a tool.
7. **Report writer.** Turn the computed chart into a readable PDF report in Sinhala and English.
8. **Voice input and output** in Sinhala for older users (speech to text and text to speech).
9. **WhatsApp bot** for chart lookups and daily palapala.

### Phase 3

10. **Astrologer copilot.** Drafts a reading from the chart, the astrologer edits and signs it. Gives your marketplace a quality edge.
11. **Handoff to a human astrologer** when the user asks something the AI should not decide (marriage go or no go, health, death).
12. **Image/OCR import** of a paper kendara photo into structured data (many families only have the paper chart).

## Architecture principle: the LLM talks, the engine calculates

Do not let the model compute anything astronomical or any porondam score.

```
User question
   |
   v
LLM (chat) --tool calls--> Deterministic engine
                            - birth chart (ephemeris)
                            - 20 factor porondam
                            - kuja dosha
                            - nakath finder
   ^                                |
   |---- structured JSON result ----+
   v
Answer in user's language, citing chart facts
```

- Expose the engine as tools (function calling): `get_chart`, `match_porondam`, `check_kuja_dosha`, `find_nakath`.
- The prompt includes the computed JSON, and the model is told to use only those facts.
- Show a "based on" panel listing the chart facts used in each answer.
- Cache results per chart to cut cost.

## Guardrails (important in this domain)

- **Disclaimer**: for guidance and cultural interest, not a substitute for a professional astrologer or for advice on health, legal or financial matters.
- **No fear selling.** Do not generate alarmist predictions ("your marriage will fail") or upsell remedies from fear. This is both an ethics and a trust issue.
- **Sensitive topics.** If a user mentions self harm, abuse, or a medical emergency, drop the astrology framing and show appropriate help information.
- **Do not decide marriages.** Present factors and trade offs, and recommend consulting family and an astrologer.
- **Prompt injection.** Birth names and free text fields are untrusted input. Keep tool outputs and user text clearly separated from system instructions.
- **Rate limits and abuse control** per user and per IP to control cost.
- **Privacy.** Birth data plus marriage intent is sensitive. Tell users what is sent to the AI provider, avoid logging full conversations by default, allow deletion, and check your provider's data retention terms.
- **Honest labelling**: label AI content as AI generated.

## Quality and evaluation

- Build a test set of 50 Sinhala and 50 English questions with expected facts from the engine.
- Check every answer against the engine output (no invented planets or degrees).
- Have a practising astrologer review a sample of 100 answers.
- Track thumbs up and down, and "talk to an astrologer" clicks.

## Cost and model notes

- Chat cost grows with usage, so use a free daily message limit, then login, then paid plans.
- A smaller, cheaper model is likely fine for explanations when the engine supplies the facts. Use a stronger model for open ended chat and Sinhala quality. Test Sinhala quality on candidate models before choosing.
- Cache common explanations (each porondam factor) so they are not regenerated.

## Business ideas around AI

| Idea | Notes |
|---|---|
| Free AI chat with daily limit | Matches the AstroSage style funnel |
| Premium unlimited chat and PDF report | Subscription |
| Pay per report | Fits occasional users such as marriage seekers |
| AI draft then human astrologer review (paid) | Higher price, stronger trust |
| Astrologer marketplace commission | AI qualifies the lead and prepares the chart |

## Open questions

1. Which AI provider and model? Test Sinhala quality before deciding.
2. Is user conversation storage acceptable, or chat only in session?
3. Will a real astrologer be involved in review and in the marketplace?
4. Which channel first: web, WhatsApp, or Android app?
5. Do you want voice in Sinhala in the first release?
