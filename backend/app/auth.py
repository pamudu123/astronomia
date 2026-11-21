"""Who is calling: Supabase Auth access tokens (docs/19).

The browser signs in with Supabase (anonymously on the first Save, or with Google) and sends its
access token with each account call, as `Authorization: Bearer <token>`. The token is a JWT that
Supabase signs with the project's private key. Here it is checked with the matching public keys,
which Supabase publishes at its JWKS address, so the backend needs no shared secret for it.

A token is accepted only when its signature is good, it comes from this project (issuer), it is
meant for signed in users (audience), it has not expired, and it names a user. Anything else is
refused. The keys are kept for ten minutes, and fetched again early when a token names a key we
have not seen (Supabase rotating its keys), at most once a minute.

The secret key is used for one thing only: deleting a user from Supabase Auth when someone
deletes their account.
"""

import json
import threading
import time
import urllib.error
import urllib.request
import uuid
from collections.abc import Callable
from dataclasses import dataclass
from typing import Any, Literal

import jwt

Kind = Literal["guest", "google"]
JwksFetcher = Callable[[str], dict[str, Any]]

AUDIENCE = "authenticated"
# Supabase signs with ES256 (this project) or RS256. HS256 tokens use the old shared secret, which
# the backend does not hold, and are refused with every other algorithm.
ALGORITHMS = ("ES256", "RS256")
KEYS_FOR = 600.0  # seconds a fetched key set is trusted
REFETCH_AFTER = 60.0  # the soonest an unknown key may fetch the set again
LEEWAY = 30  # seconds of clock difference allowed on expiry
TIMEOUT = 10


class BadToken(Exception):
    """The token is missing a part, forged, expired or from somewhere else."""


class KeysUnavailable(Exception):
    """Supabase's public keys could not be fetched, and none are kept from before."""


@dataclass(frozen=True)
class Caller:
    """The user a good token names."""

    id: str  # the Supabase user id, a uuid
    kind: Kind  # guest: an anonymous Supabase user; google: signed in with Google
    expires_at: int  # when the token stops working, in seconds since 1970


def fetch_json(url: str, headers: dict[str, str] | None = None) -> dict[str, Any]:
    request = urllib.request.Request(url, headers={"accept": "application/json", **(headers or {})})
    with urllib.request.urlopen(request, timeout=TIMEOUT) as response:
        loaded: dict[str, Any] = json.load(response)
    return loaded


class TokenChecker:
    """Checks Supabase access tokens for one project."""

    def __init__(
        self,
        supabase_url: str,
        fetch: JwksFetcher = fetch_json,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        base = supabase_url.rstrip("/")
        self.issuer = f"{base}/auth/v1"
        self.jwks_url = f"{self.issuer}/.well-known/jwks.json"
        self._fetch = fetch
        self._clock = clock
        self._keys: dict[str, jwt.PyJWK] = {}
        self._fetched_at: float | None = None
        self._lock = threading.Lock()

    def check(self, token: str) -> Caller:
        """The user the token names. Raises BadToken, or KeysUnavailable when Supabase is down
        and no keys are kept."""
        try:
            header = jwt.get_unverified_header(token)
        except jwt.PyJWTError as error:
            raise BadToken("not a token") from error
        algorithm = header.get("alg")
        kid = header.get("kid")
        if algorithm not in ALGORITHMS or not isinstance(kid, str):
            raise BadToken("unexpected signing")
        key = self._key(kid)
        if key is None:
            raise BadToken("unknown signing key")
        try:
            claims: dict[str, Any] = jwt.decode(
                token,
                key,
                algorithms=[algorithm],
                audience=AUDIENCE,
                issuer=self.issuer,
                leeway=LEEWAY,
                options={"require": ["exp", "iat", "sub", "aud", "iss"]},
            )
        except jwt.PyJWTError as error:
            raise BadToken(type(error).__name__) from error
        return _caller(claims)

    def _key(self, kid: str) -> jwt.PyJWK | None:
        with self._lock:
            now = self._clock()
            fresh = self._fetched_at is not None and now - self._fetched_at < KEYS_FOR
            may_refetch = self._fetched_at is None or now - self._fetched_at >= REFETCH_AFTER
            if not fresh or (kid not in self._keys and may_refetch):
                self._refresh(now)
            return self._keys.get(kid)

    def _refresh(self, now: float) -> None:
        try:
            document = self._fetch(self.jwks_url)
            keys = jwt.PyJWKSet.from_dict(document).keys
        except (OSError, ValueError, urllib.error.URLError, jwt.PyJWTError) as error:
            if not self._keys:
                raise KeysUnavailable(str(error)) from error
            # Keep the keys we have, and try again in a minute rather than on every call.
            self._fetched_at = now - KEYS_FOR + REFETCH_AFTER
            return
        self._keys = {key.key_id: key for key in keys if key.key_id}
        self._fetched_at = now


def _caller(claims: dict[str, Any]) -> Caller:
    subject = claims.get("sub")
    try:
        user_id = str(uuid.UUID(str(subject)))
    except ValueError as error:
        raise BadToken("the token names no user") from error
    if claims.get("role") not in (None, AUDIENCE):
        raise BadToken("not a signed in user")
    kind: Kind = "guest" if claims.get("is_anonymous") is True else "google"
    return Caller(id=user_id, kind=kind, expires_at=int(claims["exp"]))


def bearer_token(authorization: str | None) -> str | None:
    """The token in an `Authorization: Bearer <token>` header, or None."""
    if not authorization:
        return None
    scheme, _, token = authorization.partition(" ")
    token = token.strip()
    if scheme.lower() != "bearer" or not token or len(token) > 8192:
        return None
    return token


class SupabaseAdmin:
    """The one call made with the secret key: deleting a user from Supabase Auth."""

    def __init__(self, supabase_url: str, secret_key: str) -> None:
        self.base = supabase_url.rstrip("/")
        self.secret_key = secret_key

    def delete_user(self, user_id: str) -> None:
        """Deletes the Supabase Auth user. A user already gone counts as deleted."""
        url = f"{self.base}/auth/v1/admin/users/{uuid.UUID(user_id)}"
        request = urllib.request.Request(
            url,
            method="DELETE",
            # A secret key goes in apikey. Authorization may carry it too only if it is the same.
            headers={"apikey": self.secret_key, "authorization": f"Bearer {self.secret_key}"},
        )
        try:
            with urllib.request.urlopen(request, timeout=TIMEOUT):
                return
        except urllib.error.HTTPError as error:
            if error.code == 404:
                return
            raise
