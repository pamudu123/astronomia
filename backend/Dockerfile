# Two stages: the first compiles what needs a C compiler (pyswisseph has no ready-made wheel
# for every Python), the second runs it without the compiler.

FROM python:3.13-slim AS build

RUN apt-get update \
    && apt-get install -y --no-install-recommends gcc libc6-dev \
    && rm -rf /var/lib/apt/lists/*

COPY --from=ghcr.io/astral-sh/uv:0.11 /uv /usr/local/bin/uv
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy

WORKDIR /srv
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

COPY app ./app
RUN uv sync --frozen --no-dev
# Build the place search index into the image, so the first request is fast.
RUN /srv/.venv/bin/python -m app.geo.build


FROM python:3.13-slim

# Pango and HarfBuzz lay out the PDF reports and join Sinhala letters correctly.
RUN apt-get update \
    && apt-get install -y --no-install-recommends libpango-1.0-0 libpangoft2-1.0-0 libharfbuzz-subset0 \
    && rm -rf /var/lib/apt/lists/*

ENV PYTHONUNBUFFERED=1
WORKDIR /srv
COPY --from=build /srv /srv

RUN useradd --create-home appuser \
    && mkdir -p /srv/var && chown appuser /srv/var
USER appuser
EXPOSE 8000
# Hosts such as Render say which port to use in $PORT. Locally it is 8000.
CMD ["/bin/sh", "-c", "exec /srv/.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --no-access-log"]
