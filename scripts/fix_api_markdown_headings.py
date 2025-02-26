# Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
# SPDX-License-Identifier: MIT-0

from pathlib import Path
from typing import List

import sys


def fix_markdown_content(file_path: Path) -> None:
    """Fix markdown heading levels in a file."""
    # Read the content of the file
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    # Fix heading levels
    lines = content.split("\n")
    modified_lines = []
    for line in lines:
        if line.startswith("#"):
            modified_lines.append("#" + line)
        else:
            modified_lines.append(line)
    content = "\n".join(modified_lines)

    # Write the modified content back to the file
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)


def process_markdown_files(files: List[str]) -> None:
    """Process the given markdown files."""
    for file_path in files:
        try:
            fix_markdown_content(Path(file_path))
            print(f"Processed: {file_path}")
        except Exception as e:
            print(f"Error processing {file_path}: {str(e)}", file=sys.stderr)


def main():
    if len(sys.argv) < 2:
        print(f"Usage: python {sys.argv[0]} FILE [FILE...]", file=sys.stderr)
        print(f"Example: python {sys.argv[0]} packages/api/generated/documentation/markdown/**/*.md", file=sys.stderr)
        sys.exit(1)

    # Process all files provided as arguments
    process_markdown_files(sys.argv[1:])


if __name__ == "__main__":
    main()
