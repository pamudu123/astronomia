# Free and Paid Features

Date: 2026-11-11

This file records the product decisions made after the first release plan (file 06). It says what every user gets, what paid users get on top, and what that means for the build.

## 1. Decisions made so far

| Topic | Decision |
|---|---|
| Features in the first release | Hadahan and porondam |
| Languages | Sinhala and English |
| Audience | Worldwide, not only Sri Lanka |
| Ephemeris | Swiss Ephemeris for now. Buy the licence (CHF 700) or publish the code before public launch |
| Look | Night sky design (see `design/README.md`) |
| Explanations | Short rule based reasons for everyone. Detailed rule based and AI explanations for paid users |
| PDF report | For everyone. Paid users get the explanations in it |
| Added to the first release | Kuja dosha deep check, dasha detail, personal forecast and alerts, share link, bilingual PDF. Each has a free level and a more detailed paid level |
| After the first release | Other services, starting with baby name letters from the birth star |

## 2. The rule for free and paid

- **Free shows the facts and a one line reason.** A free result must still be better than a competitor's free result, or nobody stays long enough to pay.
- **Paid adds depth.** More levels of detail, the reasoning behind each rule, and AI written explanations grounded in the computed chart.
- **The engine output is the same for both.** Free and paid differ only in how much of it is returned and explained. There is no separate "paid calculation".

## 3. Free and paid at a glance

| Feature | Free | Paid adds |
|---|---|---|
| Hadahan | Lagna, rashi, nakath and pada, nine planets, kendara drawing (rashi and navamsha), birth time check | Detailed reading of each placement |
| Porondam | Score, every factor with pass or fail and a one line reason, Rajju and Vedha shown separately, quick match by birth star | Detailed explanation of each factor (rule based and AI) |
| Kuja dosha | Present or not, from which point (lagna, Moon, Venus), which house, one line reason | Every cancellation rule checked, strength, couple comparison, explanation |
| Dasha | Main periods with dates, current main and sub period | All sub periods, third level for the current period, what each period means for this chart |
| Forecast | This month's overview for your lagna. Planet change pages (Rahu, Ketu, Saturn, Jupiter) for every lagna | Twelve month personal forecast, yearly forecast by lagna, key dates, alerts |
| Share | Link and WhatsApp share of the free result | Link shows the full paid result to whoever opens it |
| PDF | Facts, drawings and one line reasons, in Sinhala or English | Full explanations, all paid sections, both languages in one file |
| AI | None | "Explain this" on any result, and questions about the chart |

## 4. The five added features in detail

### 4.1 Kuja dosha deep check

| | Free | Paid |
|---|---|---|
| Result | Present or not present | Same |
| Where from | Checked from lagna, Moon and Venus, with the house Mars is in | Same, plus how many of the three points show it (strength) |
| Reason | One line, for example "Mars is in the 12th house from the lagna" | Same |
| Cancellations | A note that cancellations exist | **Every cancellation rule listed**, each marked "applies" or "does not apply" with the chart fact behind it |
| For a couple | Both people shown side by side | Whether the two charts balance each other, with the reasoning |
| Explanation | None | Plain language explanation, and questions to take to an astrologer |

Notes:
- The house list and cancellation rules live in the rule file and need the astrologer's sign off (sources disagree, see file 03).
- No fear selling. The wording must stay calm and must not recommend remedies or purchases.

### 4.2 Dasha detail

| | Free | Paid |
|---|---|---|
| Main periods (maha dasha) | All, with start and end dates, as a timeline | Same |
| Current position | Current main period and sub period | Same |
| Sub periods (antar dasha) | Only the current one | All sub periods for every main period, with dates |
| Third level (pratyantar) | None | For the current sub period |
| Meaning | None | For each period: the ruling planet's sign, house and condition in this chart, and what that suggests |
| Explanation | None | AI summary of the current and next period |

### 4.3 Personal forecast and alerts

Built from real planet movements (transits) against the person's own chart, not generic text.

| | Free | Paid |
|---|---|---|
| Period covered | The current month | The next twelve months, month by month |
| Content | Where the slow planets (Saturn, Jupiter, Rahu, Ketu) are, counted from your lagna, one line each | The same for each month, plus planets crossing your birth positions, Saturn periods counted from your Moon, and dasha changes inside the year |
| Key dates | None | A list of dates when something changes (a planet changes sign, a new sub period starts) |
| Alerts | None | Email before each key date. WhatsApp later |
| Explanation | None | AI written summary for the year and for each month |

Notes:
- Alerts need a saved profile, so they are opt in. See section 5.
- Predictions stay general ("a period that favours steady work"), never alarming and never about health, death or legal outcomes.

### 4.4 Share link and WhatsApp share

