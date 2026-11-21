# Docs

Planning documents for the Sri Lankan hadahan (jathaka) and porondam website.

| File | Contents |
|---|---|
| [01-competitor-research.md](01-competitor-research.md) | Existing Sri Lankan sites and apps, their features, gaps, and a verification checklist |
| [02-feature-recommendations.md](02-feature-recommendations.md) | Suggested MVP, v2 and later features, accuracy plan, business models, open questions |
| [03-porondam-domain-notes.md](03-porondam-domain-notes.md) | Notes on the 20 point porondam, Kuja dosha and engine inputs |
| [04-ai-features.md](04-ai-features.md) | Which Sri Lankan sites already have AI chat, Indian benchmarks, recommended AI features, architecture and guardrails |
| [05-pricing.md](05-pricing.md) | Free vs paid offers, human astrologer prices in LKR, app and telecom pricing, AI pricing benchmarks, pricing suggestions |
| [06-release-plan.md](06-release-plan.md) | First release (v0.1) plan for the Python backend: scope, stack, API, AI design, testing, milestones, decisions needed |
| [07-free-and-paid-features.md](07-free-and-paid-features.md) | What every user gets and what paid users get on top, the five added features in detail, what paid features need, later services, and a market check |
| [08-implementation-plan.md](08-implementation-plan.md) | How the first release gets built: repository layout, how the parts fit, 21 build steps with checks, working rules, and what is needed from the owner |
| [09-launch.md](09-launch.md) | The launch runbook: hosting, the private staging site, and what is left before going public |
| [10-extra-features.md](10-extra-features.md) | Features after the first release: what other sites offer, the categories and sets, and each set in detail |
| [11-nakath-rules.md](11-nakath-rules.md) | The nakath rules (set C), their sources and where the sources disagree |
| [12-baby-rules.md](12-baby-rules.md) | The baby name letter table and child rules (set D), their sources and where the sources disagree |
| [13-old-horoscopes.md](13-old-horoscopes.md) | Set E: finding the birth from an old paper kendara. How the search works, the edge margins and why, privacy and limits |
| [14-ai-assistant-plan.md](14-ai-assistant-plan.md) | The AI chat assistant: Deep Agents, CopilotKit and AG-UI. Knows the page and the details entered, answers with cards, plain words, features used only when needed, step by step build and a growing question list |
| [15-payments.md](15-payments.md) | Payments: on hold, because PayHere does not accept astrology services (2026-11-21). What a provider must approve, who to ask, what must be done before charging, and the earlier PayHere design kept for reference |
| [16-accounts-and-saved-reports.md](16-accounts-and-saved-reports.md) | Saving results to "My reports": quiet guest accounts, Google sign in only at payment, data, API, security, screens and build steps |
| [17-ai-explain-buttons.md](17-ai-explain-buttons.md) | AI explanations: a full detailed reading in chapters at the top of the chart and match results (modelled on competitor premium reports, only where we have the data), and collapsible "Explain" buttons on the 15 main places (small questions stay in the chat), the facts each sends, one set of skills shared with the Astro chat, the paid switch and build steps |

| [18-saving-paid-and-compare.md](18-saving-paid-and-compare.md) | The agreed account plan: cookies for free users, Google sign in for paid users, free saves for 7 days and paid saves without limit, the coupon in place of payments, Astro chat limits (2 free questions a week, measured usage for paid), what paid users get, and comparing saved reports with AI analysis |
| [19-supabase-build-plan.md](19-supabase-build-plan.md) | Supabase for the database and sign in (anonymous guests and Google), Vercel for the website, Render for the backend: where each part runs, what is already set up, the design, settings and the five build steps |
| [20-paid-reports.md](20-paid-reports.md) | Paid reports as built (docs/18 steps 3 and 4): prices, coupons, orders, the paid check, the on switch, what is on staging, and the known gaps (2026-11-21) |
| [policies/](policies/README.md) | The reviewed privacy notice, terms of use and refunds policy from the 2026-11-20 legal review, the placeholders still to fill, and what must be built before they go live |
| [reviews/](reviews/) | Material for outside reviewers: the Sinhala wording spreadsheet |

## Read this first

The research was done through web search summaries only. The competitor sites could not be opened from the research environment, so feature lists are second hand and unverified. See the caveats and the "Verify yourself" checklist in file 01.
