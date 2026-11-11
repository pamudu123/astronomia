"""FastAPI application."""

from fastapi import FastAPI

from app import __version__
from app.api import charts, meta, places, porondam, timeresolve
from app.config import get_settings
from app.logging import AccessLogMiddleware, configure_logging


def create_app() -> FastAPI:
    settings = get_settings()
    configure_logging(settings.log_level)

    app = FastAPI(
        title="Astronomia API",
        version=__version__,
        description="Hadahan (birth chart) and porondam (marriage matching).",
    )
    app.add_middleware(AccessLogMiddleware)
    app.include_router(meta.router)
    app.include_router(places.router)
    app.include_router(timeresolve.router)
    app.include_router(charts.router)
    app.include_router(porondam.router)
    return app


app = create_app()
