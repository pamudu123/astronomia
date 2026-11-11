"""Names for Sri Lanka and its provinces.

Curated by hand: the GeoNames province names have errors (Northern Province carries the
Central Province name in Sinhala). Keys are GeoNames admin1 codes for LK.
"""

SRI_LANKA = {"en": "Sri Lanka", "si": "ශ්‍රී ලංකාව"}

LK_PROVINCES: dict[str, dict[str, str]] = {
    "29": {"en": "Central Province", "si": "මධ්‍යම පළාත"},
    "30": {"en": "North Central Province", "si": "උතුරු මැද පළාත"},
    "32": {"en": "North Western Province", "si": "වයඹ පළාත"},
    "33": {"en": "Sabaragamuwa Province", "si": "සබරගමුව පළාත"},
    "34": {"en": "Southern Province", "si": "දකුණු පළාත"},
    "35": {"en": "Uva Province", "si": "ඌව පළාත"},
    "36": {"en": "Western Province", "si": "බස්නාහිර පළාත"},
    "37": {"en": "Eastern Province", "si": "නැගෙනහිර පළාත"},
    "38": {"en": "Northern Province", "si": "උතුරු පළාත"},
}
