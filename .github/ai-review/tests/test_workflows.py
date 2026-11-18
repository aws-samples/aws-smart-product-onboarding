# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0
"""Pin the hardening properties of the AI review workflows (plain text checks, no YAML library)."""

import pathlib
import re
import sys
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
WORKFLOWS = pathlib.Path(__file__).resolve().parents[2] / "workflows"
LANE = (WORKFLOWS / "ai-review-lane.yml").read_text()
PR = (WORKFLOWS / "ai-review.yml").read_text()
COMMAND = (WORKFLOWS / "ai-review-command.yml").read_text()
DISPATCH = (WORKFLOWS / "ai-review-dispatch.yml").read_text()
ALL = {"lane": LANE, "pr": PR, "command": COMMAND, "dispatch": DISPATCH}


def steps(text: str) -> list[str]:
    return re.split(r"\n      - name: ", text)[1:]


class Hardening(unittest.TestCase):
    def test_no_default_token_permissions(self):
        for name, text in ALL.items():
            self.assertRegex(text, r"\npermissions: \{\}\n", name)

    def test_every_checkout_drops_credentials(self):
        for name, text in ALL.items():
            for step in steps(text):
                if "actions/checkout@" in step:
                    self.assertIn("persist-credentials: false", step, name)

    def test_actions_pinned_to_commits(self):
        for name, text in ALL.items():
            for ref in re.findall(r"uses: ([\w./-]+@\S+)", text):
                if not ref.startswith("./"):
                    self.assertRegex(ref, r"@[0-9a-f]{40}$", name)

    def test_reviewer_comes_from_trusted_ref(self):
        checkouts = [s for s in steps(LANE) if "actions/checkout@" in s]
        self.assertEqual(len(checkouts), 1)
        self.assertIn("ref: ${{ inputs.trusted-ref }}", checkouts[0])
        self.assertIn("sparse-checkout: .github/ai-review", checkouts[0])
        # the reusable lane never refers to the pull request head as something to check out
        self.assertNotRegex(LANE, r"ref: \$\{\{ inputs\.head-sha")
        # same-repo: the base commit, or this pull request's copy only on a confirmed 404 for the base
        self.assertIn("trusted-ref: ${{ needs.reviewer.outputs.ref }}", PR)
        pick = next(s for s in steps(PR) if s.startswith("Choose the commit the reviewer runs from"))
        self.assertIn("gh api --include", pick)
        self.assertRegex(pick, r'200\)\n\s+echo "ref=\$BASE_SHA"')
        self.assertRegex(pick, r'404\)\n.*\n\s+echo "ref=\$HEAD_SHA"')
        self.assertRegex(pick, r"\*\)\n.*::error::.*\n\s+exit 1")
        self.assertNotIn("else", pick)
        # dispatched: the default branch, and only when started from it
        self.assertIn("trusted-ref: ${{ github.sha }}", DISPATCH)
        self.assertIn("if: github.ref == format('refs/heads/{0}', github.event.repository.default_branch)", DISPATCH)

    def test_command_path_never_uses_pull_request_code(self):
        self.assertNotRegex(COMMAND, r"ref: .*(head|refs/pull)")
        self.assertIn("ref: ${{ github.event.repository.default_branch }}", COMMAND)
        self.assertNotIn("uses: ./", COMMAND)  # the privileged comment job runs no review itself
        self.assertNotIn("id-token", COMMAND)
        self.assertIn('gh workflow run ai-review-dispatch.yml --repo "$GITHUB_REPOSITORY" --ref "$DEFAULT_BRANCH"',
                      COMMAND)
        self.assertIn('-f head-sha="$HEAD_SHA"', COMMAND)
        self.assertIn("HEAD_SHA: ${{ steps.check.outputs.head-sha }}", COMMAND)

    def test_credentials_assumed_after_installs(self):
        names = [s.split("\n", 1)[0] for s in steps(LANE)]
        creds = next(i for i, s in enumerate(steps(LANE)) if "configure-aws-credentials@" in s)
        install = names.index("Install the reviewer's dependencies")
        self.assertGreater(creds, install)
        self.assertIn("--require-hashes", steps(LANE)[install])

    def test_unconfigured_lane_posts_before_any_install(self):
        names = [s.split("\n", 1)[0] for s in steps(LANE)]
        configured = names.index("Skip when the review role is not configured")
        install = names.index("Install the reviewer's dependencies")
        self.assertLess(configured, install)
        self.assertIn('python3 "$REVIEWER/post.py"', steps(LANE)[configured])
        self.assertIn("if: steps.configured.outputs.ok == 'true'", steps(LANE)[install])

    def test_unfinished_step_covers_timeouts(self):
        step = next(s for s in steps(LANE) if s.startswith("Report a review that could not finish"))
        self.assertIn("if: (failure() || cancelled()) && steps.configured.outputs.ok == 'true'", step)
        self.assertIn("--unfinished", step)
        self.assertIn("${{ job.status }}", step)
        timeout = re.search(r"timeout-minutes: (\d+)", LANE).group(1)
        self.assertIn(f'JOB_TIMEOUT_MINUTES: "{timeout}"', LANE)
        self.assertTrue(steps(LANE)[0].startswith("Record the job start time"))

    def test_retarget_re_reviews_but_other_edits_do_not(self):
        self.assertIn("types: [opened, synchronize, reopened, ready_for_review, edited]", PR)
        self.assertIn("&& (github.event.action != 'edited' || github.event.changes.base)", PR)

    def test_forks_and_dependabot_not_reviewed_automatically(self):
        self.assertIn("github.event.pull_request.head.repo.full_name == github.repository", PR)
        self.assertIn("github.event.pull_request.user.login != 'dependabot[bot]'", PR)
        self.assertIn("github.actor != 'dependabot[bot]'", PR)
        self.assertNotIn("pull_request_target", PR + COMMAND + LANE + DISPATCH)

    def test_oidc_scoped_by_environment(self):
        self.assertIn("environment: ai-review", LANE)
        self.assertIn("role-to-assume: ${{ vars.AI_REVIEW_ROLE_ARN }}", LANE)
        self.assertNotRegex(LANE + PR + COMMAND + DISPATCH, r"\d{12}")

    def test_iam_policy_covers_exactly_the_lane_models(self):
        import ai_review

        iam = (WORKFLOWS.parent / "ai-review" / "iam.yaml").read_text()
        for lane in ai_review.LANES.values():
            profile = lane["model"]
            model = profile.split(".", 1)[1]
            self.assertTrue(profile.startswith("global."), profile)
            # the profile resource, plus the profile condition on both model statements
            self.assertEqual(iam.count(f":inference-profile/{profile}"), 3, profile)
            self.assertIn(f"bedrock:${{AWS::Region}}::foundation-model/{model}", iam)
            self.assertIn(f"bedrock:::foundation-model/{model}", iam)
        self.assertEqual(re.findall(r"Action: (.*)", iam).count("bedrock:InvokeModel"), 3)
        self.assertEqual(len(re.findall(r"Action: (.*)", iam)), 4)  # plus sts:AssumeRoleWithWebIdentity
        self.assertIn("aws:RequestedRegion: unspecified", iam)


if __name__ == "__main__":
    unittest.main()
