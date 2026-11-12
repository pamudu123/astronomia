"""Build the hadahan and porondam PDF reports from the same results the pages show."""

import datetime as dt
from functools import lru_cache
from typing import Any

from jinja2 import Environment, FileSystemLoader, StrictUndefined

from app.api.charts import ChartOut, HadahanBuild, HadahanRequest, KujaOut, chart_out
from app.api.porondam import FactorOut, PersonOut, PorondamBuild
from app.explain.labels import Lang, labels
from app.reports.format import (
    coordinates_line,
    format_date,
    format_degree,
    format_time,
    place_line,
)
from app.reports.kendara import LINES, planet_labels
from app.reports.pdf import REPORTS_DIR, html_to_pdf

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


def render_hadahan(
    build: HadahanBuild, request: HadahanRequest, name: str, today: dt.date
) -> bytes:
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
    main, sub = dasha.current[0], dasha.current[1]
    dasha_now = report["dasha_now_value"].format(
        main=planet[main.lord.value], sub=planet[sub.lord.value]
    )
    kuja_status = _kuja_status(kuja, lang)

    context = {
        "r": report,
        "title": (
            report["hadahan_title_named"].format(name=name) if name else report["hadahan_title"]
        ),
        "born": report["born"].format(
            date=format_date(request.date, lang), time=format_time(request.time), place=where
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
                    "result": report["applies"] if c.applies else report["not_applies"],
                    "reason": c.reason,
                }
                for c in kuja.cancellations
            ],
        },
        "time_check": chart.time_check.reason,
        "dasha": _two_columns(
            [
                {
                    "lord": planet[p.lord.value],
                    "start": format_date(p.start.date(), lang),
                    "end": format_date(p.end.date(), lang),
                    "now": p.lord == main.lord and p.start == main.start,
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
        "detail": detail,
    }


def render_porondam(build: PorondamBuild, lang: Lang, today: dt.date) -> bytes:
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

    context = {
        "r": report,
        "title": report["porondam_title"].format(bride=people[0]["name"], groom=people[1]["name"]),
        "people": people,
        "score": report["score"].format(passed=result.score.passed, total=result.score.total),
        "summary": result.summary_text,
        "same_star": result.same_star_text,
        "hard_checks": [_factor(f, table) for f in result.hard_checks],
        "factors": [_factor(f, table) for f in result.factors],
        "kuja": kuja,
        "charts": charts,
        "about": _about(
            lang, f"{report['method_porondam']} {report['porondam_provisional']}", rule_sets, today
        ),
    }
    return _render("porondam.html", lang, report["porondam_kind"], context)
