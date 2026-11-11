# First Release Plan (v0.1): Python Backend

Date: 2026-11-11

Built from files 01 to 05. This is a proposal for you to react to. Items marked **[Decide]** need your call before or during the build.

## 1. Goal of the first release

Ship a backend that does three things **correctly** and **explains** them:

1. Compute a birth chart (hadahan) from date, time and place.
2. Match two charts for porondam, with a per factor result and Kuja dosha.
3. Explain a result in Sinhala or English using AI, grounded only in the computed facts.

Everything else (nakath finder, palapala, accounts, payments, marketplace) waits. Research shows a plain chart and score are free everywhere (file 05), so v0.1 must win on **accuracy, transparency and explanation**, not feature count.

## 2. Scope

### In v0.1

| Area | What ships |
|---|---|
| Birth chart | Lagna, rashi, nakshatra with pada, 9 graha positions (sign, degree, house, retrograde), navamsha (D9), vimshottari dasha periods |
| Places | Sri Lankan districts and towns preloaded, plus worldwide city search |
| Time zones | Historical offsets from the IANA tz database (Sri Lanka changed offset several times between 1996 and 2006) |
| Porondam | Rule engine driven by a config file. Starts with the factors confirmed in file 03 and adds the rest once the astrologer supplies the full list of 20. Rajju and Vedha (and Yoni if confirmed) as hard pass or fail checks shown apart from the score |
| Quick match | Match by two birth stars only, for users without a birth time |
| Kuja dosha | Check for both people, house list and cancellation rules taken from config, with the reasoning returned |
| Tamil porutham | Engine supports a second rule set, but only enabled if rules are validated in time |
| AI explain | One endpoint: "explain this chart or match" in Sinhala, English or Singlish. The model gets the engine JSON and must use only those facts |
| Chart output | JSON plus an SVG of the Sri Lankan style square chart. PDF can come later |
| Privacy | Stateless by default. No birth data stored, no birth data in logs |
| Labels | Sinhala and English names for every rashi, nakshatra, graha and factor, served from the API |

### Not in v0.1

Accounts and login, saved profiles, proposal manager, nakath finder, daily palapala, payments, astrologer marketplace, PDF reports, voice, WhatsApp bot, mobile app. These are v0.2 and later (section 9).

## 3. Tech stack

| Concern | Choice | Why |
|---|---|---|
| Language | Python 3.12 | Your preference, and the best astronomy libraries are in Python |
| Web framework | **FastAPI** + Uvicorn | Typed request and response models (Pydantic), automatic OpenAPI docs the frontend can use |
| Ephemeris | **pyswisseph** (Swiss Ephemeris) **[Decide]** | Industry standard, built in sidereal modes including Lahiri. Licence is AGPL or paid commercial, see section 4 |
| Time zones | `zoneinfo` (standard library) + `tzdata` | Historical offsets for Asia/Colombo and worldwide |
| Place search | GeoNames cities dataset loaded into the DB | Free (CC BY), no external API call per request |
| Database | PostgreSQL (places, label translations, rule versions). SQLite for local dev | Nothing user specific is stored in v0.1 |
| Rules | YAML files in the repo, versioned | Astrologer can review them as text. Every result returns the rule set version used |
| AI | Anthropic Python SDK with tool use **[Decide]** | Engine functions are exposed as tools. Test Sinhala quality on two or three models before locking in |
| Cache | Redis, or in process LRU at first | Cache AI explanations per (chart hash, language). Cache per factor explanations |
| Tests | pytest, hypothesis for edge cases, golden chart files | Accuracy is the product |
| Lint and types | ruff, mypy | |
| Packaging | uv, Docker | |
| Hosting | One container (Render, Fly or a VPS) plus managed Postgres | Small and cheap until traffic shows up |

## 4. Licence decision on the ephemeris (blocker)

Swiss Ephemeris is **AGPL** unless you buy a commercial licence. AGPL means that if users interact with your server over the network, you must offer them the full source of your backend.

Options:

