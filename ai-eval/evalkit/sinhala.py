"""Automatic signs of poor Sinhala in an answer. They point the reviewer at things to read; the
fluency mark itself is the reviewer's (RUBRIC.md)."""

import re
from typing import Any

SI = r"඀-෿"
WORD = re.compile(rf"[{SI}‍]+")
# Letters that belong to no language the site writes: a sign of a model slipping (Cyrillic "Т").
FOREIGN = re.compile(r"[Ѐ-ӿऀ-ॿ஀-௿Ͱ-Ͽ؀-ۿ一-鿿฀-๿]")
LATIN = re.compile(r"[A-Za-z]{2,}")
# A joined ya or ra written without its joiner (ජ්යෝතිෂ for ජ්‍යෝතිෂ) shows as a broken letter.
BROKEN_JOIN = re.compile(rf"[{SI}]්(?=[යර])(?!‍)")
LOOSE_SIGN = re.compile(rf"(?<![{SI}‍])[්-ෟෲෳ]")
# The word Astro should use first, then words for the same thing it should not.
# සෙනසුරු and සිකුරු: the owner's choice, 2026-11-25.
OTHER_WORDS = {
    "සෙනසුරු": r"(?<!අෂ්ටම )(?<![ක-ෆ])ශනි(?! මංගල)", "සිකුරු": r"ශුක්.?ර",
    "කේන්දරය": r"කුණ්ඩලි", "පුනාවස": r"පුනර්වසු",
    "බෙරණ": r"භරණී|බරණ", "මනාලිය": r"වධූ", "මනාලයා": r"වරයා", "උපන් නැකත": r"තාරකා",
}
SPOKEN = re.compile(r"(?:නවා|පුළුවන්|තියෙ|බැහැ|නැහැ|කියල|වෙයි|මේක|ඒක|එක්ක|හින්ද|ගන්න)")
WRITTEN = re.compile(r"(?:ලබයි|යුතුය|හැකිය|නොවේ|වේ\.|ඇත\.|පවතී|දක්වයි|කරයි|සලකයි|වන්නේය|නිසාය|බැවින්|අයත් වේ|ලදී)")


def signs(text: str) -> dict[str, Any]:
    prose = re.sub(r"`[^`]*`|\*\*|[|#]", " ", text)
    words = WORD.findall(prose)
    latin = LATIN.findall(prose)
    sentences = [s for s in re.split(r"[.?!\n]+", prose) if len(WORD.findall(s)) >= 3]
    lengths = [len(s.split()) for s in sentences]
    spoken, written = len(SPOKEN.findall(prose)), len(WRITTEN.findall(prose))
    return {
        "words": len(words),
        "foreign_letters": sorted(set(FOREIGN.findall(prose))),
        "english_words": latin,
        "english_share": round(len(latin) / max(1, len(latin) + len(words)), 2),
        "broken_letters": len(BROKEN_JOIN.findall(prose)) + len(LOOSE_SIGN.findall(prose)),
        "other_words": [site for site, other in OTHER_WORDS.items() if re.search(other, prose)],
        "long_sentences": sum(n > 20 for n in lengths),
        "sentences": len(lengths),
        "longest_sentence": max(lengths, default=0),
        "spoken_forms": spoken,
        "written_forms": written,
    }
