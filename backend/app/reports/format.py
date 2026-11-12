"""Dates, degrees and place names as the report prints them."""

import datetime as dt

from app.explain.labels import Lang, labels
from app.geo.search import Place


def format_date(day: dt.date, lang: Lang) -> str:
    """19 April 1995, or 1995 අප්‍රේල් 19 (the order used in Sinhala)."""
    month = labels(lang)["month"][day.month - 1]
    return f"{day.year} {month} {day.day}" if lang == "si" else f"{day.day} {month} {day.year}"


def format_degree(degree: float) -> str:
    """21.254 -> 21° 15 and a prime sign, as on the website."""
    whole = int(degree)
    minutes = round((degree - whole) * 60)
    if minutes == 60:
        whole, minutes = whole + 1, 0
    return f"{whole}° {minutes:02d}\u2032"


def format_time(clock: dt.time) -> str:
    return clock.strftime("%H:%M")


def place_line(place: Place, lang: Lang) -> str:
    """Kandy, Central Province, Sri Lanka. In Sinhala where a Sinhala name is known."""
    if lang == "si":
        country = place.country_name_si or place.country_name
        parts = [place.name_si or place.name, place.region_si or place.region, country]
    else:
        parts = [place.name, place.region, place.country_name]
    return ", ".join(part for part in parts if part)


def coordinates_line(latitude: float, longitude: float, lang: Lang) -> str:
    text: str = labels(lang)["report"]["coordinates"]
    return text.format(latitude=f"{latitude:.4f}", longitude=f"{longitude:.4f}")