| | Free | Paid |
|---|---|---|
| Share button | Copy link, share to WhatsApp | Same |
| What the link opens | The free result | The full paid result, so the family and the astrologer see the explanations without paying again |
| Link preview | Picture, names (optional) and a one line summary | Same |
| Control | Hide names, delete the link | Same, plus choose how long the link lives |

Notes:
- A link is created only when the user presses Share. Nothing is saved before that.
- The link stores a snapshot of the result. It expires (30 days by default) and can be deleted at any time.
- The link is a long random code and is not listed anywhere. Search engines are told not to index it.

### 4.5 PDF report

| | Free | Paid |
|---|---|---|
| Hadahan pages | Summary, kendara drawings (rashi and navamsha), planets table, main dasha timeline, Kuja dosha result | Adds the detailed reading, Kuja dosha deep check, full dasha tables, twelve month forecast |
| Porondam pages | Both charts, score, factor table with one line reasons, Rajju and Vedha, Kuja dosha for both | Adds the detailed explanation of each factor and the couple's Kuja dosha comparison |
| Language | Sinhala or English | Both languages in one file, if wanted |
| Layout | Print ready A4, traditional kendara drawing, method and rule set version on the last page | Same |
| Branding | Site name and address on each page | Same, with a cleaner footer |

Notes:
- The PDF must render Sinhala correctly. This needs testing early, because many PDF tools break Sinhala letters.
- The last page always carries the disclaimer and the method used (ayanamsa, rule set version).

### 4.6 Planet changes and the yearly forecast (2026-11-13)

| | Free | Paid |
|---|---|---|
| Planet change pages | Every Rahu, Ketu, Saturn and Jupiter change, for each lagna, and for your own lagna and Moon sign | Same |
| Yearly forecast by lagna | **Open to everyone for now** | The yearly forecast is a paid feature |

Notes:
- The planet change pages stay free. They bring search traffic.
- The yearly forecast is paid by decision, but built open until payments exist. Its code is kept apart so the lock goes in one place on each side:
  - Backend: `yearly_access()` in `backend/app/api/yearly.py`. Every yearly endpoint depends on it. A test proves that locking it locks every yearly endpoint and leaves the change pages open.
  - Frontend: `YearlyGate` in `frontend/components/yearly/YearlyGate.tsx`. Every yearly page and the "Your 2027" link on the hadahan go through it.
- The 12 general yearly pages stay public for now, for search. When the lock comes, the choice is to keep them public and lock only the personal version, or lock both.

### 4.7 Nakath (2026-11-13)

| | Free | Paid |
|---|---|---|
| Daily nakath (sunrise, Rahu kalaya, thithi, nakatha, yoga, karana) | Any place, any date | Same |
| Avurudu nakath | The official list and our times, in any time zone | Same |
| Wedding nakath finder | **Open to everyone for now** | Paid feature |
| Old horoscope search (set E) | **Free for now** | May become paid |

Notes:
- Daily nakath and Avurudu stay free. They bring search traffic.
- The wedding nakath finder is paid by decision, but built open until payments exist. Its code is kept apart so the lock goes in one place on each side:
  - Backend: `wedding_access()` in `backend/app/api/wedding.py`. The finder endpoint depends on it. A test proves that locking it locks the finder and leaves the daily and Avurudu nakath open.
  - Frontend: `WeddingGate` in `frontend/components/wedding/WeddingGate.tsx`. The finder on the porondam result goes through it.
- The old horoscope search is free for now. It is kept apart so a paid check can go in one place: `kendara_access()` in `backend/app/api/kendara.py`, and the page in `frontend/components/kendara/`.

### 4.8 Baby and child (2026-11-13)

| | Free | Paid |
|---|---|---|
| Baby name letters from the birth star | Everything | |
| Name suggestions | Everything | |
| First letters ceremony nakath | **Open to everyone for now** | May become paid later |

Notes:
- The letters and names are free. They bring search traffic.
- The ceremony finder keeps its own files, components and endpoint, so a paid check can go in one place on each side later if wanted:
  - Backend: `first_letters_access()` in `backend/app/api/first_letters.py`. The finder endpoint depends on it. A test proves that locking it locks the finder and leaves the letters and names open.
  - Frontend: `FirstLettersGate` in `frontend/components/firstletters/FirstLettersGate.tsx`. The finder page goes through it.

## 5. What paid features need

Paid tiers change the first plan in three ways.

