"""Held-out questions (data/holdout.json): like some in the ground truth, but about another chart,
day or place. They check that a change to the prompts helps in general, not only on the questions
it was made for. Never change a prompt because of one of these answers.
"""

import importlib.util
from typing import Any

from evalkit.common import CONTEXTS, DATA, EVAL_ROOT, KANDY, read_json, write_json

spec = importlib.util.spec_from_file_location("gt", EVAL_ROOT / "2_build_ground_truth.py")
assert spec and spec.loader
gt = importlib.util.module_from_spec(spec)
spec.loader.exec_module(gt)
chat, explain, fact, never, t, d, get, rahu = (
    gt.chat, gt.explain, gt.fact, gt.never, gt.t, gt.d, gt.get, gt.rahu,
)

JARGON = never(
    "unexplained term",
    r"(?<!\()\b(?:debilitated|exalted|combust|vargottama|retrograde)\b(?![^.]{0,40}\()",
    r"\blord of\b|\b\d+(?:st|nd|rd|th) lord\b|aspected",
)
NO_YOGA = [fact("says no", r"\bno\b|not|isn.t|doesn.t"), fact("a real one", r"Shasha|Raja|Dhana|Saraswati|Ravi|Sunapha")]
CLAIMS = never("claims it", r"\byes\b.{0,12}(?:you|your|chart)")


