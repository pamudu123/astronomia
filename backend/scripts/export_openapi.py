"""Write the API description to backend/openapi.json for the frontend's type generation.

Run from backend/:  uv run python scripts/export_openapi.py
"""

import json
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))

from app.main import create_app  # noqa: E402

out = BACKEND / "openapi.json"
# LF on every system: the repository is LF, and Windows would otherwise write CRLF.
out.write_text(json.dumps(create_app().openapi(), indent=2) + "\n", newline="\n")
print(f"wrote {out}")
