#!/usr/bin/env bash
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

set -e  # Exit on error

# Check if we're on main branch
current_branch=$(git rev-parse --abbrev-ref HEAD)
if [ "$current_branch" != "main" ]; then
  echo "Error: You must be on the main branch to create a release."
  echo "Current branch: $current_branch"
  exit 1
fi

# Fetch latest changes from origin
echo "Fetching latest changes from origin..."
git fetch origin

# Check if main is up to date with origin/main
LOCAL=$(git rev-parse main)
REMOTE=$(git rev-parse origin/main)

if [ "$LOCAL" != "$REMOTE" ]; then
  echo "Error: Your main branch is not up to date with origin/main."
  echo "Please run: git pull origin main"
  exit 1
fi

# Get the current version
current_version=$(git describe --tags --abbrev=0 || echo "0.0.0")

# Determine if it's a breaking change
if git log ${current_version}..HEAD --grep="breaking change" -i --oneline | grep -q .; then
  new_version=$(echo $current_version | awk -F. '{print $1"."$2+1".0"}')
else
  new_version=$(echo $current_version | awk -F. '{print $1"."$2"."$3+1}')
fi

echo "Current version: $current_version"
echo "New version: $new_version"

# Create release branch
release_branch="bump/${new_version}"
echo "Creating release branch: $release_branch"
git checkout -b $release_branch

# Create release notes for the new changes
{
  echo "## [${new_version}] - $(date +%Y-%m-%d)"
  echo ""
  echo "### Changed"
  git log ${current_version}..HEAD --pretty=format:"- %s"
} > RELEASE_NOTES.md

# Update CHANGELOG.md
{
  echo "# Changelog"
  echo ""
  echo "All notable changes to this project will be documented in this file."
  echo ""
  echo "The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),"
  echo "and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html)."
  echo ""
  cat RELEASE_NOTES.md
  echo ""
  sed '1,6d' CHANGELOG.md
} > CHANGELOG.tmp
mv CHANGELOG.tmp CHANGELOG.md

# Commit CHANGELOG.md
git add CHANGELOG.md RELEASE_NOTES.md
git commit -m "chore: release version $new_version"

# Create and push tag
git tag -a $new_version -m "Release $new_version"

# Push release branch and tag
echo "Pushing release branch and tag to origin..."
git push origin $release_branch
git push origin $new_version

echo ""
echo "✅ Release branch created successfully!"
echo ""
echo "Next steps:"
echo "1. Create a pull request from $release_branch to main"
echo "2. After approval, merge using fast-forward"
echo "3. The tag $new_version has been pushed and will be available once merged"
echo ""
echo "To switch back to main: git checkout main"
