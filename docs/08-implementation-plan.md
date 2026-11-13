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
- **Confirmed:** the kendara house direction (anticlockwise from the top box). The owner checked it against a paper horoscope on 2026-11-13.


**Done together in one pull request:** steps 6 and 8, and the porondam part of step 9.

- **Rules:** `backend/app/data/rules/porondam_si_v1.yaml`, with 11 of the 20 factors: Dina, Gana, Mahendra, Stree Deergha, Yoni, Rashi, Rashyadhipathi, Vashya and Nadi are scored, and Rajju and Vedha are separate essential checks. Every table (gana, yoni, nadi, rajju, vedha pairs, vashya, planet enemies) is in the file. Marked provisional.
- **Matching:** full birth details, birth star and pada only (quick match), or one of each. Kuja dosha for both people, and how the two compare, when both are full.
- **Endpoint:** `POST /v1/porondam`. The page uses the same labels endpoint, now with the porondam names.
- **Pages:** the two-person form with the full or birth stars switch, and the result with the score ring, essential checks, a factor grid with filter, Kuja for both, and the method line.
- **Adding the other 9 factors** needs only the rule file and the two label files.

**Done in one pull request:** step 11.

- **Renderer:** WeasyPrint (HTML and CSS to PDF, shaped by Pango and HarfBuzz) with Jinja2 templates in `backend/app/reports/`. A test checks that Sinhala conjuncts such as ශ්‍රී are joined. SVG text is not joined, so the kendara draws its lines in SVG and places the planet names over them as normal text.
- **Fonts:** Noto Sans Sinhala, DM Sans and Marcellus are bundled with their OFL licences in `backend/app/reports/fonts/`. Reports can load only these files: no other files and no web addresses.
- **Reports:** hadahan (2 pages: key facts, rashi and navamsha kendara, planets, dasha periods, Kuja dosha with its checks, birth time check) and porondam (score, summary, Rajju and Vedha, all factors with their reasons, Kuja dosha for both, both rashi charts for a full match). Both end with the disclaimer, the method, the rule set versions and the provisional note.
- **Endpoint:** `POST /v1/reports/pdf`. The server works the result out again from the birth details in the body. The PDF metadata carries no birth details, and the PDF and font tools are kept out of the logs.
- **Pages:** a "Download PDF" button on the hadahan and porondam results.
- **Provisional:** the Sinhala report wording needs the same native speaker review as the page wording.

**Done in one pull request:** step 10.

- **Transit engine** (`backend/app/engine/transits.py`): the sign of every planet at any moment, and every sign change in a date range, found to the minute. Retrograde steps back into an earlier sign are reported like any other change. Checked against published almanacs for 2025 to 2027 (Lahiri, mean node): Saturn into Meena and Mesha, Jupiter's five changes, and Rahu and Ketu on 5 December 2026 to the minute.
- **Forecast** (`backend/app/engine/forecast.py`): for the current month, where Saturn, Jupiter, Rahu and Ketu are counted from the lagna, and any sign change inside the month.
- **Endpoint:** `POST /v1/forecast`, with one line for each planet, a line for each move and a short theme for the house, in Sinhala and English.
- **Page:** "This month for you" on the hadahan result. The hadahan still shows if the forecast cannot load.
- **Provisional:** the twelve house themes (`house_theme` in the label files) are waiting for the astrologer, and the page says so. Months are counted in UTC.

**Done in one pull request:** step 12.

- **Share links:** a Share button on the hadahan and porondam results opens a dialog. Nothing is saved until "Create link" is pressed. The dialog then gives the link, Copy, Send on WhatsApp, the date it closes, and Delete.
- **What is kept:** the finished result in both languages, and the name and birth line. The request (place id, coordinates, clock change choice) is not kept. "Hide names" keeps no names at all.
- **Storage:** SQLite (`backend/app/store/shares.py`, file set by `ASTRONOMIA_SHARES_DB`) for now, behind a small `ShareStore` class so PostgreSQL can replace it at deploy. Only SHA-256 hashes of the link code and of the delete token are kept. Links close after 30 days (`ASTRONOMIA_SHARE_DAYS`), and expired rows are removed.
- **Endpoints:** `POST /v1/shares`, `GET /v1/shares/{code}?lang=`, `DELETE /v1/shares/{code}` with the token in an `X-Delete-Token` header. Responses are `no-store` and `noindex`. The access log shows `/v1/shares/…`, never the code.
- **Shared page** `/{lang}/s/{code}`: the result, read only, with a banner (shared, open until, make your own) and a link preview (title, one line, picture, noindex). The device that made the link keeps its delete token in local storage and can delete from there.
- **Choosing how long a link lives** is the paid level (step 13 onwards).

