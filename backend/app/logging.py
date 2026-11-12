"""Logging set up so that birth details never reach the logs.

Only the method, path, status and duration of a request are logged. Request bodies and
query strings are never logged, because they can hold names and birth details.
"""

import logging
import re
import time
from collections.abc import Awaitable, Callable

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

logger = logging.getLogger("astronomia.access")


def configure_logging(level: str) -> None:
    logging.basicConfig(
        level=level.upper(),
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )
    # Uvicorn's own access log prints the full URL, query string included. Use ours instead.
    logging.getLogger("uvicorn.access").disabled = True
    # The PDF tools log each step, and the font subsetter lists the letters it used, which
    # would spell out a visitor's name. Keep them to warnings.
    for name in ("weasyprint", "fontTools"):
        logging.getLogger(name).setLevel(logging.WARNING)


# A share code opens the shared result, so it never goes in the log.
_SHARE_CODE = re.compile(r"^(/v1/shares/)[^/]+")


def loggable_path(path: str) -> str:
    return _SHARE_CODE.sub(r"\1…", path)


class AccessLogMiddleware(BaseHTTPMiddleware):
    async def dispatch(
        self, request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        start = time.perf_counter()
        response = await call_next(request)
        duration_ms = (time.perf_counter() - start) * 1000
        logger.info(
            "%s %s %s %.1fms",
            request.method,
            loggable_path(request.url.path),
            response.status_code,
            duration_ms,
        )
        return response
