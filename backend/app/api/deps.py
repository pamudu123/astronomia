"""Shared dependencies for the routers."""

from functools import lru_cache
from pathlib import Path
from typing import Annotated

from fastapi import Depends

from app.auth import SupabaseAdmin, TokenChecker
from app.config import Settings, get_settings
from app.geo.build import ensure_built
from app.store.accounts import AccountStore, postgres_accounts, sqlite_accounts
from app.store.chapters import ChapterStore, postgres_chapters, sqlite_chapters
from app.store.chat import ChatStore, postgres_chat, sqlite_chat
from app.store.orders import OrderStore, postgres_orders, sqlite_orders
from app.store.shares import PostgresShareStore, ShareStore, Store


@lru_cache
def _built_index(path: Path) -> Path:
    return ensure_built(path)


def places_db(settings: Annotated[Settings, Depends(get_settings)]) -> Path:
    return _built_index(settings.places_db)


PlacesDb = Annotated[Path, Depends(places_db)]


@lru_cache
def _sqlite_store(path: Path) -> Store:
    return ShareStore(path)


@lru_cache
def _postgres_store(url: str) -> Store:
    return PostgresShareStore(url)


def share_store(settings: Annotated[Settings, Depends(get_settings)]) -> Store:
    if settings.database_url:
        return _postgres_store(settings.database_url)
    return _sqlite_store(settings.shares_db)


Shares = Annotated[Store, Depends(share_store)]


@lru_cache
def _sqlite_accounts(path: Path) -> AccountStore:
    return sqlite_accounts(path)


@lru_cache
def _postgres_accounts(url: str) -> AccountStore:
    return postgres_accounts(url)


def account_store(settings: Annotated[Settings, Depends(get_settings)]) -> AccountStore:
    if settings.database_url:
        return _postgres_accounts(settings.database_url)
    return _sqlite_accounts(settings.accounts_db)


Accounts = Annotated[AccountStore, Depends(account_store)]


@lru_cache
def _token_checker(supabase_url: str) -> TokenChecker:
    return TokenChecker(supabase_url)


def token_checker(settings: Annotated[Settings, Depends(get_settings)]) -> TokenChecker | None:
    """Checks Supabase access tokens. None when Supabase is not set up (local runs)."""
    if not settings.supabase_url:
        return None
    return _token_checker(settings.supabase_url)


Tokens = Annotated[TokenChecker | None, Depends(token_checker)]


def supabase_admin(settings: Annotated[Settings, Depends(get_settings)]) -> SupabaseAdmin | None:
    """Deletes users from Supabase Auth. None when the secret key is not set."""
    if not (settings.supabase_url and settings.supabase_secret_key):
        return None
    return SupabaseAdmin(settings.supabase_url, settings.supabase_secret_key)


Admin = Annotated[SupabaseAdmin | None, Depends(supabase_admin)]


@lru_cache
def _sqlite_orders(path: Path) -> OrderStore:
    return sqlite_orders(path)


@lru_cache
def _postgres_orders(url: str) -> OrderStore:
    return postgres_orders(url)


def order_store(settings: Annotated[Settings, Depends(get_settings)]) -> OrderStore:
    if settings.database_url:
        return _postgres_orders(settings.database_url)
    return _sqlite_orders(settings.orders_db)


Orders = Annotated[OrderStore, Depends(order_store)]


@lru_cache
def _sqlite_chapters(path: Path) -> ChapterStore:
    return sqlite_chapters(path)


@lru_cache
def _postgres_chapters(url: str) -> ChapterStore:
    return postgres_chapters(url)


def chapter_store(settings: Annotated[Settings, Depends(get_settings)]) -> ChapterStore:
    if settings.database_url:
        return _postgres_chapters(settings.database_url)
    return _sqlite_chapters(settings.chapters_db)


Chapters = Annotated[ChapterStore, Depends(chapter_store)]


@lru_cache
def _sqlite_chat(path: Path) -> ChatStore:
    return sqlite_chat(path)


@lru_cache
def _postgres_chat(url: str) -> ChatStore:
    return postgres_chat(url)


def chat_store(settings: Annotated[Settings, Depends(get_settings)]) -> ChatStore:
    if settings.database_url:
        return _postgres_chat(settings.database_url)
    return _sqlite_chat(settings.chat_db)


Chats = Annotated[ChatStore, Depends(chat_store)]
