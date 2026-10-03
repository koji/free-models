"""Conformance tests for the free-model filter against the shared fixture.

The filter (is_free_model / is_free_pricing) is implemented twice in this repo:
here in scripts/post_openrouter_free_models.py and in website/src/cron.ts.
scripts/tests/fixtures/free-model-cases.json pins the agreed behavior of both;
this suite asserts the Python implementation against every case.

Run from the repo root:
    python3 -m unittest discover -s scripts/tests -v
"""

from __future__ import annotations

import json
import os
import sys
import unittest
from typing import Any

# Import the script under test without triggering Bluesky/atproto side effects:
# the module has no top-level side effects, but atproto may not be installed in
# the test environment, so stub it before import (the filter functions never
# touch it).
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
_atproto_stub = type(sys)("atproto")
_atproto_stub.Client = object  # type: ignore[attr-defined]
_atproto_stub.models = type(sys)("atproto.models")  # type: ignore[attr-defined]
sys.modules.setdefault("atproto", _atproto_stub)
sys.modules.setdefault("atproto.models", _atproto_stub.models)

from post_openrouter_free_models import is_free_model  # noqa: E402

FIXTURE_PATH = os.path.join(os.path.dirname(__file__), "fixtures", "free-model-cases.json")


def load_cases() -> list[dict[str, Any]]:
    with open(FIXTURE_PATH, encoding="utf-8") as f:
        return json.load(f)["cases"]


class FreeModelFilterCases(unittest.TestCase):
    def test_fixture_cases(self) -> None:
        for case in load_cases():
            with self.subTest(case["description"]):
                expected = case.get("expected_py", case["expected"])
                self.assertEqual(
                    is_free_model(case["id"], case["pricing"]),
                    expected,
                    msg=f"case: {case['description']}",
                )


if __name__ == "__main__":
    unittest.main()
