"""Build the hadahan and porondam PDF reports from the same results the pages show."""

import datetime as dt
from collections.abc import Sequence
from functools import lru_cache
from typing import Any

from jinja2 import Environment, FileSystemLoader, StrictUndefined

from app.api.charts import ChartOut, HadahanBuild, HadahanRequest, KujaOut, chart_out
from app.api.porondam import FactorOut, PersonOut, PorondamBuild
from app.engine.zodiac import RASHI
from app.explain.labels import Lang, labels
from app.reports.artwork import chapter_uri, cover_uri, glyph, rashi_uri, section_uris
from app.reports.format import (
    coordinates_line,
    format_date,
    format_degree,
    format_time,
    place_line,
)
from app.reports.kendara import LINES, planet_labels
from app.reports.pdf import REPORTS_DIR, html_to_pdf
from app.reports.reading import blocks, parts
from app.reports.visuals import Placed, Span, factor_ring, periods_bar, sky_wheel

TEMPLATES = REPORTS_DIR / "templates"


@lru_cache
def _environment() -> Environment:
    # Autoescape is on: names are typed by visitors and must print as plain text.
    env = Environment(
        loader=FileSystemLoader(TEMPLATES),
        autoescape=True,
        undefined=StrictUndefined,
        trim_blocks=True,
        lstrip_blocks=True,
    )
    env.globals["lines"] = LINES
    return env


def css_string(text: str) -> str:
    """A CSS string literal, for the page header and footer."""
    escaped = text.replace("\\", "\\\\").replace('"', '\\"').replace("\n", " ")
    return f'"{escaped}"'


def page_counter(template: str) -> str:
    """'Page {page} of {pages}' -> "Page " counter(page) " of " counter(pages)"""
    parts = []
    rest = template
    while rest:
        head, brace, tail = rest.partition("{")
        if head:
            parts.append(css_string(head))
        if not brace:
            break
        name, _, rest = tail.partition("}")
        parts.append(f"counter({name})")
    return " ".join(parts)


def _stylesheet(lang: Lang, kind: str) -> str:
    report = labels(lang)["report"]
    css = (TEMPLATES / "report.css").read_text(encoding="utf-8")
    return (
        css.replace("__KIND__", css_string(kind))
        .replace("__FOOTER__", css_string(report["footer"]))
        .replace("__PAGE__", page_counter(report["page"]))
    )


def _render(template: str, lang: Lang, kind: str, context: dict[str, Any]) -> bytes:
    html = _environment().get_template(template).render(lang=lang, kind=kind, **context)
    return html_to_pdf(html, _stylesheet(lang, kind))


def _chart(chart: ChartOut, lang: Lang, mode: str, title: str) -> dict[str, Any]:
    table = labels(lang)
    shorts = {key: value["short"] for key, value in table["planet"].items()}
    placed = [
        (p.body.value, p.house if mode == "rashi" else p.navamsha_house) for p in chart.planets
    ]
    return {
        "title": title,
        "labels": planet_labels(placed, shorts),
        "lagna_mark": table["report"]["lagna_mark"],
        "centre": table["report"][f"centre_{mode}"],
    }


def _kuja_status(kuja: KujaOut, lang: Lang) -> str:
    report = labels(lang)["report"]
    if not kuja.present:
        return str(report["kuja_absent"])
    return str(report["kuja_reduced"] if kuja.reduced else report["kuja_present"])


def _sign(table: dict[str, Any], key: str, lang: Lang) -> str:
    sign = table["rashi"][key]
    return f"{sign['name']} ({sign['western']})" if lang == "en" else str(sign["name"])


