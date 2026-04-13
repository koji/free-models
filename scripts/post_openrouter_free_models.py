from __future__ import annotations

import os
import sys
from dataclasses import dataclass
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from typing import Any

import requests
from atproto import Client, models

OPENROUTER_MODELS_URL = "https://openrouter.ai/api/v1/models"
POST_CHAR_LIMIT = 300
SAFETY_MARGIN = 4


@dataclass(frozen=True)
class Model:
    model_id: str
    name: str
    context_length: int | None


def to_decimal(value: Any) -> Decimal | None:
    if value is None or value == "":
        return None
    try:
        return Decimal(str(value))
    except (InvalidOperation, ValueError):
        return None


def is_free_pricing(pricing: dict[str, Any] | None) -> bool:
    if not isinstance(pricing, dict) or not pricing:
        return False

    has_numeric_value = False
    for value in pricing.values():
        dec = to_decimal(value)
        if dec is None:
            continue
        has_numeric_value = True
        if dec != 0:
            return False

    return has_numeric_value


def fetch_models() -> list[Model]:
    headers = {
        "Accept": "application/json",
        "User-Agent": "openrouter-free-models-bot/1.0",
    }

    response = requests.get(OPENROUTER_MODELS_URL, headers=headers, timeout=30)
    response.raise_for_status()

    payload = response.json()
    items = payload.get("data", [])

    models: list[Model] = []
    for item in items:
        if not is_free_pricing(item.get("pricing")):
            continue

        model_id = item.get("id")
        if not model_id:
            continue

        models.append(
            Model(
                model_id=model_id,
                name=item.get("name") or model_id,
                context_length=item.get("context_length"),
            )
        )

    models.sort(key=lambda m: m.model_id.lower())
    return models


def build_header(model_count: int) -> str:
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    return f"OpenRouter free models ({model_count})\nUpdated: {now}\n#OpenRouter #LLM"


def normalize_line(line: str, max_len: int) -> str:
    if len(line) <= max_len:
        return line
    return line[: max_len - 1] + "…"


def split_into_posts(lines: list[str], header: str) -> list[str]:
    max_len = POST_CHAR_LIMIT - SAFETY_MARGIN
    posts: list[str] = []
    current = header

    for raw_line in lines:
        line = normalize_line(raw_line, max_len)
        candidate = f"{current}\n{line}"

        if len(candidate) <= max_len:
            current = candidate
        else:
            posts.append(current)
            current = line

    if current:
        posts.append(current)

    if len(posts) == 1:
        return posts

    renumbered: list[str] = []
    total = len(posts)
    for i, post in enumerate(posts, start=1):
        prefix = f"({i}/{total}) "
        body = post
        allowed = max_len - len(prefix)

        if len(body) > allowed:
            body = body[: allowed - 1] + "…"

        renumbered.append(prefix + body)

    return renumbered


def build_post_texts(models: list[Model]) -> list[str]:
    if not models:
        return ["OpenRouter free models (0)\nNo free models found.\n#OpenRouter #LLM"]

    header = build_header(len(models))
    lines = [f"- {model.model_id}" for model in models]
    return split_into_posts(lines, header)


def get_required_env(name: str) -> str:
    value = os.getenv(name)
    if value is None or value == "":
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value.strip().strip('"').strip("'")


def create_bluesky_client() -> Client:
    identifier = get_required_env("BLUESKY_IDENTIFIER").lstrip("@")
    password = get_required_env("BLUESKY_APP_PASSWORD")

    client = Client()
    client.login(identifier, password)
    return client


def to_strong_ref(
    post: models.AppBskyFeedPost.CreateRecordResponse,
) -> models.ComAtprotoRepoStrongRef.Main:
    return models.ComAtprotoRepoStrongRef.Main(uri=post.uri, cid=post.cid)


def post_sequence(client: Client, texts: list[str]) -> None:
    root_ref: models.ComAtprotoRepoStrongRef.Main | None = None
    parent_ref: models.ComAtprotoRepoStrongRef.Main | None = None

    for index, text in enumerate(texts, start=1):
        print(f"Posting Bluesky post #{index}...", flush=True)

        reply_to = None
        if root_ref is not None and parent_ref is not None:
            reply_to = models.AppBskyFeedPost.ReplyRef(
                root=root_ref,
                parent=parent_ref,
            )

        post = client.send_post(text=text, reply_to=reply_to)
        print(f"Posted Bluesky post #{index}: {post.uri}", flush=True)

        current_ref = to_strong_ref(post)
        if root_ref is None:
            root_ref = current_ref
        parent_ref = current_ref


def main() -> int:
    try:
        models = fetch_models()
        posts = build_post_texts(models)

        print(f"Found {len(models)} free models", flush=True)
        print(f"Posting {len(posts)} Bluesky post(s)", flush=True)

        client = create_bluesky_client()
        post_sequence(client, posts)

        print("Done", flush=True)
        return 0
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr, flush=True)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