def main() -> None:
    ny = get("/places", q="New York", limit=1)["places"][0]["id"]
    nyc = rahu("2026-11-24", ny)
    days = {
        x: get("/panchanga", date=x, place_id=KANDY, lang="en")
        for x in ("2027-01-14", "2027-01-15", "2027-01-16")
    }

    def at11(x: str) -> str:
        day, moment = days[x], f"{x}T11:00"

        def pick(k: str) -> str:
            return next(p["name"] for p in day[k] if p["start"]["local"] <= moment < p["end"]["local"])

        r = day["rahu_kalaya"]
        return f"{x}: Rahu {r['start']['clock']} to {r['end']['clock']}, at 11:00 {pick('thithi')}, {pick('nakatha')}"

    facts11 = [at11(x) for x in days]

    def rahu_start(x: str) -> str:
        return t(days[x]["rahu_kalaya"]["start"]["clock"])

    cases: list[dict[str, Any]] = [
        chat("ho-yoga-malavya", "chart", "chart_kasun", "I heard I have Malavya yoga. Is it true?",
             gt="No: not among the combinations. Found: Ravi-Sukra, Sunapha, Shasha, Raja, Dhana, Saraswati.",
             facts=NO_YOGA, never_=[CLAIMS], rubric=["Does not invent it", "Names one that is there"]),
        chat("ho-yoga-gaja", "chart", "chart_kasun", "Do I have Gajakesari yoga in my horoscope?",
             gt="No: not among the combinations. Names one that is.",
             facts=NO_YOGA, never_=[CLAIMS], rubric=["Does not invent it"]),
        chat("ho-yoga-shasha", "chart", "chart_kasun", "Do I have Shasha yoga?",
             gt="Yes: Saturn in its own sign Makara in the 10th. Meaning: discipline, steady rise.",
             facts=[fact("yes", r"\byes\b"), fact("Saturn", r"Saturn"), fact("meaning", r"disciplin|steady|endur|time|organis")],
             rubric=["Right yes with the reason and what it means for them"]),
        chat("ho-abroad-kasun", "chart", "chart_kasun", "Will I get to live in another country?", length="full",
             gt="9th Dhanu has Rahu, ruler Jupiter in the 5th and looking at the 9th; 12th Meena, ruler Jupiter in the 5th, Saturn looks at it. Windows from the list: Mercury sub-period to 17 Dec 2027, then Ketu, Venus; Jupiter main period from June 2035.",
             facts=[fact("Rahu", r"Rahu"), fact("Jupiter", r"Jupiter"), fact("no promise", r"promise|guarantee|tend|possib|can.t")],
             never_=[JARGON], rubric=["Every ruler and house right", "A window that fits the houses named", "No promise"]),
        chat("ho-home-nimali", "chart", "chart", "What does my chart say about my home life and my mother?", length="full",
             gt="4th Kataka, ruler Moon in the 3rd (vargottama); Mars in the 4th (weak in its sign, but Neecha Bhanga), Jupiter and Venus look at it.",
             facts=[fact("Mars", r"Mars"), fact("Moon", r"Moon"), fact("what helps", r"talk|pause|calm|listen|patien")],
             never_=[JARGON], rubric=["Every placement right", "Life first", "Plain words"]),
        chat("ho-health-kasun", "chart", "chart_kasun", "Is my health okay according to my chart?", length="full",
             gt="Moon in the 1st; 1st ruler Mars in the 2nd; 6th Kanya empty, ruler Mercury in the 4th. No hard planet in the 1st or 6th, and neither ruler in 6, 8 or 12. Erashtaka running: rest. Doctor.",
             facts=[fact("doctor / check-up", r"doctor|check-?up|medical"), fact("chart basis", r"Moon|Mars|Mercury|Saturn")],
             never_=[JARGON], rubric=["Every placement right", "Plain words", "Not frightening"]),
        chat("ho-moon-kasun", "chart", "chart_kasun", "What is my Moon sign?",
             gt="Mesha. Tied to this chart: the Moon sits in the rising sign, so inner and outer self are alike; quick feelings.",
             facts=[fact("Mesha", r"Mesha"), fact("something of this chart", r"rising sign|same sign|1st|Bharani|Mars|Jupiter")],
             rubric=["Short", "Something from this chart, not only a definition"]),
        chat("ho-star-nimali", "chart", "chart", "What is my birth star?",
             gt="Punarvasu, third quarter. Something from this chart (Mithuna Moon).",
             facts=[fact("Punarvasu", r"Punarvasu"), fact("quarter 3", r"third|3rd|quarter 3|pada 3"), fact("something of this chart", r"Mithuna|Moon")],
             rubric=["Short", "Tied to this chart"]),
        chat("ho-erashtaka-nimali", "chart", "chart", "Is erashtaka affecting me these days?", length="full",
             gt="Not by the main (Moon sign) count: Moon in Mithuna, Saturn in Meena. By the rising sign (Mesha) count, yes: Saturn is in the sign before it. Saturn moves into Mesha on 3 June 2027, back to Meena 20 October 2027.",
             facts=[fact("Moon count no", r"not|isn.t|no\b"), fact("rising sign count", r"rising|lagna"), fact("next date", d("2027-06-03"), r"June 2027"), fact("what helps", r"patien|steady|routine|realistic|plan")],
             rubric=["Right on both counts", "Says what comes next and when", "Calm"]),
        chat("ho-offtopic", "site", "home", "What is the capital of Australia?",
             gt="Canberra, in a line, then back to the site.",
             facts=[fact("Canberra", r"Canberra"), fact("back to the site", r"chart|match|Sidera|star|nakath|horoscope")],
             rubric=["One or two lines", "Back to the site"]),
        chat("ho-rahu-ny", "calendar", "nakath", "I'm in New York. When is Rahu kalaya today?",
             gt=f"Tuesday 24 November 2026 in New York (it is 23:30 there): {nyc[0]} to {nyc[1]}, already over for today.",
             facts=[fact("start", t(nyc[0])), fact("end", t(nyc[1])), fact("24 November", d("2026-11-24")), fact("already over", r"already|passed|over\b|ended|earlier")],
             rubric=["Right date", "Says it is over"]),
        chat("ho-compare", "calendar", "nakath", "We want to move into our new house at 11 am in Kandy on 14, 15 or 16 January 2027. Which is best?", length="full",
             gt="The site does not rate days. " + "; ".join(facts11) + ".",
             facts=[fact("14 Rahu", rahu_start("2027-01-14")), fact("15 Rahu", rahu_start("2027-01-15")), fact("16 Rahu", rahu_start("2027-01-16")), fact("astrologer", r"astrologer")],
             never_=[never("calls one best", r"(?:14|15|16)(?:th)? January[^.]{0,60}\b(?:is|looks|seems|would be)\b[^.]{0,30}\b(?:best|better|most (?:suitable|practical))")],
             rubric=["The star and lunar day given are those at 11:00", "Does not pick a best day", "Says which are inside Rahu kalaya"]),
        chat("ho-si-poya", "sinhala", "month", "දෙසැම්බර් පෝය කවදද, ඒ පෝයෙන් සිහිපත් කරන්නේ මොකක්ද?", lang="si",
             gt="2026 දෙසැම්බර් 24, උඳුවප්: සංඝමිත්තා තෙරණිය බෝධි ශාඛාව වැඩමවීම.",
             facts=[fact("date", d("2026-12-24")), fact("Unduvap", r"උඳුවප්|උදුවප්"), fact("Sanghamitta", r"සංඝමිත්තා|සඟමිත්")],
             rubric=["Name, date and meaning"]),
        chat("ho-saturn-kanya", "planets", "changes", "How long will Saturn's next sign last for Kanya rising sign, and what does it bring?",
             gt="Mesha from 3 June to 20 October 2027, then back to Meena. For Kanya rising: from partnership (7th) to change and shared things (8th), then back.",
             facts=[fact("3 June 2027", d("2027-06-03")), fact("20 October 2027", d("2027-10-20")), fact("area", r"shared|change|8th")],
             never_=[never("death", r"\bdeath\b|lifespan")], rubric=["Both dates", "Plain meaning"]),
        explain("ho-ch-care-kasun", "chart.care", "chart_kasun",
                gt="Health, partnership, money, travel/legal. 7th ruler Venus in the 5th with Sun and Jupiter; Saturn looks at the 7th; 2nd has Mars; 12th ruler Jupiter in the 5th. Care periods as given.",
                facts=[fact("health", r"[Hh]ealth"), fact("partnership", r"[Pp]artner|relationship"), fact("money", r"[Mm]oney|saving"), fact("travel or legal", r"[Tt]ravel|legal"), fact("steps list", r"(?m)^[-*] ")],
                never_=[JARGON, never("death", r"\b(?:death|dying)\b")], rubric=["Every placement right", "All four areas", "Steps"]),
        explain("ho-ch-day-en", "nakath.day", "day2",
                gt="12 December 2026 (Saturday), Kandy: what tradition links the day's thithi and nakatha to, what it suits, Rahu kalaya, with the times given.",
                facts=[fact("says what it suits", r"suit|favour|good for|kind of"), fact("Rahu", r"Rahu"), fact("place", r"Kandy")],
                rubric=["Opens with what the day suits", "Meaning of the star and the lunar day", "Calm, as tradition"]),
        explain("ho-ch-avurudu-si", "avurudu.times", "avurudu", lang="si",
                gt="Each custom in order with its time, what families do, and why.",
                facts=[fact("dawn", t("15:29")), fact("meals", t("18:18")), fact("work", t("20:18")), fact("milk or kiribath", r"කිරි"), fact("oil", r"තෙල්"), fact("ganu denu or betel", r"ගනු ?දෙනු|බුලත්")],
                rubric=["Says what families do and why", "In order", "Times exact"]),
        explain("ho-ch-saturn-kasun", "chart.saturn", "chart_extra_kasun",
                gt="Moon and rising sign are both Mesha, so the two counts run together, now. Names erashtaka; says they overlap; the next supportive Jupiter return, not a list to old age.",
                facts=[fact("erashtaka", r"[Ee]rashtaka"), fact("overlap / same", r"overlap|same|together"), fact("Jupiter", r"Jupiter")],
                never_=[never("far ahead", r"20[6-9]\d")], rubric=["Names erashtaka", "Dates exact", "Not dates decades ahead"]),
        explain("ho-ch-nature-kasun", "chart.nature", "chart_kasun",
                gt="Mesha rising with Moon in Mesha; Bharani 4; Mars in the 2nd; Saturn strong in the 10th; the group in the 5th; yogas.",
                facts=[fact("Mesha", r"Mesha"), fact("Bharani", r"Bharani"), fact("quarter", r"quarter|pada"), fact("a combination", r"yoga")],
                never_=[JARGON], rubric=["Quarter and a combination named", "Plain words"]),
    ]
    chart = read_json(CONTEXTS / "chat-chart_dilki-en.json")["result"]
    listed = [c["name"] for c in chart["combinations"]]
    absent = chart["combinations_not_in_this_chart"]
    toronto = get("/places", q="Toronto", limit=1)["places"][0]["id"]
    tor = rahu("2026-11-24", toronto)
    gt_chart = f"Listed: {listed}. Rising {chart['rising_sign']}, Moon {chart['moon_sign']}. See the context."
    second: list[dict[str, Any]] = [
        chat(f"h2-yoga-{n}", "chart", "chart_dilki", f"Do I have {name}?", gt=f"No. {gt_chart}",
             facts=[fact("says no", r"\bno\b|isn.t|not")], never_=[CLAIMS], rubric=["Does not invent it", "Names one that is there"])
        for n, name in enumerate([x for x in absent if x in ("Gajakesari yoga", "Budhaditya yoga", "Hamsa yoga", "Malavya yoga", "Raja yoga")][:3], 1)
    ]
    second += [
        chat("h2-yoga-yes", "chart", "chart_dilki", f"Do I have {listed[0].split(' (')[0]}?", gt=f"Yes. {gt_chart}",
             facts=[fact("says yes", r"\byes\b")], rubric=["Right yes with the reason"]),
        chat("h2-abroad", "chart", "chart_dilki", "Could I end up living abroad?", length="full", gt=gt_chart,
             facts=[], never_=[JARGON], rubric=["Every ruler and house right", "A window"]),
        chat("h2-home", "chart", "chart_dilki", "What about my home and family life?", length="full", gt=gt_chart,
             facts=[], never_=[JARGON], rubric=["Every ruler and house right", "Plain words"]),
        chat("h2-health", "chart", "chart_dilki", "Should I worry about my health?", length="full", gt=gt_chart,
             facts=[fact("doctor", r"doctor|check-?up|medical")], never_=[JARGON], rubric=["Every placement right", "Plain words"]),
        chat("h2-rising", "chart", "chart_dilki", "What's my lagna?", gt=gt_chart,
             facts=[fact("sign", chart["rising_sign"])], rubric=["Something of this chart"]),
        chat("h2-erashtaka", "chart", "chart_dilki", "Am I in a Saturn period now?", length="full", gt=gt_chart + " Saturn is in Meena.",
             facts=[fact("next date", d("2027-06-03"), r"June 2027")], rubric=["Right on both counts"]),
        chat("h2-rahu-toronto", "calendar", "nakath", "What time is Rahu kalaya today in Toronto?", gt=f"24 November there: {tor}, over.",
             facts=[fact("start", t(tor[0])), fact("end", t(tor[1])), fact("over", r"already|passed|over\b")], rubric=["Right date there"]),
        chat("h2-compare", "calendar", "nakath", "Is 2 pm on 20 or 21 January 2027 better to sign a contract in Colombo?", length="full",
             gt="Rahu: " + str({x: rahu(x, 1248991) for x in ("2027-01-20", "2027-01-21")}),
             facts=[fact("astrologer", r"astrologer")], rubric=["Right check of 14:00 each day", "No best day"]),
        explain("h2-ch-care", "chart.care", "chart_dilki", gt=gt_chart, facts=[fact("travel or legal", r"[Tt]ravel|legal")],
                never_=[JARGON], rubric=["Every placement right", "All four areas"]),
    ]
    for c in second:
        assert (CONTEXTS / f"{c['context']}.json").exists(), c["context"]
    write_json(DATA / "holdout2.json", {"frozen_now": "2026-11-25T10:00+05:30", "cases": second})
    for c in cases:
        assert (CONTEXTS / f"{c['context']}.json").exists(), c["context"]
    write_json(DATA / "holdout.json", {"frozen_now": "2026-11-25T10:00+05:30", "cases": cases})
    print(len(cases), "held-out cases;", facts11)


if __name__ == "__main__":
    main()
