# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0
"""One AI review lane: a discovery pass, then an independent falsification pass, on Amazon Bedrock.

usage: ai_review.py --lane opus|gpt --data DIR --out DIR

Reads the data written by fetch_pr.py and writes result.json and comment.md to --out. The lane sees
only the pull request and its own passes, never another lane's output.
"""

import argparse
import json
import pathlib
import re
import secrets

HERE = pathlib.Path(__file__).parent
REGION = "us-west-2"
LANES = {
    "opus": {"name": "Claude Opus", "model": "global.anthropic.claude-opus-5-5"},
    "gpt": {"name": "GPT", "model": "global.openai.gpt-6.2-sol"},
}
ANCHORS = {
    "auth-on-route",
    "request-validation",
    "iam-least-privilege",
    "logical-id-stability",
    "secrets-log-hygiene",
    "broken-contract",
    "weakened-tests-ci",
    "defect",
}
MAX_OUTPUT_TOKENS = 16_000
USAGE_KEYS = ("inputTokens", "cacheReadInputTokens", "cacheWriteInputTokens", "outputTokens")
COMMENT_LIMIT = 60_000


# ---------- prompt assembly ----------


def untrusted(label: str, text: str, nonce: str, path: str = "") -> str:
    """Wrap text as delimited untrusted data. The nonce makes the closing tag impossible to forge."""
    tag = f"untrusted-{label}-{nonce}"
    attr = f" path={json.dumps(path)}" if path else ""
    return f"<{tag}{attr}>\n{text.replace(tag, '[removed]')}\n</{tag}>"


def code_context(data: pathlib.Path, nonce: str) -> str:
    meta = json.loads((data / "pr.json").read_text())
    parts = [untrusted("pr-title", meta["title"], nonce), untrusted("pr-description", meta["body"], nonce)]
    diff = (data / "diff.patch").read_text(errors="replace")
    if meta.get("diff_truncated"):
        diff += "\n[diff truncated]"
    parts.append(untrusted("diff", diff, nonce))
    for f in meta["files"]:
        if f["included"]:
            text = (data / "files" / f["path"]).read_text(errors="replace")
            parts.append(untrusted("file", text, nonce, path=f["path"]))
    left_out = [f"- {json.dumps(f['path'])} ({f['reason']})" for f in meta["files"] if not f["included"]]
    if left_out:
        parts.append("Changed files not shown in full:\n" + untrusted("file-list", "\n".join(left_out), nonce))
    return "\n\n".join(parts)


def prompt(stage: str, head_sha: str, context: str, candidates: str | None = None, nonce: str = "") -> str:
    rubric = (HERE / "prompts" / "rubric.md").read_text()
    instructions = (HERE / "prompts" / f"{stage}.md").read_text()
    body = [instructions, rubric, f"Head SHA: {head_sha}", context]
    if candidates is not None:
        body.append("First-pass candidates:\n" + untrusted("candidates", candidates, nonce))
    return "\n\n".join(body)


# ---------- model calls ----------


def converse(client, model_id: str, text: str) -> tuple[str, dict]:
    resp = client.converse(
        modelId=model_id,
        messages=[{"role": "user", "content": [{"text": text}]}],
        inferenceConfig={"maxTokens": MAX_OUTPUT_TOKENS},
    )
    blocks = resp["output"]["message"]["content"]
    out = "".join(b["text"] for b in blocks if "text" in b)
    if resp.get("stopReason") == "max_tokens":
        out = ""  # a cut-off reply may have lost its last finding or its closing marker; treat it as no verdict
    return out, {k: resp["usage"].get(k, 0) for k in USAGE_KEYS}


# ---------- verdict parsing ----------


def has_marker(text: str, marker: str, head_sha: str) -> bool:
    return re.search(rf"^\s*\[{re.escape(marker)}\]\s+{head_sha}\s*$", text, re.MULTILINE) is not None


def blocking_items(text: str) -> list[dict]:
    """Split the review into `### BLOCKING` sections and read their labelled lines."""
    items = []
    for section in re.split(r"^###\s+", text, flags=re.MULTILINE)[1:]:
        title, _, rest = section.partition("\n")
        if not title.upper().startswith("BLOCKING"):
            continue
        item = {"title": title.split(":", 1)[-1].strip()}
        for key in ("Location", "Trigger", "Outcome", "Anchor"):
            m = re.search(rf"^[ \t]*{key}:[ \t]*(\S.*)$", rest, re.MULTILINE)
            item[key.lower()] = m.group(1).strip() if m else ""
        items.append(item)
    return items


def substantiated(item: dict) -> bool:
    m = re.match(r"[`*\s]*([a-z][a-z-]*)", item["anchor"].lower())
    return bool(item["trigger"]) and bool(item["outcome"]) and bool(m) and m.group(1) in ANCHORS


