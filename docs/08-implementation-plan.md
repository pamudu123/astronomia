# Implementation Plan

Date: 2026-11-11

How the first release gets built. It turns the scope in file 06 and the features in file 07 into ordered steps, each small enough to be one pull request. Claude writes the code. The owner reviews, tests and decides.

The screens are designed on the canvas linked in `design/README.md`. Each frontend step names the screens it builds.

## 1. Decisions this plan rests on

| Topic | Decision |
|---|---|
| Backend | Python 3.12, FastAPI |
| Frontend | Next.js (React, TypeScript), a separate app that calls the backend API |
| Who builds | Claude writes the code in small pull requests. The owner reviews each one |
| Features | Everything in file 07: hadahan, porondam, Kuja dosha deep check, dasha detail, forecast and alerts, share links, PDF, free and paid levels |
| Languages | Sinhala and English |
| Ephemeris | Swiss Ephemeris during the build. Licence settled before launch |

## 2. Repository layout

```
astronomia/
  backend/                 Python API and calculation engine
    app/
      api/                 routers: places, charts, porondam, kuja, dasha, forecast,
                           reports, shares, alerts, auth, billing, explain, meta
      engine/              pure calculation code, no web or database imports
        ephemeris.py       interface + Swiss Ephemeris adapter
        timeconv.py        local time and place -> UTC, ambiguous and missing times
        chart.py           lagna, houses, planets, nakshatra, pada, navamsha
        dasha.py           vimshottari, three levels
        transits.py        planet positions over a date range, sign change dates
        forecast.py        transits and dasha changes set against one chart
        kuja.py            kuja dosha and every cancellation rule
        porondam/          rule loader, one function per factor, quick match
      tiers/               decides free or paid, trims a result to the free level
      explain/             reason codes -> one line text, detailed text, AI explain
      reports/             PDF templates and renderer
      store/               database models: shares, profiles, accounts, purchases
      data/                rule files (YAML), labels (si, en), places
    tests/
      golden/              checked charts and matches (JSON)
  frontend/                Next.js app
    app/[lang]/            pages, one folder per screen, `si` and `en`
    components/            Kendara, ScoreRing, DashaTimeline, FactorCard, PaidLock, ...
    lib/                   API client, types generated from the backend's OpenAPI file
    messages/              interface text: si.json, en.json
    public/                images copied from design/assets/web
  design/                  artwork and the scripts that prepare it (exists)
  docs/                    planning documents (exists)
  .github/workflows/       CI for backend and frontend
```

## 3. How the parts fit

```
Browser
   |
   v
Next.js app  --- /api/* is forwarded --->  FastAPI backend
(pages, motion,                             |- engine (calculations)
 Sinhala and English)                       |- tiers (free or paid)
                                            |- explain (rule based + AI)
                                            |- reports (PDF)
                                            |- store -> PostgreSQL
                                            '- jobs (alerts, link expiry)
```

Key choices:

- **One source of truth for results.** The engine always computes the full result. The `tiers` layer trims it to the free level before it leaves the server. The browser never receives paid content it has not earned, so nothing can be unlocked by editing the page.
- **Types are generated, not hand written.** FastAPI publishes an OpenAPI file. The frontend's API types are generated from it in CI, so the two sides cannot drift apart.
- **Astrology words live in the backend.** Names of rashi, nakshatra, planets, factors and every reason sentence come from the backend's label files, because the PDF and the AI need them too. The frontend's `messages/` holds only interface text (buttons, headings).
- **The frontend forwards `/api/*` to the backend.** The browser sees one site, so sign in cookies work without cross site trouble.
- **PDF is rendered by the backend** from its own print templates (light paper layout). Sinhala rendering is tested first, before any report work (step 11).
- **Storage is opt in.** The database holds share snapshots, alert profiles, accounts and purchases. A plain chart or match touches no storage.
- **Rules are data.** Porondam and Kuja rules are YAML files with a version. Rules not yet confirmed by an astrologer carry `provisional: true`, and the API passes that flag through so the page can say so.

Hosting (proposed): backend and PostgreSQL on Render, frontend on Vercel.

## 4. Build steps

Each step is one pull request with tests. "Check" is how the owner can confirm it works.

### Stage 1: the free product

