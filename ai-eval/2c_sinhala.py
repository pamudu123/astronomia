"""The Sinhala fluency set (data/sinhala.json): everyday Sinhala questions of different kinds, from
casual to formal, short to long, worried to curious. Marked for facts like any other answer, and
for Sinhala (RUBRIC.md)."""

import importlib.util
from typing import Any

from evalkit.common import CONTEXTS, DATA, EVAL_ROOT, write_json

spec = importlib.util.spec_from_file_location("gt", EVAL_ROOT / "2_build_ground_truth.py")
assert spec and spec.loader
gt = importlib.util.module_from_spec(spec)
spec.loader.exec_module(gt)
fact, t, d = gt.fact, gt.t, gt.d


def si(id: str, context: str, question: str | list[str], **kw: Any) -> dict[str, Any]:
    return gt.chat(id, "sinhala", context, question, lang=kw.pop("lang", "si"), answer_lang="si", **kw)


def main() -> None:
    tomorrow = gt.rahu("2026-11-26", 1248991)
    cases = [
        si("sf-lagna", "chart_kasun", "මගේ ලග්නය මොකක්ද? ඒකෙන් මං ගැන මොනවද කියන්නේ?",
           gt="මේෂ ලග්නය; අධිපති කුජ 2 වෙනි ගෘහයේ (පවුල, කතාව, ඉතුරුම්); චන්ද්‍රයා ලග්නයේම.", facts=[fact("මේෂ", "මේෂ")], rubric=["Short", "Spoken Sinhala", "Tied to this chart"]),
        si("sf-dasha", "chart", "මට දැන් තියෙන දශාව හොඳද නරකද?", length="full",
           gt="බුධ දශාව 2038 ජූනි 26 දක්වා, සිකුරු අතුරු දශාව 2027 සැප්තැම්බර් 19 දක්වා, ඊළඟට රවි.", facts=[fact("බුධ", "බුධ"), fact("සිකුරු", "සිකුරු|ශුක්"), fact("2027", "2027")], rubric=["Neither good nor bad", "Right dates", "Calm"]),
        si("sf-abroad", "chart_kasun", "මට රට යන්න පුළුවන් වෙයිද?", length="full",
           gt="9 වෙනි ගෘහයේ රාහු; 9 සහ 12 අධිපති ගුරු 5 වෙනි ගෘහයේ; රාහු දශාව 2035 ජූනි දක්වා, බුධ අතුරු 2027 දෙසැම්බර් 17 දක්වා.", facts=[fact("රාහු", "රාහු"), fact("ගුරු", "ගුරු")], rubric=["Right placements", "No promise"]),
        si("sf-rajju", "match_quick", "අපේ පොරොන්දම්වල රජ්ජු ගැළපෙන්නේ නැහැ කියලා තියෙනවා. අම්මලා බයයි. මොකද කරන්නේ?", length="full",
           gt="දෙදෙනාම කණ්ඨ රජ්ජු (රෙහෙණ, හත); බරපතල ලෙස සලකයි; කරුණු 16 න් 11; සන්සුන්ව, පවුල සහ ජ්‍යොතිෂවේදියෙකු; මරණය ගැන නොකියයි.", facts=[fact("රජ්ජු", "රජ්ජු"), fact("astrologer", "ජ්.?ය[ොෝ]තිෂ")], never_=[gt.never("death", "මරණ|මැරෙ|වැන්දඹු|ආයුෂ")], rubric=["Calms the parents", "Honest", "Next step"]),
        si("sf-rahu", "nakath", "හෙට කොළඹ රාහු කාලය කීයටද? අලුත් වැඩක් පටන් ගන්න ඕන.",
           gt=f"2026 නොවැම්බර් 26: {tomorrow[0]} සිට {tomorrow[1]}.", facts=[fact("start", t(tomorrow[0])), fact("end", t(tomorrow[1]))], rubric=["Exact", "Short"]),
        si("sf-erashtaka", "chart_kasun", "ඒරාෂ්ටකය කියන්නේ මොකක්ද? මට දැන් ඒක තියෙනවද?", length="full",
           gt="ඔව්: මේෂ චන්ද්‍ර රාශිය, සෙනසුරු මීන රාශියේ, පළමු කොටස; 2027 ජූනි 3 මේෂයට, 2027 ඔක්තෝබර් 20 නැවත මීනයට.", facts=[fact("yes", "ඔව්|තියෙනවා|පවතිනවා|ගෙවෙ"), fact("2027 June", d("2027-06-03"))], rubric=["Explains simply", "Right dates", "Calm"]),
        si("sf-poruwa", "home", "පෝරුවේ චාරිත්‍ර ගැන සරලව කියන්න.", length="full",
           gt="පෝරුවට නැගීම (දකුණු පය), බුලත්, අෂ්ටක, ඇඟිලි බැඳීම, පැන් වත් කිරීම, තෑගි, බැසීම; පවුල අනුව වෙනස්.", facts=[fact("බුලත්", "බුලත්"), fact("water", "පැන්|වතුර|ජල")], rubric=["In order", "Natural ceremony words"]),
        si("sf-avurudu", "avurudu", "2027 අවුරුදු නැකත් මොනවද? ළමයින්ට තේරෙන විදිහට කියන්න.", length="full",
           gt="උදාව 15:29, පුණ්‍ය කාලය 09:05–21:53, ආහාර පිසීම 18:18, වැඩ ඇල්ලීම 20:18, තෙල් 17 දා 07:04, පිටත්වීම 21 දා 06:15, පැළ 22 දා 11:38.", facts=[fact("dawn", t("15:29")), fact("work", t("20:18")), fact("oil", t("07:04"))], rubric=["Simple for children", "Times exact"]),
        si("sf-baby", "baby-names", "මගේ බබා රෙහෙණ නැකතේ දෙවෙනි පාදයේ ඉපදුණේ. නමේ මුල් අකුර මොකක්ද?",
           gt="ව, සහ ච.", facts=[fact("ව", "ව"), fact("ච", "ච")], rubric=["Short", "Both letters"]),
        si("sf-sad", "chart", "මගේ කේන්දරේ නරකයි කියලා ගමේ කෙනෙක් කිව්වා. මට ගොඩක් දුකයි.", length="full",
           gt="මුලින්ම සැනසීම; කිසිම කේන්දරයක් හොඳ හෝ නරක විතරක් නොවේ; සැබෑ ශක්තියක් (සෙනසුරු ස්වක්ෂේත්‍ර, රාජ යෝගය); මොකක්ද බය කළේ කියලා අසයි.", facts=[fact("comfort", "දුක|තේරෙන|සැනස|හිත")], rubric=["Warm first", "A real strength", "No doom"]),
        si("sf-formal", "chart", "මගේ දියණියගේ විවාහය සඳහා මෙම කේන්දරය අනුව සුදුසු කාලයක් පවතී ද?", length="full",
           gt="නිශ්චිත දිනයක් නොවේ; සිකුරු අතුරු දශාව 2027 සැප්තැම්බර් 19 දක්වා; දියණිය ගැන කතා කරයි (ඔබ නොවේ).", facts=[fact("සිකුරු", "සිකුරු|ශුක්"), fact("2027", "2027")], rubric=["Polite, matches the formal question", "Speaks of the daughter"]),
        si("sf-singlish", "chart", "mage rakiyawa gana kiyanna puluwanda? mama dan job eka maru karanna hithan inne", lang="en", length="full",
           gt="Sinhala script. සෙනසුරු ලාභ ස්ථානයේ, සිකුරු රැකියා ස්ථානයේ; සිකුරු අතුරු දශාව 2027 සැප්තැම්බර් 19 දක්වා; තීරණය කරුණු බලා.", facts=[fact("Sinhala script", r"[඀-෿]{3,}"), fact("සෙනසුරු", "සෙනසුරු|ශනි")], rubric=["Sinhala script", "Useful for the decision"]),
        gt.explain("sf-ch-love", "chart.love", "chart_kasun", lang="si",
                   gt="7 වෙනි ගෘහය තුලා, අධිපති සිකුරු 5 වෙනි ගෘහයේ රවි ගුරු සමඟ; සෙනසුරු සහ චන්ද්‍ර දෘෂ්ටි; කුජ දෝෂය.", facts=[fact("සිකුරු", "සිකුරු|ශුක්")], rubric=["Natural spoken Sinhala", "Life first"]),
        gt.explain("sf-ch-match", "match.summary", "match", lang="si",
                   gt="18 න් 11; රජ්ජු වේධ දෙකම ගැළපේ; තේමා; කුජ දෝෂය සමබර.", facts=[fact("score", "18[^0-9]{0,25}11|11[^0-9]{0,25}18"), fact("රජ්ජු", "රජ්ජු")], rubric=["Natural spoken Sinhala", "Counts right"]),
        gt.explain("sf-ch-periods", "chart.periods", "chart", lang="si",
                   gt="බුධ දශාව 2038 දක්වා; සියලු අතුරු දශා දින නිවැරදිව; ඊළඟ කේතු, සිකුරු.", facts=[fact("බුධ", "බුධ"), fact("2027", "2027"), fact("2038", "2038")], rubric=["Natural spoken Sinhala", "Dates exact, Sinhala months"]),
    ]
    for c in cases:
        assert (CONTEXTS / f"{c['context']}.json").exists(), c["context"]
    write_json(DATA / "sinhala.json", {"frozen_now": "2026-11-25T10:00+05:30", "cases": cases})
    print(len(cases), "Sinhala cases")


if __name__ == "__main__":
    main()
