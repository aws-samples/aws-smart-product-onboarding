# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0
"""Minimal GitHub REST client for the AI review scripts (standard library only)."""

import json
import os
import urllib.parse
import urllib.request

API = os.getenv("GITHUB_API_URL", "https://api.github.com")


def request(method: str, path: str, body=None, accept: str = "application/vnd.github+json", raw: bool = False):
    req = urllib.request.Request(
        API + path,
        method=method,
        data=json.dumps(body).encode() if body is not None else None,
        headers={
            "Authorization": f"Bearer {os.environ['GH_TOKEN']}",
            "Accept": accept,
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "ai-review",
        },
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        data = resp.read()
    if raw:
        return data
    return json.loads(data) if data else None


def get(path: str, **kwargs):
    return request("GET", path, **kwargs)


def paginate(path: str):
    """Yield items from a list endpoint, 100 per page."""
    sep = "&" if "?" in path else "?"
    page = 1
    while True:
        items = get(f"{path}{sep}per_page=100&page={page}")
        if not items:
            return
        yield from items
        if len(items) < 100:
            return
        page += 1


def quote(path: str) -> str:
    return urllib.parse.quote(path)
