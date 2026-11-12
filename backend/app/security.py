"""Keeps a staging backend private: every request needs the access key, except the health check.

Only active when ASTRONOMIA_ACCESS_KEY is set. The frontend adds the key to the requests it
forwards, so visitors never see it.
"""

import secrets
from collections.abc import Awaitable, Callable

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response
from starlette.types import ASGIApp

HEADER = "X-Access-Key"
OPEN_PATHS = frozenset({"/healthz"})


class AccessKeyMiddleware(BaseHTTPMiddleware):
    def __init__(self, app: ASGIApp, key: str) -> None:
        super().__init__(app)
        self.key = key

    async def dispatch(
        self, request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        given = request.headers.get(HEADER, "")
        if request.url.path in OPEN_PATHS or secrets.compare_digest(given, self.key):
            return await call_next(request)
        return JSONResponse({"detail": "access key needed"}, status_code=401)
