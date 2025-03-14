#!/usr/bin/env bash
# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0


set -e

# must be run from project root
if [ ! -f "pnpm-lock.yaml" ]; then
    echo "Must be run from project root"
    exit 1
fi

# takes one argument, the output pdf filename
if [ $# -ne 1 ]; then
    echo "Usage: $0 <output.pdf>"
    exit 1
fi
# validate that output is pdf
if [[ $1 != *.pdf ]]; then
    echo "Output must be a pdf file"
    exit 1
fi

pushd packages/api/generated/documentation/markdown
pnpm dlx projen compile
popd

python ./scripts/fix_api_markdown_links.py packages/api/generated/documentation/markdown/README.md \
  packages/api/generated/documentation/markdown/**/*.md
python ./scripts/fix_api_markdown_headings.py packages/api/generated/documentation/markdown/**/*.md

pandoc --metadata title="Smart Product Onboarding" \
  -V colorlinks=true -V linkcolor=blue -V toccolor=gray -V urlcolor=blue \
  -f markdown-implicit_figures \
  --file-scope \
  --number-sections --toc --toc-depth=2 -s \
  README.md \
  architecture.md \
  documentation/generate-product-data-from-images.md \
  documentation/bottom-up-product-categorization/index.md \
  documentation/bottom-up-product-categorization/category-tree-preparation.md \
  documentation/bottom-up-product-categorization/metaclass-task.md \
  documentation/bottom-up-product-categorization/categorization-task.md \
  documentation/extract-attributes.md \
  documentation/security.md \
  packages/website/README.md \
  packages/api/generated/documentation/markdown/README.md \
  packages/api/generated/documentation/markdown/**/*.md \
  -o $1