| # | Step | Delivers | Check |
|---|---|---|---|
| 1 | **Project setup** | `backend/` (FastAPI skeleton, uv, ruff, mypy, pytest, Dockerfile) and `frontend/` (Next.js, TypeScript, lint, tests). CI for both. Design tokens, fonts, header, footer and language switch from the design. Images copied to `frontend/public`. | CI is green. The home page shell opens in Sinhala and English. `/healthz` answers. |
| 2 | **Time and place** | Local time to UTC for any country and year, from the bundled `tzdata`. Times that happened twice or never happened are reported with both options, never guessed. Place search (`/v1/places`): all 17,856 populated places in Sri Lanka from GeoNames, with province names in both languages and Sinhala names where GeoNames has them (138 places), plus about 170,000 towns worldwide. `/v1/time/resolve` turns a birth time and place into UTC. | Tests for Sri Lanka 1990 to 2006, UK summer time, Sydney, midnight births and 1880. Searching "Kandy" or "මහනුවර" returns Kandy with its time zone. |
| 3 | **Chart engine** | Ephemeris adapter, lagna, houses, nine planets, nakshatra and pada, navamsha. `/v1/charts`. First golden charts. Birth time boundary warning. | Golden tests pass. A known chart matches an independent source for lagna, Moon star and planet signs. |
| 4 | **Hadahan pages** | Home, birth details form, result page (free level): key cards, kendara drawing with motion, planets table. Screens: Home, Hadahan form, Hadahan result. | Enter a birth, see the chart. Works on a phone. Language switch changes every label. |
| 5 | **Dasha** | Vimshottari at three levels in the engine. `/v1/dasha`. Free timeline on the result page. | Dates match a reference for two sample charts. |
| 6 | **Porondam engine** | YAML rule format, the confirmed factors, Rajju and Vedha as separate checks, quick match by birth star. `/v1/porondam`. | Unit test per factor. Sample couple returns the expected passes and fails. |
| 7 | **Kuja dosha** | Check from lagna, Moon and Venus, and every cancellation rule with the fact it used. `/v1/kuja-dosha`. Rules marked provisional. | Tests for each rule, both applying and not applying. |
| 8 | **Porondam pages** | Two person form, quick match mode, result page (free level): score ring, checks, factor cards, Kuja comparison. Screens: Porondam form, Porondam result, Mobile porondam. | Enter two births, see the match. Quick match works with stars only. |
| 9 | **One line reasons** | A reason code for every factor and check, with text in Sinhala and English. Shown on all free results. | Every factor card shows a reason in both languages. No missing text (a test checks all codes). |
| 10 | **Forecast (free)** | Transit engine: where planets are on any date, and when they change sign. `/v1/forecast` for the current month. "This month for you" on the result page. | Sign change dates match a published almanac for the next year. |
| 11 | **PDF report (free)** | First a small test that Sinhala prints correctly. Then hadahan and porondam reports from print templates. `/v1/reports/pdf`. Screen: PDF report page 1. | Download a PDF in each language. Sinhala letters are joined correctly. Prints cleanly on A4. |
| 12 | **Share links** | Database, `/v1/shares`, share dialog, shared page, link preview image, expiry and delete. Screens: Share dialog, Share preview image. | Share a result, open the link in a private window, delete it, confirm it is gone. |

**Done together in one pull request:** steps 3, 4, 5, 7 and the hadahan part of step 9. What was built:

- **Chart engine:** Swiss Ephemeris (built-in Moshier mode, no data files needed), Lahiri ayanamsa, mean node, whole sign houses. Planets checked against astropy's independent ephemeris: within 30 arcseconds (90 for Jupiter and Saturn, where astropy's model is less precise). A birth time check flags a lagna or nakshatra change within 5 or 15 minutes.
- **Dasha:** vimshottari, three levels, years of 365.25 days.
- **Kuja dosha:** houses 1, 2, 4, 7, 8, 12 from the lagna, Moon and Venus, plus four cancellation checks, from `backend/app/data/rules/kuja_v1.yaml`. Marked provisional until the astrologer confirms them.
- **Labels and reasons:** `backend/app/data/labels/si.yaml` and `en.yaml` hold every name and one line reason. The Sinhala needs a native speaker's review.
- **Pages:** the birth details form (place search, time zone shown for the date, coordinates option, clock change choice) and the result page (key cards, kendara in rashi and navamsha, planets table, dasha timeline, Kuja card, birth time check).
- **Endpoints:** `POST /v1/charts`, `POST /v1/hadahan`, `GET /v1/labels/{lang}`.
- **Golden charts:** 6 charts in `backend/tests/golden/charts.json`, marked `"checked": false` until confirmed.
- **Provisional until confirmed:** the kendara house direction (anticlockwise from the top box).


At the end of stage 1 the site is a complete free product.

### Stage 2: the paid level