def decide(text: str, head_sha: str) -> dict:
    """Return the lane's verdict: PASS, BLOCK or INCOMPLETE (no reviewed marker for this head)."""
    if not has_marker(text, "AI-REVIEWED", head_sha):
        return {"verdict": "INCOMPLETE", "items": [], "dropped": 0}
    items = blocking_items(text)
    kept = [i for i in items if substantiated(i)]
    if has_marker(text, "BLOCK-MERGE", head_sha) and kept:
        return {"verdict": "BLOCK", "items": kept, "dropped": len(items) - len(kept)}
    if kept and re.search(r"^[ \t]*Verdict:[ \t]*BLOCK\b", text, re.MULTILINE):
        # a substantiated BLOCK that lost its closing marker is no verdict, not a pass
        return {"verdict": "INCOMPLETE", "items": [], "dropped": 0}
    return {"verdict": "PASS", "items": [], "dropped": len(items)}


# ---------- output hygiene ----------

REDACTIONS = [
    (re.compile(r"arn:aws[a-z-]*:[^\s`'\"<>)]+"), "arn:<redacted>"),
    (re.compile(r"\b(?:AKIA|ASIA|ABIA|ACCA)[A-Z0-9]{16}\b"), "<redacted-key-id>"),
    (re.compile(r"(?i)(secret[_ -]?access[_ -]?key|session[_ -]?token|aws_secret\w*)(\s*[:=]\s*)\S+"),
     r"\1\2<redacted>"),
    # secret-key shape; an all-lowercase-hex 40 (a git SHA) is left readable
    (re.compile(r"(?<![A-Za-z0-9/+=])(?=[A-Za-z0-9/+]{0,39}[A-Z/+])[A-Za-z0-9/+]{40}(?![A-Za-z0-9/+=])"),
     "<redacted-40>"),
    (re.compile(r"(?<![\w/+=-])[A-Za-z0-9/+=]{200,}"), "<redacted-token>"),
    (re.compile(r"(?<!\d)\d{12}(?!\d)"), "<account-id>"),
]


def redact(text: str, keep: tuple[str, ...] = ()) -> str:
    """Remove account IDs, ARNs and credential shapes. Strings in `keep` (such as the head SHA) survive."""
    saved = {f"\0{i}\0": k for i, k in enumerate(keep)}
    for placeholder, k in saved.items():
        text = text.replace(k, placeholder)
    for pattern, repl in REDACTIONS:
        text = pattern.sub(repl, text)
    for placeholder, k in saved.items():
        text = text.replace(placeholder, k)
    return text.replace("@", "@\u200b")  # no mentions or team pings from model text


def comment_marker(lane: str) -> str:
    return f"<!-- ai-review-lane:{lane} -->"


def render_comment(lane: str, head_sha: str, result: dict, review_text: str, usage: dict) -> str:
    name = LANES[lane]["name"]
    verdict = result["verdict"]
    lines = [
        comment_marker(lane),
        f"## AI review ({name}): {verdict}",
        f"Commit `{head_sha}`, model `{LANES[lane]['model']}`. Advisory only; this check does not block merging.",
        "",
    ]
    if verdict == "INCOMPLETE":
        lines.append("The review produced no verdict for this commit. Re-run the job to try again.")
    else:
        lines += ["<details><summary>Review</summary>", "", review_text.strip()[:COMMENT_LIMIT], "", "</details>"]
    if result.get("dropped"):
        lines.append(f"\n{result['dropped']} blocking item(s) without a Trigger, Outcome and rule Anchor were ignored.")
    tokens_in = usage["inputTokens"] + usage.get("cacheReadInputTokens", 0) + usage.get("cacheWriteInputTokens", 0)
    lines.append(f"\nTokens: {tokens_in} in, {usage['outputTokens']} out (both passes).")
    return redact("\n".join(lines), keep=(head_sha, comment_marker(lane)))


# ---------- main ----------


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--lane", choices=sorted(LANES), required=True)
    ap.add_argument("--data", required=True)
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    import boto3  # imported here so the unit tests need no AWS SDK
    from botocore.config import Config

    data, out = pathlib.Path(a.data), pathlib.Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    head_sha = json.loads((data / "pr.json").read_text())["head_sha"]
    model = LANES[a.lane]["model"]
    client = boto3.client("bedrock-runtime", region_name=REGION,
                          config=Config(read_timeout=900, retries={"max_attempts": 4, "mode": "adaptive"}))
    nonce = secrets.token_hex(8)
    context = code_context(data, nonce)

    discovery, u1 = converse(client, model, prompt("discovery", head_sha, context))
    usage = {k: u1[k] for k in u1}
    if has_marker(discovery, "AI-DISCOVERY", head_sha):
        review, u2 = converse(client, model, prompt("falsification", head_sha, context, discovery, nonce))
        usage = {k: usage[k] + u2[k] for k in usage}
    else:
        review = ""
    result = decide(review, head_sha)
    result.update(lane=a.lane, head_sha=head_sha, model=model, usage=usage)
    (out / "result.json").write_text(json.dumps(result, indent=1))
    (out / "comment.md").write_text(render_comment(a.lane, head_sha, result, review, usage))
    print(f"{a.lane}: {result['verdict']} ({len(result['items'])} blocking), tokens {usage}")


if __name__ == "__main__":
    main()