1. **Open source the backend under AGPL.** Free, and fits "transparent method" as a selling point. Competitors can copy the engine.
2. **Buy the Swiss Ephemeris commercial licence** (one time fee from Astrodienst). Keep the code private.
3. **Use Skyfield (MIT) with JPL DE440 data** and compute the ayanamsa yourself. No licence issue, but more work and more risk in sidereal and house calculations.

Recommendation: start with pyswisseph behind an `Ephemeris` interface so it can be swapped. Pick option 1 or 2 before public launch.

## 5. Project layout

```
backend/
  pyproject.toml
  Dockerfile
  app/
    main.py                # FastAPI app, routers, middleware
    config.py              # settings from environment
    api/
      charts.py            # /v1/charts
      porondam.py          # /v1/porondam
      places.py            # /v1/places
      explain.py           # /v1/explain
      meta.py              # /v1/meta (labels, rule versions, ayanamsa)
    engine/                # pure Python, no web or DB imports
      ephemeris.py         # Ephemeris interface + Swiss Ephemeris adapter
      timeconv.py          # local time + place -> UTC, Julian day
      chart.py             # lagna, houses, grahas, nakshatra, pada, navamsha
      dasha.py             # vimshottari
      porondam/
        engine.py          # loads rules, evaluates factors
        factors.py         # one function per factor
        kuja.py            # kuja dosha + cancellations
      render_svg.py        # Sri Lankan square chart as SVG
    ai/
      tools.py             # get_chart, match_porondam, check_kuja_dosha
      prompts.py           # system prompts per language
      explain.py           # calls the model, enforces grounding
      guardrails.py        # sensitive topic detection, disclaimers
    data/
      rules/sinhala_v1.yaml
      rules/tamil_v1.yaml
      labels/si.yaml, en.yaml, ta.yaml
    db/                    # places, migrations (alembic)
  tests/
    golden/                # astrologer checked charts and matches (JSON)
    test_chart.py
    test_porondam.py
    test_timezones.py
    test_api.py
```

Keeping `engine/` free of web and DB code means it can later run inside a worker, a WhatsApp bot or a mobile build without changes.

## 6. API (v1)

All endpoints are versioned under `/v1`. Requests carry birth data in the body only, never in the URL (URLs end up in logs).

| Method and path | Purpose |
|---|---|
| `GET /v1/places?q=galle` | Place search. Returns name (si, en), lat, lon, tz name |
| `POST /v1/charts` | Compute a chart. Body: date, time, place id or lat/lon/tz, options (ayanamsa, house system, language) |
| `POST /v1/charts/svg` | Same input, returns the chart drawing |
| `POST /v1/porondam` | Two people (full birth data or birth star only). Returns factors, hard checks, score, kuja dosha for both, rule set version |
| `POST /v1/explain` | Body: a chart or porondam result id or payload, language, optional question. Returns text plus the list of facts used |
| `GET /v1/meta` | Ayanamsa in use, rule set versions, supported languages, label tables |
| `GET /healthz` | Health check |

Example porondam response shape:

```json
{
  "rule_set": "sinhala_v1",
  "ayanamsa": "lahiri",
  "score": {"passed": 13, "total": 20},
  "hard_checks": [
    {"factor": "rajju", "passed": true, "reason_code": "different_rajju_group"},
    {"factor": "vedha", "passed": false, "reason_code": "vedha_pair"}
  ],
  "factors": [
    {"factor": "gana", "passed": true, "detail": {"bride": "deva", "groom": "manushya"}}
  ],
  "kuja_dosha": {"bride": {"present": false}, "groom": {"present": true, "cancelled": true, "cancellations": ["..."]}},
  "verdict_hint": "hard_check_failed"
}
```

The engine returns **reason codes**, not prose. Prose comes from label files (fixed text) or the AI explain endpoint. This keeps translations clean and stops the AI from changing the facts.

## 7. AI explain design

Follows the rule from file 04: **the LLM talks, the engine calculates.**