def _two_columns(rows: list[dict[str, Any]]) -> list[tuple[dict[str, Any] | None, ...]]:
    """Rows side by side, read down the left column first, to save half the height."""
    half = -(-len(rows) // 2)
    right: list[dict[str, Any] | None] = [*rows[half:], None]
    return [(rows[i], right[i] if i < len(rows) - half else None) for i in range(half)]


def _about(lang: Lang, method: str, rule_sets: list[str], made_on: dt.date) -> list[str]:
    report = labels(lang)["report"]
    return [
        report["disclaimer"],
        f"{method} {report['rule_sets'].format(rules=', '.join(rule_sets))}",
        report["provisional"],
        report["made_on"].format(date=format_date(made_on, lang)),
    ]


# The diagram each AI chapter prints under its short answer, and the houses it lights up. The
# website's reading draws the same ones (frontend/lib/assistant/visuals.ts).
CHAPTER_VISUAL: dict[str, tuple[str, tuple[int, ...]]] = {
    "chart.summary": ("pillars", ()),
    "chart.nature": ("pillars", ()),
    "chart.planets": ("wheel", ()),
    "chart.combinations": ("wheel", ()),
    "chart.houses": ("houses", ()),
    "chart.work": ("houses", (2, 10, 11)),
    "chart.love": ("houses", (7,)),
    "chart.family": ("houses", (4,)),
    "chart.studies": ("houses", (4, 5, 9)),
    "chart.abroad": ("houses", (9, 12)),
    "chart.periods": ("periods", ()),
    "chart.care": ("periods", ()),
    "chart.mars": ("mars", ()),
    "match.people": ("people", ()),
    "match.styles": ("people", ()),
    "match.factors": ("ring", ()),
    "match.summary": ("ring", ()),
    "match.checks": ("checks", ()),
    "match.mars": ("checks", ()),
}


Chapter = tuple[str | None, str, str]  # id, title, text


def _reading(chapters: Sequence[Chapter], available: set[str]) -> list[dict[str, Any]]:
    """The AI chapters in pieces for reading.html: the short answer, the parts, the picture and
    the diagram (only one this report can draw)."""
    result = []
    for number, (chapter_id, title, text) in enumerate(chapters, start=1):
        answer, sections = parts(blocks(text))
        visual, highlight = CHAPTER_VISUAL.get(chapter_id or "", ("", ()))
        result.append(
            {
                "number": number,
                "anchor": f"chapter-{number}",
                "title": title,
                "picture": chapter_uri(chapter_id),
                "answer": answer,
                "parts": sections,
                "visual": visual if visual in available else "",
                "highlight": highlight,
            }
        )
    return result


def render_hadahan(
    build: HadahanBuild,
    request: HadahanRequest,
    name: str,
    today: dt.date,
    reading: Sequence[Chapter] = (),
    *,
    full: bool = True,
) -> bytes:
    """The chart's report. `full` is the paid one (docs/18): the cover, the contents, the sky
    wheel, the houses, every Kuja dosha condition and the AI reading. The free one is a short
    report of what the free page shows, and never holds AI text."""
    response = build.response
    assert response.chart and response.dasha and response.kuja, "only a finished chart prints"
    lang: Lang = request.lang
    table = labels(lang)
    report = table["report"]
    chart, dasha, kuja = response.chart, response.dasha, response.kuja
    planet = {key: value["name"] for key, value in table["planet"].items()}

    place = build.birth.place
    where = (
        place_line(place, lang)
        if place
        else coordinates_line(build.birth.latitude, build.birth.longitude, lang)
    )
    # No period runs before birth or after the 120 years of periods (an old birth, say).
    main = dasha.current[0] if dasha.current else None
    sub = dasha.current[1] if len(dasha.current) > 1 else None
    if main and sub:
        dasha_now = report["dasha_now_value"].format(
            main=planet[main.lord.value], sub=planet[sub.lord.value]
        )
    elif main:
        dasha_now = report["dasha_now_main"].format(main=planet[main.lord.value])
    else:
        dasha_now = report["dasha_now_none"]
    kuja_status = _kuja_status(kuja, lang)
    shorts = {key: value["short"] for key, value in table["planet"].items()}
    rashi_name = {key: value["name"] for key, value in table["rashi"].items()}
    star_line = report["star_pada"].format(
        star=table["nakshatra"][chart.moon.nakshatra], pada=chart.moon.pada
    )

    # Pictures drawn from this chart.
    wheel = sky_wheel(
        chart.lagna.longitude,
        [Placed(p.body.value, shorts[p.body.value], p.longitude) for p in chart.planets],
    )
    lagna_sign = chart.lagna.sign_number - 1
    in_house: dict[int, list[str]] = {}
    for p in chart.planets:
        in_house.setdefault(p.house, []).append(planet[p.body.value])
    houses = []
    for house in range(1, 13):
        sign = RASHI[(lagna_sign + house - 1) % 12]
        houses.append(
            {
                "number": house,
                "label": report["house_number"].format(number=house),
                "sign": rashi_name[sign],
                "glyph": glyph(sign),
                "planets": in_house.get(house, []),
                "theme": table["house_theme"][house - 1],
            }
        )
    bar = periods_bar(
        request.date,
        [
            Span(
                planet[p.lord.value],
                p.start.date(),
                p.end.date(),
                now=main is not None and p.lord == main.lord and p.start == main.start,
            )
            for p in dasha.periods
        ],
        today,
        report["now"],
    )
    pillars = [
        {
            "label": report["lagna"],
            "value": rashi_name[chart.lagna.sign],
            "note": report["pillar_lagna"],
            "glyph": glyph(chart.lagna.sign),
        },
        {
            "label": report["rashi"],
            "value": rashi_name[chart.moon.sign],
            "note": report["pillar_rashi"],
            "glyph": glyph(chart.moon.sign),
        },
        {
            "label": report["nakath"],
            "value": star_line,
            "note": report["pillar_star"],
            "glyph": None,
        },
        {
            "label": report["dasha_now"],
            "value": dasha_now,
            "note": report["pillar_period"],
            "glyph": None,
        },
    ]
    applying = [c for c in kuja.cancellations if c.applies]
    mars = {
        "points": [
            {
                "text": report["mars_point"].format(
                    point=table["point"][point.point], house=point.house
                ),
                "counts": point.counts,
            }
            for point in kuja.points
        ],
        # The conditions are part of the full report, as on the page (PaidOnly full_detail).
        "rules": report["mars_rules_count"].format(
            count=len(applying), total=len(kuja.cancellations)
        )
        if full
        else "",
        "rule_names": [table["kuja_rule"][c.id] for c in applying] if full else [],
        "status": kuja_status,
        "present": kuja.present,
    }

    context = {
        "r": report,
        "full": full,
        "banners": section_uris(),
        "title": (
            report["hadahan_title_named"].format(name=name) if name else report["hadahan_title"]
        ),
        "born": report["born"].format(
            date=format_date(request.date, lang), time=format_time(request.time), place=where
        ),
        "cover": {
            "eyebrow": report["cover_hadahan"],
            "art": rashi_uri(chart.moon.sign),
            "signs": [
                (report["lagna"], rashi_name[chart.lagna.sign]),
                (report["rashi"], rashi_name[chart.moon.sign]),
                (report["nakath"], table["nakshatra"][chart.moon.nakshatra]),
            ],
            "made": report["cover_made"].format(date=format_date(today, lang)),
            "picture": cover_uri("cover-hadahan"),
            "back": cover_uri("back-cover"),
        },
        "pillars": pillars,
        "wheel": wheel,
        "wheel_legend": " · ".join(
            f"{shorts[p.body.value]} {planet[p.body.value]}" for p in chart.planets
        ),
        "houses": houses,
        "bar": bar,
        "mars": mars,
        "chapters": _reading(
            reading if full else (), {"pillars", "wheel", "houses", "periods", "mars"}
        ),
        "time_zone": report["time_zone"].format(offset=response.time.offset_label),
        "facts": [
            (report["lagna"], _sign(table, chart.lagna.sign, lang)),
            (report["rashi"], _sign(table, chart.moon.sign, lang)),
            (
                report["nakath"],
                report["star_pada"].format(
                    star=table["nakshatra"][chart.moon.nakshatra], pada=chart.moon.pada
                ),
            ),
            (report["dasha_now"], dasha_now),
            (report["kuja"], kuja_status),
        ],
        "charts": [
            _chart(chart, lang, "rashi", report["chart_rashi"]),
            _chart(chart, lang, "navamsha", report["chart_navamsha"]),
        ],
        "planets": [
            {
                "name": planet[p.body.value],
                "sign": table["rashi"][p.sign]["name"],
                "degree": format_degree(p.degree)
                + (f" {report['retrograde']}" if p.retrograde else ""),
                "house": p.house,
                "star": table["nakshatra"][p.nakshatra],
            }
            for p in chart.planets
        ],
        "any_retrograde": any(p.retrograde for p in chart.planets),
        "kuja": {
            "status": kuja_status,
            "reasons": kuja.reasons,
            "checks": [
                {
                    "rule": table["kuja_rule"][c.id],
                    "applies": c.applies,
                    "result": report["applies"],
                    "reason": c.reason,
                }
                # Only the conditions that apply get a row, and one line counts the rest. The
                # page shows every condition.
                for c in applying
                if full
            ],
            "others": report["kuja_checks_others"].format(
                count=sum(not c.applies for c in kuja.cancellations)
            )
            if full
            else "",
        },
        "time_check": chart.time_check.reason,
        "dasha": _two_columns(
            [
                {
                    "lord": planet[p.lord.value],
                    "start": format_date(p.start.date(), lang),
                    "end": format_date(p.end.date(), lang),
                    "now": main is not None and p.lord == main.lord and p.start == main.start,
                }
                for p in dasha.periods
            ]
        ),
        "about": _about(
            lang,
            report["method_hadahan"].format(ayanamsa=f"{chart.method.ayanamsa_degrees:.4f}"),
            [kuja.rule_set],
            today,
        ),
    }
    return _render("hadahan.html", lang, report["hadahan_kind"], context)


def _factor(factor: FactorOut, table: dict[str, Any]) -> dict[str, Any]:
    names = table["porondam_factor"][factor.id]
    report = table["report"]
    return {
        "name": names["name"],
        "meaning": names["meaning"],
        "passed": factor.passed,
        "checked": factor.checked,
        "result": (
            report["not_counted"]
            if not factor.checked
            else report["pass"]
            if factor.passed
            else report["fail"]
        ),
        "reason": factor.reason,
    }


def _person(person: PersonOut, role: str, table: dict[str, Any], lang: Lang) -> dict[str, Any]:
    report = table["report"]
    star = report["star_pada"].format(star=table["nakshatra"][person.nakshatra], pada=person.pada)
    rashi = table["rashi"][person.rashi]["name"]
    detail = (
        report["person_lagna"].format(lagna=table["rashi"][person.lagna]["name"])
        if person.lagna
        else report["birth_star_only"]
    )
    return {
        "role": report[role],
        "name": person.name or report[role],
        "star": f"{star} · {rashi}",
        "sign": rashi,
        "detail": detail,
        "art": rashi_uri(person.rashi),
    }


def render_porondam(
    build: PorondamBuild,
    lang: Lang,
    today: dt.date,
    reading: Sequence[Chapter] = (),
    *,
    full: bool = True,
) -> bytes:
    """The match's report. `full` is the paid one, with the cover, the contents and the AI
    reading; the free one is a short report of what the free page shows."""
    response = build.response
    assert response.bride and response.groom and response.match, "only a finished match prints"
    table = labels(lang)
    report = table["report"]
    bride, groom, result = response.bride, response.groom, response.match
    people = [_person(bride, "bride", table, lang), _person(groom, "groom", table, lang)]

    kuja = None
    rule_sets = [result.rule_set]
    if response.kuja:
        k = response.kuja
        kuja = {
            "people": [
                f"{people[0]['name']}: {_kuja_status(k.bride, lang)}",
                f"{people[1]['name']}: {_kuja_status(k.groom, lang)}",
            ],
            "reason": k.reason,
        }
        rule_sets.append(k.bride.rule_set)

    charts = []
    b_chart, g_chart = build.charts["bride"], build.charts["groom"]
    if b_chart is not None and g_chart is not None:
        for person, found in ((people[0], b_chart), (people[1], g_chart)):
            charts.append(_chart(chart_out(found, lang), lang, "rashi", person["name"]))

    factors = [_factor(f, table) for f in result.factors]
    hard_checks = [_factor(f, table) for f in result.hard_checks]
    # All 20 around the ring, Rajju and Vedha too, as the score counts them.
    ring = factor_ring(
        [
            "unchecked" if not f["checked"] else "pass" if f["passed"] else "fail"
            for f in [*factors, *hard_checks]
        ]
    )
    context = {
        "cover": {
            "eyebrow": report["cover_porondam"],
            "made": report["cover_made"].format(date=format_date(today, lang)),
            "picture": cover_uri("cover-porondam"),
            "back": cover_uri("back-cover"),
        },
        "passed": result.score.passed,
        "total": result.score.total,
        "ring": ring,
        "full": full,
        "banners": section_uris(),
        "chapters": _reading(reading if full else (), {"people", "ring", "checks"}),
        "r": report,
        "title": report["porondam_title"].format(bride=people[0]["name"], groom=people[1]["name"]),
        "people": people,
        "score": report["score"].format(passed=result.score.passed, total=result.score.total),
        "summary": result.summary_text,
        "same_star": result.same_star_text,
        "hard_checks": hard_checks,
        "factors": factors,
        "kuja": kuja,
        "charts": charts,
        "about": _about(
            lang, f"{report['method_porondam']} {report['porondam_provisional']}", rule_sets, today
        ),
    }
    return _render("porondam.html", lang, report["porondam_kind"], context)
