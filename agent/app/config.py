"""Settings read from environment variables (prefix ASTRONOMIA_AGENT_), or from agent/.env.

The OpenAI key is the one exception: it is read as OPENAI_API_KEY, the name the OpenAI
client library looks for.
"""

from functools import lru_cache
from typing import Literal

from pydantic import Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict

Effort = Literal["minimal", "low", "medium", "high"]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="ASTRONOMIA_AGENT_", env_file=".env", extra="ignore"
    )

    environment: str = "development"
    log_level: str = "INFO"
    # The chat model, as provider:model. Changing model is a settings change, not a code change.
    model: str = "openai:gpt-6-luna"
    # How hard the model thinks before answering. Low keeps replies quick and cheap; the
    # engine does the hard work.
    reasoning_effort: Effort = "low"
    # How many helpers (subagents) one question may start. Each costs extra model calls.
    max_subagent_calls: int = Field(default=4, ge=0, le=10)
    # A conversation kept in memory is deleted after this many minutes without a message
    # (app/memory.py). The privacy notice states this number: change both together.
    conversation_idle_minutes: int = Field(default=30, ge=1, le=24 * 60)
    openai_api_key: SecretStr = Field(default=SecretStr(""), alias="OPENAI_API_KEY")
    # The calculation engine (the existing backend) and its staging access key, if any.
    backend_url: str = "http://localhost:8000"
    backend_access_key: SecretStr = SecretStr("")
    # When set, every request except /healthz must carry this key in X-Access-Key.
    # The frontend's chat route sends it. Empty means open, as in local runs.
    access_key: SecretStr = SecretStr("")


@lru_cache
def get_settings() -> Settings:
    return Settings()
