"""FastAPI application."""

from fastapi import FastAPI

from app import __version__
from app.api import (
    avurudu,
    baby,
    changes,
    charts,
    first_letters,
    forecast,
    kendara,
    meta,
    panchanga,
    places,
    porondam,
    reports,
    shares,
    timeresolve,
    wedding,
    yearly,
)
from app.config import get_settings
from app.logging import AccessLogMiddleware, configure_logging
from app.security import AccessKeyMiddleware


def create_app() -> FastAPI:
    settings = get_settings()
    configure_logging(settings.log_level)

    app = FastAPI(
        title="Astronomia API",
        version=__version__,
        description="Hadahan (birth chart) and porondam (marriage matching).",
    )
    if settings.access_key:
        app.add_middleware(AccessKeyMiddleware, key=settings.access_key)
    app.add_middleware(AccessLogMiddleware)
    app.include_router(meta.router)
    app.include_router(places.router)
    app.include_router(timeresolve.router)
    app.include_router(charts.router)
    app.include_router(porondam.router)
    app.include_router(forecast.router)
    app.include_router(changes.router)
    app.include_router(yearly.router)
    app.include_router(panchanga.router)
    app.include_router(avurudu.router)
    app.include_router(wedding.router)
    app.include_router(baby.router)
    app.include_router(first_letters.router)
    app.include_router(kendara.router)
    app.include_router(reports.router)
    app.include_router(shares.router)
    return app


app = create_app()
