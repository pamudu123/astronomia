"""Stand-in Supabase sign in for tests: a signing key made here, its JWKS, and tokens it signs.

Real Supabase tokens are ES256 JWTs signed with the project's private key. These are made the
same way with a key that exists only in the test run, so the backend's checks run for real.
"""

import json
import time
import uuid
from typing import Any

import jwt
from cryptography.hazmat.primitives.asymmetric import ec
from fastapi.testclient import TestClient
from jwt.algorithms import ECAlgorithm

from app.auth import TokenChecker

SUPABASE_URL = "https://test-project.supabase.co"
ISSUER = f"{SUPABASE_URL}/auth/v1"
KID = "test-key-1"


def _jwk(key: ec.EllipticCurvePrivateKey, kid: str) -> dict[str, Any]:
    public: dict[str, Any] = json.loads(ECAlgorithm.to_jwk(key.public_key()))
    return {**public, "kid": kid, "alg": "ES256", "use": "sig"}


PRIVATE_KEY = ec.generate_private_key(ec.SECP256R1())
OTHER_KEY = ec.generate_private_key(ec.SECP256R1())  # a key Supabase never published
JWKS: dict[str, Any] = {"keys": [_jwk(PRIVATE_KEY, KID)]}


def token(
    user_id: str | None = None,
    *,
    anonymous: bool = True,
    key: ec.EllipticCurvePrivateKey = PRIVATE_KEY,
    kid: str = KID,
    algorithm: str = "ES256",
    lifetime: int = 3600,
    **claims: Any,
) -> str:
    """A Supabase access token. Any claim can be changed or removed (pass None)."""
    now = int(time.time())
    payload: dict[str, Any] = {
        "iss": ISSUER,
        "aud": "authenticated",
        "sub": user_id or str(uuid.uuid4()),
        "role": "authenticated",
        "is_anonymous": anonymous,
        "iat": now,
        "exp": now + lifetime,
        "session_id": str(uuid.uuid4()),
    }
    payload.update(claims)
    payload = {k: v for k, v in payload.items() if v is not None}
    return jwt.encode(payload, key, algorithm=algorithm, headers={"kid": kid})


def bearer(value: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {value}"}


def checker() -> TokenChecker:
    """Checks tokens against the stand-in keys, as the backend checks Supabase's."""
    return TokenChecker(SUPABASE_URL, fetch=lambda url: JWKS)


def browser(
    client: TestClient, user_id: str | None = None, *, anonymous: bool = True
) -> TestClient:
    """The same site, opened in a browser signed in as this user (a new guest by default)."""
    signed_in = TestClient(client.app)
    signed_in.headers.update(bearer(token(user_id, anonymous=anonymous)))
    return signed_in
