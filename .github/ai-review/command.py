# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0
"""Authorize an `/ai-review` PR comment and pin the head SHA to review.

Runs from the default branch on `issue_comment`. It reads the event and the GitHub API only; it never
checks out or runs code from the pull request.

usage: command.py authorize            (reads GITHUB_EVENT_PATH, writes GITHUB_OUTPUT)
       command.py dry-run --pr N --user LOGIN [--sha SHA]
"""

import argparse
import json
import os
import re
import sys
import urllib.error

import github_api as gh

COMMAND = re.compile(r"^/ai-review(?:\s+([0-9a-f]{7,40}))?$")
ALLOWED_PERMISSIONS = {"admin", "write"}  # the collaborators API reports the maintain role as "write"


def parse_command(body: str) -> tuple[bool, str | None]:
    """Return (is_command, requested_sha). Only a comment that is exactly the command counts."""
    m = COMMAND.match((body or "").rstrip())  # must start the comment, as the workflow's filter requires
    return (True, m.group(1)) if m else (False, None)


def permission_allows(permission_response: dict) -> bool:
    return permission_response.get("permission") in ALLOWED_PERMISSIONS


def pin_head(pr: dict, requested: str | None) -> tuple[str | None, str]:
    """Pin the PR's current head SHA. If the comment named a SHA, it must still be the head."""
    head = pr["head"]["sha"]
    if pr.get("state") != "open":
        return None, "the pull request is not open"
    if requested and not head.startswith(requested):
        return None, f"the head is now {head}, not {requested}; review the new commits and comment again"
    return head, ""


def authorize(repo: str, pr_number: int, user: str, user_type: str, body: str) -> dict:
    is_cmd, requested = parse_command(body)
    if not is_cmd:
        return {"allowed": False, "reason": "not an /ai-review command"}
    if user_type == "Bot":
        return {"allowed": False, "reason": "commands from bots are ignored"}
    try:
        perm = gh.get(f"/repos/{repo}/collaborators/{gh.quote(user)}/permission")
    except urllib.error.HTTPError as e:
        return {"allowed": False, "reason": f"permission lookup for {user} failed ({e.code})"}
    if not permission_allows(perm):
        return {"allowed": False, "reason": f"{user} needs write or admin permission"}
    pr = gh.get(f"/repos/{repo}/pulls/{pr_number}")
    head, reason = pin_head(pr, requested)
    if not head:
        return {"allowed": False, "reason": reason, "reply": True}
    return {"allowed": True, "head_sha": head, "head_repo": (pr["head"].get("repo") or {}).get("full_name", "")}


def main():
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("authorize")
    d = sub.add_parser("dry-run")
    d.add_argument("--pr", type=int, required=True)
    d.add_argument("--user", required=True)
    d.add_argument("--sha")
    a = ap.parse_args()
    repo = os.environ["GITHUB_REPOSITORY"]

    if a.cmd == "dry-run":
        body = "/ai-review" + (f" {a.sha}" if a.sha else "")
        print(json.dumps(authorize(repo, a.pr, a.user, "User", body)))
        return

    with open(os.environ["GITHUB_EVENT_PATH"]) as f:
        event = json.load(f)
    result = authorize(
        repo,
        event["issue"]["number"],
        event["comment"]["user"]["login"],
        event["comment"]["user"].get("type", ""),
        event["comment"]["body"],
    )
    print(json.dumps(result))
    with open(os.environ["GITHUB_OUTPUT"], "a") as f:
        f.write(f"allowed={'true' if result['allowed'] else 'false'}\n")
        f.write(f"head-sha={result.get('head_sha', '')}\n")
        f.write(f"reply={'true' if result.get('reply') else 'false'}\n")
        # the reason contains no newlines; it goes into a comment only for authorized users
        f.write(f"reason={result.get('reason', '').replace(chr(10), ' ')}\n")
    sys.exit(0)


if __name__ == "__main__":
    main()