At the end of stage 1 the site is a complete free product.

**Launch preparation (part of step 21), done ahead of the paid stage, which is parked for later:**

- Share links can live in PostgreSQL (`ASTRONOMIA_DATABASE_URL`), tested in CI against a real PostgreSQL.
- A private staging gate: the site asks for a password, and the backend needs an access key.
- `render.yaml`, `frontend/vercel.json` and a `robots.txt` that keeps shared links (and all of staging) out of search.
- Draft privacy and terms pages in Sinhala and English, linked from the footer.
- The runbook in `docs/09-launch.md`, with what is left before going public.

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

### Extra features

Planned set by set in `docs/10-extra-features.md`. Category A is porondam depth.

**Done in one pull request:** A1, which stars match mine.

- **Engine:** `star_matches()` in `backend/app/engine/porondam.py` runs the usual match against all 27 stars. A star that lies across two signs is listed once for each sign, which gives 36 rows. Rows that pass both essential checks come first, then the higher count.
- **Endpoint:** `GET /v1/porondam/stars/{star}?pada=&role=&lang=`. A star name is not personal data, so this one is a GET and may be cached for an hour.
- **Pages:** `/{lang}/porondam/stars` lists the 27 stars. `/{lang}/porondam/stars/{star}` shows the ranked list, with a choice of bride or groom and, for the nine stars that lie across two signs, the Moon sign. The first list is in the page as served, for search engines.
- **Links:** each row opens the quick match with both stars filled in (`/porondam?bride=star.pada&groom=star.pada`). The porondam form and the home page link to the star pages.
- **Search:** `sitemap.xml` lists every public page in both languages, and `robots.txt` points to it. A staging site has an empty sitemap.
- **Star names** for page titles live in `frontend/lib/nakshatra.ts`. A test keeps them equal to the backend label files.
- **Known limit:** the first visit to an unknown star address shows the not found page with status 200. Later visits return 404.

**Done in one pull request with A1:** A2, more porondam factors (15 of the 20).

- **Rules:** `porondam_si_v2.yaml` adds Gothra, Pakshi, Linga and Dina (the birth weekdays). Version 1 is kept. How the tables were found is in `docs/03-porondam-domain-notes.md`.
- **Engine:** two new rule types (`group_pairs_ordered` for Linga, `weekday_count_avoid` for Dina) and a "not checked" state. Dina needs both birth dates, so a birth star only match shows it as not counted and leaves it out of the total.
- **Names:** the star count factor is now shown as Nakath, as the Sri Lankan sites call it. Its id is still `dina`. The new weekday factor has the id `weekday` and is shown as Dina.
- **Pages and PDF:** a picture for each new factor, and a "Not counted" state on the page and in the PDF.
- **Check:** `backend/tests/test_porondam_observed.py` replays 34 results from a Sri Lankan porondam site. The four added factors agree with all of them.
- **Still missing:** Varna, Bhutha, Vruksha, Ayusha and Graha.

**Done in a later pull request:** the last five factors (all 20 of the 20).

- **Rules:** `porondam_si_v3.yaml` adds Varna, Bhutha, Vruksha, Ayusha and Graha. Versions 1 and 2 are kept. Sources and method in `docs/03-porondam-domain-notes.md`.
- **Engine:** three new rule types: `sign_rank_at_least` (Varna by Moon sign), `distance28_avoid` (Ayusha in the 28 star count) and `lagna_and_moon_lords` (Graha). Graha needs both lagnas, so it is "Not counted" in a birth star only match, like Dina.
- **Counts:** a birth star only match counts 16 factors, a full match 18. Rajju and Vedha stay apart.
- **Check:** the replay test now has 74 of the site's results. Bhutha, Vruksha and Ayusha agree with all of them. Varna and Graha follow published methods, because the site's could not be worked out.
- **PDF:** the porondam report is now 3 pages.

