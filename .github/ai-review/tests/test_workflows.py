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
ALL = {"lane": LANE, "pr": PR, "command": COMMAND}


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
        self.assertIn("ref: ${{ inputs.trusted-ref }}", checkouts[0])
        # the only other checkout is the same-repo fallback, gated on its input and on a missing reviewer
        for step in checkouts[1:]:
            self.assertIn("if: inputs.allow-head-fallback && hashFiles(", step)
            self.assertIn("sparse-checkout: .github/ai-review", step)
        self.assertIn("trusted-ref: ${{ github.event.pull_request.base.sha }}", PR)
        self.assertIn("trusted-ref: ${{ github.sha }}", COMMAND)

    def test_command_path_never_uses_pull_request_code(self):
        self.assertNotIn("allow-head-fallback", COMMAND)
        self.assertNotRegex(COMMAND, r"ref: .*(head|refs/pull)")
        self.assertIn("ref: ${{ github.event.repository.default_branch }}", COMMAND)
        self.assertIn("head-sha: ${{ needs.authorize.outputs.head-sha }}", COMMAND)

    def test_credentials_assumed_after_installs(self):
        names = [s.split("\n", 1)[0] for s in steps(LANE)]
        creds = next(i for i, s in enumerate(steps(LANE)) if "configure-aws-credentials@" in s)
        install = names.index("Install the reviewer's dependencies")
        self.assertGreater(creds, install)
        self.assertIn("--require-hashes", steps(LANE)[install])

    def test_forks_and_dependabot_not_reviewed_automatically(self):
        self.assertIn("github.event.pull_request.head.repo.full_name == github.repository", PR)
        self.assertIn("github.event.pull_request.user.login != 'dependabot[bot]'", PR)
        self.assertIn("github.actor != 'dependabot[bot]'", PR)
        self.assertNotIn("pull_request_target", PR + COMMAND + LANE)

    def test_oidc_scoped_by_environment(self):
        self.assertIn("environment: ai-review", LANE)
        self.assertIn("role-to-assume: ${{ vars.AI_REVIEW_ROLE_ARN }}", LANE)
        self.assertNotRegex(LANE + PR + COMMAND, r"\d{12}")

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
        self.assertEqual(set(re.findall(r"Action: \[(.*)\]", iam)),
                         {"bedrock:InvokeModel, bedrock:InvokeModelWithResponseStream"})
        self.assertIn("aws:RequestedRegion: unspecified", iam)


if __name__ == "__main__":
    unittest.main()
