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

# States and provinces abroad, so places with the same name can be told apart in search
# (QA report AST-07: four "London, United States"). geonamescache ships names only for US
# states (read at build time); these cover the other countries with the most Sri Lankans.
# Keys are GeoNames admin1 codes, checked against cities1000.json.
WORLD_REGIONS: dict[str, dict[str, str]] = {
    "AU": {
        "01": "Australian Capital Territory",
        "02": "New South Wales",
        "03": "Northern Territory",
        "04": "Queensland",
        "05": "South Australia",
        "06": "Tasmania",
        "07": "Victoria",
        "08": "Western Australia",
    },
    "CA": {
        "01": "Alberta",
        "02": "British Columbia",
        "03": "Manitoba",
        "04": "New Brunswick",
        "05": "Newfoundland and Labrador",
        "07": "Nova Scotia",
        "08": "Ontario",
        "09": "Prince Edward Island",
        "10": "Quebec",
        "11": "Saskatchewan",
        "12": "Yukon",
        "13": "Northwest Territories",
        "14": "Nunavut",
    },
    "GB": {"ENG": "England", "NIR": "Northern Ireland", "SCT": "Scotland", "WLS": "Wales"},
}
