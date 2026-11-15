# Two stages: the first installs the dependencies with uv, the second runs them without uv.
# Everything installs from ready-made wheels, so no compilers are needed.

FROM python:3.13-slim AS build

COPY --from=ghcr.io/astral-sh/uv:0.11 /uv /usr/local/bin/uv
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy

WORKDIR /srv
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

COPY app ./app
COPY skills ./skills
RUN uv sync --frozen --no-dev


FROM python:3.13-slim

ENV PYTHONUNBUFFERED=1
WORKDIR /srv
COPY --from=build /srv /srv

RUN useradd --create-home appuser
USER appuser
EXPOSE 8123
# The OpenAI key and the other settings come from the host's environment, never from a file
# in the image. Hosts such as Render say which port to use in $PORT. Locally it is 8123.
CMD ["/bin/sh", "-c", "exec /srv/.venv/bin/uvicorn app.main:create_app --factory --host 0.0.0.0 --port ${PORT:-8123} --no-access-log"]
