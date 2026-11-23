"""The title of every AI chapter a report can keep, in the order the PDF prints them.

A paid report's PDF prints the chapters kept on the server (app/store/chapters.py), so their
titles and order come from here and not from the browser. The same words and order as the
website's reading (frontend/messages, frontend/lib/assistant/explain.ts); a test keeps the
words in step.
"""

from app.explain.labels import Lang

CHAPTER_TITLES: dict[str, dict[Lang, str]] = {
    "match.people": {"en": "The two of you", "si": "ඔබ දෙදෙනා"},
    "match.factors": {"en": "All the factors", "si": "සියලු කරුණු"},
    "match.checks": {"en": "The serious checks", "si": "අත්‍යවශ්‍ය පරීක්ෂා"},
    "match.mars": {"en": "The Mars check for both", "si": "දෙදෙනාගේම කුජ දෝෂය"},
    "match.combinations": {
        "en": "Marriage combinations in each chart",
        "si": "එක් එක් කේන්දරයේ විවාහ යෝග",
    },
    "match.lords": {"en": "Your two 7th-house rulers", "si": "සප්තමාධිපතියන් දෙදෙනා"},
    "match.styles": {"en": "Emotional styles", "si": "හැඟීම් පෙන්වන ආකාරය"},
    "match.years": {"en": "Your years ahead", "si": "ඔබ දෙදෙනාගේ ඉදිරි වසර"},
    "match.wedding": {"en": "Wedding dates", "si": "විවාහ නැකත්"},
    "match.summary": {"en": "Summing up", "si": "සාරාංශය"},
    "chart.summary": {"en": "Birth summary", "si": "උපත් සාරාංශය"},
    "chart.nature": {"en": "Your nature", "si": "ඔබේ ස්වභාවය"},
    "chart.planets": {"en": "The nine planets", "si": "ග්‍රහයන් නවදෙනා"},
    "chart.combinations": {"en": "Special combinations", "si": "විශේෂ යෝග"},
    "chart.mars": {"en": "The Mars check", "si": "කුජ දෝෂය"},
    "chart.houses": {"en": "The 12 parts of life", "si": "ජීවිතයේ කොටස් 12"},
    "chart.work": {"en": "Work and money", "si": "රැකියාව සහ මුදල්"},
    "chart.love": {"en": "Love and marriage", "si": "ප්‍රේමය සහ විවාහය"},
    "chart.periods": {"en": "Your life periods", "si": "ඔබේ දශා"},
    "chart.saturn": {"en": "Saturn periods", "si": "සෙනසුරු කාල"},
    "chart.care": {"en": "Areas to take care of", "si": "සැලකිලිමත් විය යුතු දේ"},
    "chart.ahead": {"en": "The planet changes ahead", "si": "ඉදිරි ග්‍රහ මාරු"},
    "chart.family": {"en": "Family and home", "si": "පවුල සහ නිවස"},
    "chart.studies": {"en": "Studies", "si": "අධ්‍යාපනය"},
    "chart.abroad": {"en": "Travel and going abroad", "si": "ගමන් බිමන් සහ විදේශගත වීම"},
}