1. **Accounts and payments.** Someone has to be recognised as paid. The simplest path is email or Google sign in, plus a payment gateway (a local one such as PayHere for LKR, and a card gateway for USD).
2. **Some stored data, always by choice.** The site stays "nothing stored" by default. Data is saved only when the user asks for something that needs it:

   | User action | What is stored | For how long |
   |---|---|---|
   | Presses Share | A snapshot of that result | Until it expires or is deleted |
   | Turns on alerts | Birth details and email | Until alerts are turned off |
   | Buys a report or subscribes | Account, payment record, what was bought | As long as the account exists |

3. **A delete button.** Every stored item can be deleted by the user.

### Decisions still needed

| # | Question | Options |
|---|---|---|
| 1 | How do people pay? | Pay per report, a subscription, or both. The market check (section 7) suggests both: per report for porondam, subscription for forecast and alerts |
| 2 | Prices | To be tested. Local software reports were seen around LKR 1,000. Human reports run from LKR 1,900 to LKR 9,900 |
| 3 | Payment gateways | Local gateway for LKR, card gateway for USD |
| 4 | Sign in method | Email link, Google, or phone OTP |
| 5 | Default life of a share link | 30 days suggested |

## 6. After the first release

Other services, in the order discussed:

1. Baby name letters from the birth star (free, brings search traffic)
2. Wedding nakath finder for a matched couple
3. Proposal manager: save family profiles and compare several proposals
4. Astrologer reviewed report
5. Tamil language and Tamil porutham

Not planned: selling remedies, gemstones or pujas.

## 7. Market check (2026-11-11)

From web search summaries only. The sites could not be opened from the research environment, so check each one before relying on it.

| Platform | Free | Paid |
|---|---|---|
| AstroSage (India) | Chart, matching, PDF downloads of both | Premium reports, astrologer calls |
| ClickAstro (India) | Basic chart | Detailed reports, reported at ₹199 to ₹5,100. One app listing shows an in depth report at $10.99. A headline on island.lk says it launched a full length Sinhala report (not confirmed) |
| Prokerala (India) | Chart and matching, with a choice of Kerala, Tamil or Guna Milan systems | Not found |
| GaneshaSpeaks, Astroyogi, AstroTalk (India) | Matching score and dosha flags | Remedies, per minute astrologer chat (reported ₹20 to ₹100 and up per minute) |
| Grahachara (Sri Lanka) | Not confirmed | Porondam report at LKR 1,000, sold separately from its Pro subscription |
| Kendra.lk (Sri Lanka) | First chat reported free | Matching report at Rs 1,900 on offer, Rs 2,500 regular |
| Astrologer.lk (Sri Lanka) | None found | Human match making at Rs 6,000 |
| Mobitel (Sri Lanka) | None found | Horoscope by subscription, porondam as a one time charge |
| Jyothishya app (Sri Lanka) | Some features | Monthly or yearly subscription |

What this shows:

- A free PDF is already normal, so it matches the market but does not set the site apart.
- Porondam is often sold per report, because people match only a few times in their lives.
- Nobody charges for the score. The paid layer is depth or a human.

Sources:

- [AstroSage Kundli app listing](https://mwm.ai/apps/astrosage-kundli-ai-astrology/824705526)
- [12 Best Free Kundli Software (Techjockey)](https://www.techjockey.com/blog/?p=10258)
- [KundliGPT vs Clickastro comparison](https://kundligpt-astro.pages.dev/en/compare/kundligpt-vs-clickastro)
- [ClickAstro Kundali app listing](https://apps.apple.com/us/app/-/id1444986768)
- [Clickastro Sinhala report headline (island.lk)](https://island.lk/clickastro-launches-full-length-horoscope-report-in-sinhala/)
- [5 Most Accurate Kundli Matching Websites In India (Free Press Journal)](https://www.freepressjournal.in/focused-view/5-most-accurate-kundli-matching-websites-in-india)
- [Top 10 Kundli Matching Apps in India (Hans India)](https://thehansindia.com/horoscope/top-10-kundli-matching-apps-in-india-1033240)
- [Best Kundli Matching Apps (Sunday Guardian)](https://sundayguardianlive.com/brand-desk/best-kundli-matching-apps-top-10-picks-for-accurate-marriage-compatibility-260323/)
- [What is AstroTalk and How Does It Work (Miracuves)](https://miracuves.com/blog/what-is-astrotalk-how-it-works/)
- [Grahachara](https://grahachara.com/)
- [Kendra.lk horoscope matching](https://kendra.lk/horoscopes-matching/)
- [Astrologer.lk match making](https://www.astrologer.lk/astrologer-services/110-horoscope-match-making-porondam)
- [Kapruka guide to online astrology services](https://blog.kapruka.com/online-horoscope-astrology-services-sri-lanka/)
- [Mobitel Porondam Service](https://www.mobitel.lk/porondam-service)
- [Jyothishya App (App Store)](https://apps.apple.com/app/id1459372211)
