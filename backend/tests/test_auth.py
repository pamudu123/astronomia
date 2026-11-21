"""Checking Supabase access tokens (app/auth.py), with stand-in keys and tokens."""

import base64
import json
import time
import uuid
from typing import Any

import jwt
import pytest

from app.auth import BadToken, KeysUnavailable, TokenChecker, bearer_token
from tests.auth import ISSUER, JWKS, OTHER_KEY, PRIVATE_KEY, SUPABASE_URL, _jwk, checker, token


def test_a_good_guest_token_names_its_user() -> None:
    user = str(uuid.uuid4())
    caller = checker().check(token(user))
    assert caller.id == user
    assert caller.kind == "guest"
    assert caller.expires_at > time.time()


def test_a_google_user_is_not_a_guest() -> None:
    assert checker().check(token(anonymous=False)).kind == "google"
    # Tokens from before the claim existed count as not anonymous too.
    assert checker().check(token(is_anonymous=None)).kind == "google"


@pytest.mark.parametrize(
    ("why", "claims"),
    [
        ("expired", {"lifetime": -120}),
        ("wrong issuer", {"iss": "https://other-project.supabase.co/auth/v1"}),
        ("wrong audience", {"aud": "anon"}),
        ("no expiry", {"exp": None}),
        ("no user", {"sub": None}),
        ("user is not a uuid", {"sub": "admin"}),
        ("service role", {"role": "service_role"}),
        ("issued without a time", {"iat": None}),
    ],
)
def test_a_bad_token_is_refused(why: str, claims: dict[str, Any]) -> None:
    with pytest.raises(BadToken):
        checker().check(token(**claims))


def test_a_little_clock_difference_is_allowed() -> None:
    checker().check(token(lifetime=-10))


def _parts(value: str) -> list[str]:
    return value.split(".")


def _b64(data: dict[str, Any]) -> str:
    return base64.urlsafe_b64encode(json.dumps(data).encode()).rstrip(b"=").decode()


def test_a_tampered_token_is_refused() -> None:
    header, payload, signature = _parts(token())
    claims = jwt.decode(token(), options={"verify_signature": False})
    claims["sub"] = str(uuid.uuid4())  # someone else's id, with the old signature
    with pytest.raises(BadToken):
        checker().check(".".join([header, _b64(claims), signature]))
    with pytest.raises(BadToken):
        flipped = signature[:-2] + ("AA" if signature[-2:] != "AA" else "BB")
        checker().check(".".join([header, payload, flipped]))


def test_a_token_signed_with_another_key_is_refused() -> None:
    with pytest.raises(BadToken):
        checker().check(token(key=OTHER_KEY))  # claims our key id
    with pytest.raises(BadToken):
        checker().check(token(key=OTHER_KEY, kid="made-up"))


def test_the_shared_secret_and_unsigned_tokens_are_refused() -> None:
    hs256 = jwt.encode({"sub": str(uuid.uuid4())}, "secret" * 6, algorithm="HS256")
    unsigned = jwt.encode(
        {"sub": str(uuid.uuid4()), "iss": ISSUER, "aud": "authenticated"},
        "",
        algorithm="none",
        headers={"kid": "test-key-1"},
    )
    for value in (hs256, unsigned, "not a token", "", "a.b.c"):
        with pytest.raises(BadToken):
            checker().check(value)


class Fetches:
    def __init__(self, document: dict[str, Any] | None = None) -> None:
        self.document = document or JWKS
        self.urls: list[str] = []
        self.fail = False

    def __call__(self, url: str) -> dict[str, Any]:
        self.urls.append(url)
        if self.fail:
            raise OSError("supabase is down")
        return self.document


class Clock:
    def __init__(self) -> None:
        self.now = 1000.0

    def __call__(self) -> float:
        return self.now


def test_keys_are_fetched_from_the_project_and_kept() -> None:
    fetches, clock = Fetches(), Clock()
    tokens = TokenChecker(SUPABASE_URL + "/", fetch=fetches, clock=clock)
    for _ in range(5):
        tokens.check(token())
    assert fetches.urls == [f"{SUPABASE_URL}/auth/v1/.well-known/jwks.json"]
    clock.now += 601
    tokens.check(token())
    assert len(fetches.urls) == 2


def test_a_new_key_is_fetched_when_supabase_rotates() -> None:
    fetches, clock = Fetches(), Clock()
    tokens = TokenChecker(SUPABASE_URL, fetch=fetches, clock=clock)
    tokens.check(token())
    new_key = _jwk(OTHER_KEY, "rotated")
    fetches.document = {"keys": [*JWKS["keys"], new_key]}
    with pytest.raises(BadToken):  # too soon after the last fetch: no new fetch
        tokens.check(token(key=OTHER_KEY, kid="rotated"))
    clock.now += 61
    tokens.check(token(key=OTHER_KEY, kid="rotated"))
    # Made-up key ids cannot make the backend fetch on every request.
    for _ in range(3):
        with pytest.raises(BadToken):
            tokens.check(token(kid="made-up"))
    assert len(fetches.urls) == 2


def test_when_supabase_is_down_the_kept_keys_still_work() -> None:
    fetches, clock = Fetches(), Clock()
    tokens = TokenChecker(SUPABASE_URL, fetch=fetches, clock=clock)
    tokens.check(token())
    fetches.fail = True
    clock.now += 700
    tokens.check(token())
    tokens.check(token())  # and it waits a minute before trying again
    assert len(fetches.urls) == 2


def test_without_any_keys_sign_in_is_unavailable() -> None:
    fetches = Fetches()
    fetches.fail = True
    with pytest.raises(KeysUnavailable):
        TokenChecker(SUPABASE_URL, fetch=fetches).check(token())


@pytest.mark.parametrize(
    ("header", "expected"),
    [
        ("Bearer abc.def.ghi", "abc.def.ghi"),
        ("bearer  abc", "abc"),
        ("Basic abc", None),
        ("Bearer ", None),
        ("", None),
        (None, None),
        ("Bearer " + "a" * 9000, None),
    ],
)
def test_reading_the_header(header: str | None, expected: str | None) -> None:
    assert bearer_token(header) == expected


def test_the_stand_in_key_is_a_real_es256_key() -> None:
    assert PRIVATE_KEY.curve.name == "secp256r1"
    assert JWKS["keys"][0]["kty"] == "EC"