| # | Step | Delivers | Check |
|---|---|---|---|
| 13 | **Tiers** | The `tiers` layer and a paid flag (switched by a setting until payments exist). Paid data for Kuja deep check, dasha detail and the 12 month forecast with key dates. | A free request never contains paid fields (a test inspects every endpoint). |
| 14 | **Paid pages** | Kuja deep check, dasha detail, 12 month forecast, and the lock teasers on free pages. Screens: the three "Paid" screens. | With the paid flag off, the lock shows. With it on, the full screens show. |
| 15 | **Detailed explanations** | Rule based long text for every factor, Kuja check and dasha period, in both languages. Paid sections of the PDF, and both languages in one file. Screen: PDF report page 2. | Paid PDF contains the explanations. Free PDF does not. |
| 16 | **AI explanations** | "Explain this" and questions about a chart. The model receives only computed facts, through tools. Guardrails, caching, rate limits, an automated fact check, and a Sinhala quality comparison of models. | The 100 question test set passes the fact check. Sensitive topics get the safe reply. |
| 17 | **Sign in and plans** | Accounts with the chosen sign in method. Plans page. Account page with delete. Screen: Plans. | Sign up, sign in, delete the account. |
| 18 | **Payments** | Single report purchase and membership, in test mode. Purchases set what the account is entitled to, replacing the setting from step 13. | Test payments unlock exactly what was bought. A failed payment unlocks nothing. |
| 19 | **Alerts** | Opt in saved profile, a daily job that finds upcoming key dates, email sending, and the off switch that deletes the profile. | Turn alerts on with a test date, receive the email, turn them off, confirm the profile is deleted. |

### Stage 3: launch

| # | Step | Delivers | Check |
|---|---|---|---|
| 20 | **Accuracy and review** | Astrologer review of the golden set and every rule file. Provisional flags removed where confirmed. Security and privacy check (no birth data in logs or URLs). Speed check. Ephemeris licence settled. | Astrologer sign off recorded in the rule files. Checklist complete. |
| 21 | **Deploy** | Staging and production on the chosen hosts, domain, error monitoring, backups, privacy policy and terms pages. Soft launch to a test group, then payments go live. | Test users complete a chart, a match, a PDF, a share and a test purchase. |

## 5. Working rules

- One step, one pull request, with tests. Nothing merges with failing CI.
- The engine has no web or database imports, so it can be tested alone and reused later.
- Every result carries the rule set version and the ayanamsa used.
- No birth data in URLs or logs. Share links use a long random code.
- Sample data from the design (names, dates) is used only in tests and stories, never shipped as content.
- Wording follows file 04: calm, no fear selling, no remedies, never a yes or no on a marriage.
- Motion follows the design and switches off when the device asks for reduced motion.

## 6. What is needed from the owner, and when

Steps 1 to 5 need nothing further. The rest can be built with provisional rules and corrected later, but each item below blocks the step shown from being final.

| Needed | Blocks | By step |
|---|---|---|
| A practising astrologer to check charts and rules | Final accuracy | 3 (first check), 20 (sign off) |
| The full list of 20 porondam factors and their rules | Complete porondam | 6 |
| Kuja dosha house list and cancellation rules | Final Kuja check | 7 |
| Kendara layout: which way the houses run from the lagna box | Final chart drawing | 4 |
| Ayanamsa default (Lahiri assumed) and Rahu and Ketu method (mean node assumed) | Final chart values | 3 |
| Sinhala wording review by a native speaker | Final Sinhala text | 9, 15 |
| Simha artwork, and standalone card pictures and moon | Final images | 4 |
| Sign in method | Accounts | 17 |
| How people pay, prices, payment gateways | Payments | 18 |
| AI model, after the Sinhala test | AI explanations | 16 |
| Hosting accounts and domain name | Deploy | 21 |
| Ephemeris licence: buy it or publish the code | Launch | 20 |

## 7. Step 1 in detail

The first pull request contains no astrology. It sets up the ground so every later step is small.

**Backend**
- `backend/pyproject.toml` with FastAPI, Uvicorn, Pydantic, pytest, ruff, mypy.
- `app/main.py` with `/healthz` and `/v1/meta` (languages, version).
- Settings from environment variables, structured logging that never logs request bodies.
- Dockerfile.

**Frontend**
- Next.js app with `si` and `en` routes and the language switch.
- Design tokens from the canvas: colours, fonts (Marcellus, DM Sans, Noto Sinhala), spacing, the `rise` and `lift` motion.
- Shared header, footer and page shell. Home page hero with the sky image and the turning wheel.
- Images from `design/assets/web` copied to `frontend/public` by a small script.
- API client stub and type generation from the backend's OpenAPI file.

**CI**
- Backend: lint, type check, tests.
- Frontend: lint, type check, unit tests, one browser test that opens the home page in both languages.

**Before step 1 starts:** the open pull request with the docs and design images should be merged, so the build starts from an up to date main branch.