**Done in the same pull request:** A3, years ahead for the couple.

- **Engine** (`backend/app/engine/couple.py`): for the ten years from today, Saturn's stays in each sign (worked out once a day and kept), each person's Saturn periods counted from the Moon sign, where the two people's periods overlap, and the dasha periods that touch the window.
- **Saturn periods shown:** the 12th, 1st and 2nd sign from the Moon as one period (Erashtaka), and the 8th on its own. A retrograde step back into an earlier sign splits a period.
- **Endpoint:** `POST /v1/porondam/timeline`, with the same body as `/v1/porondam`. A birth star only person gets Saturn periods but no dasha, which needs the exact Moon position.
- **Page:** "Years ahead for the couple" on the match result: one ten year line with a Saturn row and a dasha row for each person and a row for the overlaps, then the same facts in words. It loads on its own, so the match still shows if it fails. It is not on shared pages or in the PDF.
- **Facts only:** dates, planets and houses. Nothing is judged good or bad. Marked provisional (`couple_v1`). Dates are UTC.

Category B is planet changes and forecasts.

**Done in one pull request:** B1, the Rahu and Ketu change (5 December 2026).

- **Engine** (`backend/app/engine/changes.py`): every sign change of Saturn, Jupiter, Rahu and Ketu from 1 November 2026, from `sign_changes()`. Rahu and Ketu are one change. Each change has a fixed id such as `rahu-ketu-2026-12`, the minute it happens, the signs it leaves and enters, whether it is a backward step, and when the planet moves on again. The list is the same for everyone, so it is worked out once and kept. `count_from()` gives the houses counted from any sign.
- **Endpoints:** `GET /v1/changes`, `GET /v1/changes/{change}` (all 12 lagnas) and `GET /v1/changes/{change}/{lagna}`. They need no personal data, so they are GET and may be cached for an hour. `POST /v1/changes/{change}/personal` counts one change from the chart's lagna and from its Moon sign (gochara). `POST /v1/changes/personal` gives every change in the next twelve months for a chart.
- **Pages:** `/{lang}/changes` lists all changes. `/{lang}/changes/{change}` shows one change for all 12 lagnas. `/{lang}/changes/{change}/{lagna}` shows one lagna with drawings before and after, each planet's houses and their themes, and what stays. Each page has a title, a description and links between the two languages. The list and the change page need no backend. The lagna page asks the backend on the server and streams it in, and the browser asks again if that failed.
- **Your own version:** a panel on each change page. It offers the hadahan made earlier in the same tab, or the birth form. It sends a POST and shows the change counted from the lagna and from the Moon sign. Nothing goes in the address.
- **On the hadahan:** "Planet changes for you", after "This month for you". It loads on its own, so the hadahan still shows if it fails.
- **Why one page per change and lagna:** a broad search ("Rahu Ketu change 2026") finds the change page. A lagna search ("Rahu Ketu 2026 Makara lagna") finds that lagna's page. Each lagna page has its own houses and themes, so the pages are not copies.
- **Search:** the sitemap lists every published change page in both languages. The home page and the footer link to the changes.
- **Published so far:** only the Rahu and Ketu change. The Saturn and Jupiter changes are on the list as "coming soon". `PUBLISHED` in `frontend/lib/changes.ts` says which have pages. A test keeps that list equal to the backend.
- **Times** are Sri Lanka time (UTC+05:30), as the almanacs print them. Marked provisional (`changes_v1`).
- **Known limit:** as with the star pages, an unknown change address shows the not found page. `dynamicParams` cannot be used with Cache Components.

**Done in a second pull request:** B2, the Saturn and Jupiter changes.

- **Pages** for the five Saturn and Jupiter changes in 2027. All six changes now have pages, and the list has no "coming soon" left.
- **Backward steps and returns:** the engine marks a forward move that goes back into the sign a planet stepped out of (`returning`). A backward step says it is a short stay and when the planet returns. A return says so.
- **Titles:** Jupiter changes sign three times in 2027, so a change of one planet is named by the sign it enters ("Jupiter change 2027 into Kanya", "Jupiter change 2027 back into Simha"). Each page has its own title.
- **Saturn from the Moon sign:** the personal version and each lagna page say when Saturn starts or ends Erashtaka (the 12th, 1st and 2nd signs from the Moon) or the 8th sign. These are the same periods as the couple timeline.
- **Fixtures:** `uv run python scripts/export_change_fixtures.py` in `backend/` saves the answers the frontend tests use.