- The model receives the engine JSON and a system prompt that says to use only those facts.
- Tools available to the model: `get_chart`, `match_porondam`, `check_kuja_dosha`. No tool lets it invent positions.
- The response includes `facts_used` so the frontend can show a "based on" panel.
- Guardrails in v0.1: disclaimer on every answer, refuse to give a marriage yes or no, no fear based predictions, drop astrology framing and show help information on self harm, abuse or medical emergency.
- User free text (names, questions) is passed as data, separated from instructions.
- Rate limit per IP (for example 10 explanations per day anonymous) to control cost.
- Conversations are not stored. Only counts and thumbs up or down are logged.

## 8. Accuracy and testing (the most important part)

1. **Golden set**: 30 real charts and 15 matches, checked by a practising Sri Lankan astrologer. Stored as JSON in `tests/golden/`. CI fails if any value changes.
2. **Cross check**: compare 30 charts against two independent sources (for example DrikPanchang and a competitor) for lagna, nakshatra, pada and graha signs.
3. **Time zone tests**: births in Sri Lanka across 1995 to 2007, near midnight, and abroad (UK, Australia, Middle East).
4. **Boundary tests**: births within a few minutes of a nakshatra or lagna change. The API should warn when a small birth time error would change the result.
5. **Rule review**: the astrologer signs off each YAML rule file. The version string goes into every response.
6. **AI evaluation**: 50 Sinhala and 50 English questions. An automated check confirms every planet, sign and factor mentioned in an answer matches the engine output.

## 9. Milestones

Assumes one developer working part time. Adjust to your pace.

| Week | Deliverable |
|---|---|
| 1 | Repo setup (uv, FastAPI skeleton, ruff, mypy, pytest, CI, Docker). Ephemeris interface and Swiss Ephemeris adapter. Time conversion with historical tz. |
| 2 | Chart engine: lagna, houses, grahas, nakshatra, pada, navamsha. First golden tests. Place search with Sri Lankan towns. |
| 3 | Vimshottari dasha. `/v1/charts` and SVG chart. Sinhala and English labels. |
| 4 | Porondam engine and YAML rule format. Confirmed factors, hard checks, quick match by birth star. |
| 5 | Kuja dosha with cancellations. Remaining factors once the astrologer list arrives. `/v1/porondam`. |
| 6 | AI explain endpoint, guardrails, caching, rate limits. Model comparison on Sinhala quality. |
| 7 | Accuracy pass with the astrologer. Fix differences. Load and security checks. Privacy policy text. |
| 8 | Deploy to staging, connect a minimal frontend, soft launch to 20 to 50 test users. |

### After v0.1

- **v0.2**: accounts (phone OTP or Google), saved profiles, proposal manager, PDF report, nakath finder, daily palapala from real transits.
- **v0.3**: payments (PayHere or similar), premium report, unlimited chat plan.
- **v0.4**: astrologer review and marketplace, WhatsApp bot, Sinhala voice.

## 10. Blockers and decisions needed

| # | Question | Needed by |
|---|---|---|
| 1 | Who is the practising astrologer who will validate rules and the golden set? | Week 2 |
| 2 | The authoritative list of 20 porondam factors and their rules | Week 4 |
| 3 | Ayanamsa default: Lahiri or Thirukanitham? | Week 2 |
| 4 | Kuja dosha house list and cancellation rules | Week 5 |
| 5 | Ephemeris licence: AGPL open source or commercial licence | Before public launch |
| 6 | AI provider and model, after the Sinhala test | Week 6 |
| 7 | Tamil porutham in v0.1 or v0.2? | Week 4 |
| 8 | Frontend: who builds it, and with what (web first is assumed) | Week 6 |

## 11. Risks

| Risk | Mitigation |
|---|---|
| Wrong charts destroy trust | Golden set, cross checks, boundary warnings, astrologer sign off |
| Rule disagreements between traditions | Rules in versioned config, method shown to users |
| AI invents facts | Grounding in engine JSON, automated fact check, `facts_used` panel |
| AI cost grows | Rate limits, caching, cheaper model for fixed explanations |
| Sensitive data leak | Stateless by default, no birth data in logs or URLs, clear privacy text |
| Licence trouble | Ephemeris behind an interface, decide before launch |
