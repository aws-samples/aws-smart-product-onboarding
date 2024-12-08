#!/usr/bin/env bash

# Get the current version
current_version=$(git describe --tags --abbrev=0 || echo "0.0.0")

# Determine if it's a breaking change
if git log ${current_version}..HEAD --grep="breaking change" -i --oneline | grep -q .; then
  new_version=$(echo $current_version | awk -F. '{print $1"."$2+1".0"}')
else
  new_version=$(echo $current_version | awk -F. '{print $1"."$2"."$3+1}')
fi

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

# Push changes and tag
git push origin HEAD:main
git tag -a $new_version -m "Release $new_version"
git push origin $new_version
