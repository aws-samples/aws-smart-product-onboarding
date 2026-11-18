# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0
"""Post a lane's verdict: one PR comment per lane (replaced on re-run) and a check run on the head SHA.

usage: post.py --lane opus|gpt --pr N --out DIR      (DIR holds result.json and comment.md)
       post.py --lane opus|gpt --pr N --head-sha SHA --skipped REASON
       post.py --lane opus|gpt --pr N --head-sha SHA --unfinished JOB_STATUS --started EPOCH --timeout-minutes M
"""

import argparse
import json
import os
import pathlib
import time

import github_api as gh
from ai_review import LANES, comment_marker, redact

BOT = "github-actions[bot]"
# Advisory phase: a BLOCK is reported as neutral, so it never reads as failed CI. Change BLOCK to
# "failure" when the maintainers want the lanes to gate merging.
CONCLUSIONS = {"PASS": "success", "BLOCK": "neutral", "INCOMPLETE": "neutral", "SKIPPED": "neutral"}


def should_report_unfinished(job_status: str, elapsed_s: float, timeout_minutes: int) -> bool:
    """Report a failed review, or one cancelled by the job timeout, but not one a newer run replaced.

    A job timeout and a `cancel-in-progress` cancellation both end the job as `cancelled`. Only the
    timeout happens at the time limit, so a cancellation that close to it is read as the timeout.
    shortcut: a newer push in the last minute before the limit is also reported; harmless, it names this run.
    """
    if job_status == "failure":
        return True
    return job_status == "cancelled" and elapsed_s >= timeout_minutes * 60 - 60


def find_lane_comment(comments, lane: str):
    """The bot's earlier comment for this lane, if any. Comments by anyone else are never touched."""
    marker = comment_marker(lane)
    for c in comments:
        if c.get("user", {}).get("login") == BOT and (c.get("body") or "").startswith(marker):
            return c
    return None


def upsert_comment(repo: str, pr: int, lane: str, body: str):
    existing = find_lane_comment(gh.paginate(f"/repos/{repo}/issues/{pr}/comments"), lane)
    if existing:
        gh.request("PATCH", f"/repos/{repo}/issues/comments/{existing['id']}", {"body": body})
    else:
        gh.request("POST", f"/repos/{repo}/issues/{pr}/comments", {"body": body})


def post_check(repo: str, lane: str, head_sha: str, verdict: str, summary: str):
    gh.request("POST", f"/repos/{repo}/check-runs", {
        "name": f"AI review: {LANES[lane]['name']}",
        "head_sha": head_sha,
        "status": "completed",
        "conclusion": CONCLUSIONS[verdict],
        "output": {"title": f"{verdict} (advisory)", "summary": summary[:60_000]},
    })


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--lane", choices=sorted(LANES), required=True)
    ap.add_argument("--pr", type=int, required=True)
    ap.add_argument("--out")
    ap.add_argument("--head-sha")
    ap.add_argument("--skipped")
    ap.add_argument("--unfinished", metavar="JOB_STATUS")
    ap.add_argument("--started", type=float)
    ap.add_argument("--timeout-minutes", type=int)
    a = ap.parse_args()
    repo = os.environ["GITHUB_REPOSITORY"]

    if a.unfinished:
        if should_report_unfinished(a.unfinished, time.time() - a.started, a.timeout_minutes):
            post_check(repo, a.lane, a.head_sha, "INCOMPLETE", "The review did not finish; see the workflow run.")
        else:
            print(f"not reporting: the job ended as {a.unfinished} before its time limit (replaced by a newer run)")
        return

    if a.skipped:
        post_check(repo, a.lane, a.head_sha, "SKIPPED", redact(a.skipped))
        return
    out = pathlib.Path(a.out)
    result = json.loads((out / "result.json").read_text())
    body = (out / "comment.md").read_text()
    head_sha = result["head_sha"]
    current = gh.get(f"/repos/{repo}/pulls/{a.pr}")["head"]["sha"]
    if current == head_sha:
        upsert_comment(repo, a.pr, a.lane, body)
    else:
        print(f"::notice::the head moved to {current}; the lane comment is left for that commit's review")
    post_check(repo, a.lane, head_sha, result["verdict"], redact(check_summary(a.lane, result), keep=(head_sha,)))
    print(f"posted {a.lane}: {result['verdict']}")


def check_summary(lane: str, result: dict) -> str:
    if result["verdict"] == "INCOMPLETE":
        return f"{LANES[lane]['name']} produced no verdict for this commit."
    items = "\n".join(f"- {i['anchor']}: {i['title']} ({i['location']})" for i in result["items"])
    return items or f"No blocking findings from {LANES[lane]['name']}."


if __name__ == "__main__":
    main()