**Done in a third pull request:** B3, the yearly forecast for 2027. A paid feature, open to everyone for now (file 07, section 4.6).

- **Engine** (`backend/app/engine/yearly.py`): for one year in Sri Lanka time, each slow planet's stays with their houses, from the change list. `YEARS` says which years have a forecast.
- **Endpoints:** `GET /v1/yearly/{year}/{lagna}` (cached) and `POST /v1/yearly/{year}/personal` (from the lagna and from the Moon sign). Both depend on `yearly_access()`, the one place for the paid check.
- **Pages:** `/{lang}/forecast/2027` lists the 12 lagnas. `/{lang}/forecast/2027/{lagna}` shows a bar for each planet across the year, the house each planet is in at the start of each month, and the key dates with links to the change pages. It is served with a title and description and is in the sitemap. "Your own 2027" on the same page uses the birth form or the hadahan from this tab.
- **On the hadahan:** "Your 2027", a link to the year for that lagna.
- **Kept apart:** `backend/app/engine/yearly.py`, `backend/app/api/yearly.py`, `frontend/lib/yearly.ts`, `frontend/components/yearly/` and `frontend/app/[lang]/forecast/`. The frontend lock goes in `YearlyGate`.

Category C is nakath (auspicious times). Rules and sources are in `docs/11-nakath-rules.md`.

**Done in one pull request:** C1, the nakath engine.

- **Sunrise and sunset** (`ephemeris.py`): the upper edge of the Sun with standard refraction, behind the `Ephemeris` protocol. A place where the Sun does not rise that day gets none.
- **Panchanga** (`backend/app/engine/panchanga.py`, rules in `panchanga_v1.yaml`): the weekday counted from sunrise, thithi, nakatha, yoga and karana, each with its start and end to the minute, and Rahu kalaya. A day runs from one sunrise to the next. Each day at each place is worked out once and kept; 60 days take under a second.
- **Times to the minute** follow the Sri Lankan sites: sunrise drops the seconds, a change is shown at the first whole minute it holds, and Rahu kalaya is counted in whole minutes.
- **Endpoint:** `GET /v1/panchanga?date=&place_id=` (or latitude, longitude and time zone). A place and a date are not personal, so it is cached for an hour. Every time comes in UTC and local time, with the offset.
- **Checked against** porondam.lk for 40 made-up moments (thithi, nakatha, yoga, karana and weekday all 40 of 40; sunrise 39 of 40) and 10 change times (all within a minute), Rahu kalaya from two Sri Lankan sites, and drikpanchang.com (within 3 minutes).
- **Not built:** the night Rahu kalaya (no single rule found) and horawa (no rule needs it yet).

**Done in a second pull request:** C2, Avurudu and daily nakath (free).

- **Avurudu engine** (`backend/app/engine/avurudu.py`): the moment the Sun enters Mesha and punya kalaya (6 hours 24 minutes either side). The official lists for 2022 to 2027 are data in `rules/avurudu_v1.yaml`, with the source of each year. No other Avurudu time is calculated.
- **Endpoint:** `GET /v1/avurudu/{year}?timezone=`, every time in Sri Lanka time and in the chosen time zone, with our calculated times beside the official ones and the difference in minutes.
- **Pages:** `/{lang}/avurudu` (years and cities), `/{lang}/avurudu/{year}` for 2022 to 2028, and `/{lang}/avurudu/2027/{city}` for 18 cities with many Sri Lankans. The year page adds the visitor's own time from the browser, and any place can be chosen. A year without an official list (2028) shows only our times, marked as not official.
- **Daily nakath:** `/{lang}/nakath` (today in Colombo, worked out at request time) and `/{lang}/nakath/{date}`, with sunrise, Rahu kalaya, thithi, nakatha, yoga and karana, any place, and the next and previous day.
- **Search:** every Avurudu page and the daily page are in the sitemap, with titles and descriptions in both languages. Links from the home page and the footer.
- **Checked:** our dawn matches the official lists 2022 to 2027 within a minute, punya kalaya fits every list exactly, and the Australian list's dawn and punya kalaya match the same moments in Sydney.
- **Fixtures:** `uv run python scripts/export_nakath_fixtures.py` in `backend/`.

