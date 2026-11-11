# Feature Recommendations for Your Website

Built on the competitor findings in `01-competitor-research.md`. These are suggestions for you to react to, not decisions.

## Must have (MVP)

1. **Birth chart (hadahan) generator**
   - Inputs: name, date, exact time, birth place (Sri Lanka districts and towns prefilled, plus worldwide search)
   - Output: lagna, rashi, nakath with paadaya, planet positions, navamsha, vimshottari dasha
   - Sinhala and English labels
   - Traditional Sri Lankan chart layout, printable and PDF export
2. **Porondam matching**
   - Two birth charts, or two birth stars for a quick check
   - The 20 item visi porondam with a per factor result and short explanation
   - Pass or fail rules shown clearly (Rajju, Vedha) apart from the total score
   - Kuja dosha check for both people
   - Tamil porutham as an optional view
3. **Language**: Sinhala first, English second, Tamil later. Correct Sinhala Unicode and a good Sinhala font.
4. **Privacy**: clear statement on what is stored, delete my data button, no storage by default for anonymous use.
5. **Mobile first and fast**, since most Sri Lankan traffic is on phones.
6. **SEO pages** in Sinhala and Sinhala transliteration (porondam, galapima, kendara, hadahan, jathaka).

## Should have (v2)

- Daily and monthly palapala by lagna
- Nakath finder for events (marriage, new house, business start, naming, first rice, first letters)
- Baby name letters from birth star
- Rahu kalaya and daily auspicious times
- Save profiles, compare several proposals side by side, share a result link with family
- Accounts with sign in by phone number (OTP) or Google
- Sri Lanka calendar (dina potha) with poya days and holidays

## Could have (later)

- Verified astrologer directory and paid consultation booking
- Premium detailed report (freemium)
- Mobile app (Android first)
- WhatsApp share and WhatsApp bot
- Diaspora features: timezone and historical DST handling, foreign birth places
- Admin tools for astrologers to review and annotate a report

## Differentiators worth considering

- **Explain every factor** in plain Sinhala and show the method, so users trust the result.
- **Transparent settings**: show the ayanamsa used and allow an "advanced" switch.
- **Proposal manager** for families comparing many matches.
- **Astrologer in the loop**: a result you can send to an astrologer for review.

## Accuracy plan (important)

Wrong charts destroy trust in this domain. Suggested approach:

1. Use a proven ephemeris library (for example Swiss Ephemeris) rather than hand coded astronomy. Check its licence (AGPL or commercial) before using it in a public website.
2. Decide the ayanamsa up front (Lahiri is common in Sri Lanka; MyStar claims Thirukanitham). Make it configurable and document it.
3. Handle Sri Lanka's historical time zones. Sri Lanka has changed its offset several times (it moved between +5:30, +6:00 and +6:30 during 1996 to 2006, so verify against the tz database). Use the IANA tz database.
4. Build a test set of 20 to 30 real charts and matches checked by a practising Sri Lankan astrologer. Compare against at least two competitors.
5. Have an astrologer sign off on the 20 factor rules and scoring thresholds. Sources disagree on details (for example Kuja dosha house lists differ between sources).

## Business model options

| Model | Notes |
|---|---|
| Free with ads | Common among competitors, low revenue per user |
| Freemium premium reports | Iranama appears to do this |
| Astrologer marketplace (commission) | Higher value, needs trust and verification |
| Telecom or SMS subscription | Mobitel did this, harder to enter |
| Diaspora premium | Higher willingness to pay |

## Open questions for you

1. Which tradition: Sinhala only, or Sinhala and Tamil?
2. Sri Lankan style charts only, or also South and North Indian styles?
3. Do you have a practising astrologer who can validate the rules?
4. Free site, freemium, or marketplace?
5. Tech stack and hosting preferences?
6. Do you plan to store user data (accounts) from day one?
