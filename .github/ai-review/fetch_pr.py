# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0
"""Fetch a pull request's title, body, diff and changed files at a pinned head SHA, as data only.

Nothing fetched here is checked out, built or executed. The diff comes from the compare
endpoint pinned to base...head, so a push after the run started cannot change what is reviewed.

usage: fetch_pr.py --repo OWNER/NAME --pr N --head-sha SHA --out DIR
"""

import argparse
import base64
import json
import pathlib
import re

import github_api as gh

MAX_DIFF_BYTES = 400_000
MAX_FILE_BYTES = 100_000
MAX_TOTAL_FILE_BYTES = 600_000
SKIP_FILES = re.compile(r"(^|/)(pnpm-lock\.yaml|package-lock\.json|[^/]*\.lock)$")
SHA = re.compile(r"^[0-9a-f]{40}$")


def select_files(files: list[dict]) -> list[dict]:
    """Decide which changed files to include in full; record why the others were left out."""
    out = []
    for f in files:
        entry = {"path": f["filename"], "status": f["status"], "included": False, "reason": ""}
        if f["status"] == "removed":
            entry["reason"] = "removed"
        elif SKIP_FILES.search(f["filename"]):
            entry["reason"] = "lock file"
        else:
            entry["included"] = True
        out.append(entry)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--repo", required=True)
    ap.add_argument("--pr", type=int, required=True)
    ap.add_argument("--head-sha", required=True)
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    if not SHA.match(a.head_sha):
        raise SystemExit("head SHA must be 40 lowercase hex characters")

    out = pathlib.Path(a.out)
    (out / "files").mkdir(parents=True, exist_ok=True)
    pr = gh.get(f"/repos/{a.repo}/pulls/{a.pr}")
    base_sha = pr["base"]["sha"]
    meta = {
        "number": a.pr,
        "title": pr.get("title") or "",
        "body": pr.get("body") or "",
        "base_sha": base_sha,
        "head_sha": a.head_sha,
        "current_head_sha": pr["head"]["sha"],
        "head_repo": (pr["head"].get("repo") or {}).get("full_name", ""),
    }

    diff = gh.get(f"/repos/{a.repo}/compare/{base_sha}...{a.head_sha}", accept="application/vnd.github.diff", raw=True)
    meta["diff_truncated"] = len(diff) > MAX_DIFF_BYTES
    (out / "diff.patch").write_bytes(diff[:MAX_DIFF_BYTES])

    compare = gh.get(f"/repos/{a.repo}/compare/{base_sha}...{a.head_sha}")
    files = select_files(compare.get("files", []))
    total = 0
    for entry in files:
        if not entry["included"]:
            continue
        blob = gh.get(f"/repos/{a.repo}/contents/{gh.quote(entry['path'])}?ref={a.head_sha}")
        if blob.get("encoding") != "base64":
            # the contents API returns no inline content for files over 1 MB
            entry.update(included=False, reason=f"larger than {MAX_FILE_BYTES} bytes")
            continue
        data = base64.b64decode(blob.get("content", ""))
        if b"\0" in data[:8000]:
            entry.update(included=False, reason="binary")
        elif len(data) > MAX_FILE_BYTES:
            entry.update(included=False, reason=f"larger than {MAX_FILE_BYTES} bytes")
        elif total + len(data) > MAX_TOTAL_FILE_BYTES:
            entry.update(included=False, reason="total size limit reached")
        else:
            total += len(data)
            dest = (out / "files" / entry["path"]).resolve()
            if not dest.is_relative_to((out / "files").resolve()):
                entry.update(included=False, reason="unsafe path")
                continue
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_bytes(data)
    meta["files"] = files
    (out / "pr.json").write_text(json.dumps(meta, indent=1))
    print(f"fetched PR #{a.pr} at {a.head_sha}: {len(diff)} diff bytes, "
          f"{sum(f['included'] for f in files)}/{len(files)} files included")


if __name__ == "__main__":
    main()