**Done in a third pull request:** C3, the wedding nakath finder. A paid feature, open to everyone for now (file 07, section 4.7).

- **Rules** in `rules/wedding_si_v1.yaml`: the nakathas for each ceremony, thithis and karana to avoid, weekdays, tara bala and chandra bala for both people, Rahu kalaya, daylight only, Venus and Jupiter not combust, and for the poruwa no malefic in the 7th house from the lagna. Weaker points (some sources only) are shown as cautions, not hidden.
- **Engine** (`backend/app/engine/wedding.py`): days that cannot pass are dropped by cheap checks first, then daylight is scanned in 5 minute steps and each window's edges are found to the minute. The best day in each week is kept, then the best 8. Two years for all three ceremonies take about 3 seconds.
- **Endpoint:** `POST /v1/wedding-nakath` with both people (full birth details or a birth star, as in porondam), the place, 3, 6, 12 or 24 months, and the ceremonies wanted. It depends on `wedding_access()`.
- **Page:** "Wedding nakath for this couple" on the porondam result. It searches only when asked. Each date shows its time window, nakatha, thithi and lagna, any weaker points, and every rule it passes in plain words.
- **Kept apart:** `engine/wedding.py`, `api/wedding.py`, `lib/wedding.ts` and `components/wedding/`. The frontend lock goes in `WeddingGate`.
- **Checked:** every suggestion is checked again at its start, middle and end against each rule, worked out separately from the sky.

Category D is baby and child. Tables and sources are in `docs/12-baby-rules.md`.

**Done in one pull request:** D1, baby name letters (free).

- **Rules** in `rules/name_letters_si_v1.yaml`: the letter for each of the 108 padas, with what the other sources give, and the lagna and weekday letters. Transliterations are quoted, because YAML reads a bare `No` as false.
- **Engine** (`backend/app/engine/names.py`): the letter for a star and pada, and any pada change within 15 minutes of the birth time.
- **Endpoints:** `GET /v1/baby/letters` and `GET /v1/baby/letters/{star}` (cached for an hour). `POST /v1/baby/letters` takes the birth details in the body and returns the star, pada, Moon sign, lagna, the weekday counted from sunrise, the hadahan time check and the letters.
- **Pages:** `/{lang}/baby-names` (the birth form and the 27 stars with their letters) and `/{lang}/baby-names/{star}` (the four padas, rendered on the server). The letters for page titles are kept in `frontend/lib/babynames.ts`, and a test keeps them equal to the rule file.
- **Checked:** each letter is the majority of four sources (`tests/golden/name_letters_observed.json`), and a Sri Lankan site's star and pada agree with ours for 108 made-up births.
- **Fixtures:** `uv run python scripts/export_baby_fixtures.py` in `backend/`.

**Done in one pull request:** set E, part 1: enter an old kendara and find the births.

- **Planet table:** `backend/app/kendara/table.py` stores all nine bodies at 00:00 UTC each day, 1900 to 2035. It is built in the Docker image and on first use (about 10 seconds, 750 KB, not committed).
- **Search:** `backend/app/kendara/search.py`.
  - Days from the table first, then 5 minute steps with the ephemeris at the birth place. Window edges are found to the minute.
  - Windows are graded "exact" or "near", using the edge margins in `backend/app/data/rules/kendara_v1.yaml`.
  - A full 1900 to today search takes well under a second.
- **Endpoint:** `POST /v1/kendara/search`, free for now behind `kendara_access()`. Narrowing by year range, known date and birth star. The place defaults to Colombo.
- **Page:** `/{lang}/kendara`.
  - Choose the lagna sign, tap a planet and tap its box, with an optional navamsha kendara.
  - Results show each window, its birth star and pada, and its grade.
  - Linked from the hadahan and porondam forms.
- **Check:** for 13 known births from 1902 to 2019, our own drawings searched backwards find the true birth, with and without the navamsha.
- **Details:** `docs/13-old-horoscopes.md`.

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
