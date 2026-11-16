---
name: site-guide
description: Every page on Sidera, what it needs, what it shows, and how to read the page the person has open from its address. Read when the person asks about a page other than a match result, asks what the site can do, or needs to be sent to the right tool.
---

# The site, page by page

Every tool is free. The plans page says "coming soon".

The App Context `page` is either a result name set by the page (such as `chart_result`) or the address without the language (such as `changes/saturn-2027-06/mesha`). For pages that only send an address, the address tells you what is on screen: look the facts up with the matching tool, then answer.

| Address | What it is | Needs | Look it up with |
|---|---|---|---|
| `home` | Start page, with today's nakath strip and the tool groups | Nothing | `good_times_for_day` for today's date from the Today note (Colombo) |
| `hadahan` | Birth chart: rising sign, Moon sign, birth star, the nine planets, life periods (dasha), Mars check, PDF | Birth date, time and place | Page sends `chart_result` |
| `porondam` | Marriage match, factor by factor, with reasons, the Mars check, a couple timeline and wedding dates | Two people's birth details, or just their birth stars (quick match). The wedding dates search needs only a venue and a range, for either kind of match | Page sends `match_result`. Wedding dates arrive under `also_on_page.wedding` after the person searches |
| `porondam/stars` and `porondam/stars/<star>` | Which birth stars suit a star, before full charts | A birth star | `find_matching_stars` |
| `nakath` and `nakath/<YYYY-MM-DD>` | One day's almanac for a place: Rahu kalaya, thithi, nakatha, yoga, karana | A date and place | Page sends `good_times_day`; or `good_times_for_day` |
| `litha` and `litha/<YYYY-MM>` | The month at a glance, with poya days and Rahu kalaya | A month | Page sends `litha_month`; or `month_calendar` |
| `avurudu`, `avurudu/<year>`, `avurudu/<year>/<city>` | Sinhala and Tamil New Year nakath, in any time zone: the site's calculated dawn every year, and the official list when published | A year | Page sends `avurudu`; or `new_year_times` |
| `baby-names` | First letters for a baby's name from the birth, with name ideas | Baby's birth details | Page sends `baby_names_result` |
| `baby-names/<star>` | Letters for each quarter of one birth star | A birth star | `name_letters_for_star`, then `names_for_letters` |
| `first-letters` | Good times for the first letters ceremony (akuru kiyaweema) | The child's birth details, or birth star | Page sends `first_letters_result` |
| `changes` | Coming changes of Saturn, Jupiter, Rahu and Ketu | Nothing | `upcoming_planet_changes` |
| `changes/<change-id>` and `changes/<change-id>/<sign>` | One change, read for each rising sign, or for one sign | A rising sign, or birth details for a personal reading | `planet_change_for_sign`. A personal reading arrives as `planet_change_personal` |
| `forecast/<year>` and `forecast/<year>/<sign>` | The year ahead for each rising sign, month by month | A rising sign, or birth details | `year_ahead_for_sign`. A personal reading arrives as `year_ahead_personal` |
| `kendara` | Find the birth dates and times that fit an old paper horoscope | The planets as drawn on the paper chart | Page sends `old_horoscope_result` (how many fit, never the dates) |
| `tools` | Every tool, grouped by what the person is planning | Nothing | This table |
| `s/<code>` | Someone's shared chart or match. Talk about "this person" or "this couple" | Nothing | Page sends the result with `shared: true` |
| `privacy`, `terms`, `plans` | Policies; plans are coming soon | Nothing | Point to the page |

Sign ids in addresses: mesha, vrishabha, mithuna, kataka, simha, kanya, tula, vrischika, dhanu, makara, kumbha, meena.

## Sending people to the right page

- "What's my rising sign / dasha?" with no chart on screen: the birth chart page (`/hadahan`), with date, time and place of birth.
- "Do we match?": the match page (`/porondam`). With only birth stars, the quick match, or the birth star matches page.
- "Is today good?": today's nakath (`/nakath`). A whole month: the litha (`/litha`).
- Baby names: `/baby-names`. First letters ceremony: `/first-letters`. Wedding dates: the search under a match result (a quick match with birth stars is enough).
- "How will Saturn's change affect me?": `/changes`, then the person's rising sign, or their birth details for a personal reading.
- Lost birth date but an old horoscope: `/kendara`.

Give the page name the way the site does ("the birth chart page", "today's nakath"). Add the address only if it helps.

## Answering on a page without a result

The person may be looking at a page that sent only its address. Use the tool for that address to get the same facts the page shows, then answer about them. Never guess what is on screen.
