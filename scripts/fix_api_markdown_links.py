import re
import os
from pathlib import Path
import sys
from typing import List


def convert_to_root_relative_path(current_file: Path, link_path: str) -> str:
    """Convert a relative link to a root-relative path."""
    # Handle fragment-only links (e.g., #section)
    if link_path.startswith("#"):
        return link_path

    # Resolve the link path relative to the current file
    absolute_link_path = (current_file.parent / link_path).resolve()

    # Convert to relative path from repo root
    try:
        return str(absolute_link_path.relative_to(Path.cwd()))
    except ValueError:
        return link_path


def get_target_file_anchor(file_path: Path) -> str:
    """Get the anchor from the first heading in a markdown file."""
    with open(file_path, "r", encoding="utf-8") as f:
        for line in f:
            if line.startswith("#"):
                return "#" + line.lstrip("#").strip().replace(" ", "-").lower()
    return ""


def fix_markdown_links(file_path: Path) -> None:
    """Fix markdown links in a file to be relative to repo root."""
    # Read the content of the file
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    # Regular expression to match markdown links
    # Captures: [link text](link path) or [[link text]](link path)
    link_pattern = r"(\[+[^\]]+\]+)\(([^)]+)\)"

    def replace_link(match):
        link_text = match.group(1)
        link_path = match.group(2)

        # Split link path and fragment
        path_parts = link_path.split("#")
        base_path = path_parts[0]
        fragment = f"#{path_parts[1]}" if len(path_parts) > 1 else None

        if base_path:
            # Convert the path to root-relative
            new_path = convert_to_root_relative_path(file_path, base_path)
            if not fragment:
                # If there's no fragment, add the target file's anchor
                fragment = get_target_file_anchor(Path(new_path))
            fragment = fragment.lower()
            return f"{link_text}({new_path}{fragment})"
        return match.group(0)

    # Replace all links in the content
    new_content = re.sub(link_pattern, replace_link, content)

    # filter out all lines like `<a name="documentation-for-models"></a>`
    new_content = "\n".join(
        [line for line in new_content.split("\n") if not line.startswith('<a name="') and not line.endswith('"></a>')]
    )

    # Write the modified content back to the file
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(new_content)


def process_markdown_files(files: List[str]) -> None:
    """Process the given markdown files."""
    for file_path in files:
        try:
            fix_markdown_links(Path(file_path))
            print(f"Processed: {file_path}")
        except Exception as e:
            print(f"Error processing {file_path}: {str(e)}", file=sys.stderr)


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(f"Usage: python {sys.argv[0]} FILE [FILE...]", file=sys.stderr)
        print(f"Example: python {sys.argv[0]} packages/api/generated/documentation/markdown/**/*.md", file=sys.stderr)
        sys.exit(1)

    # Process all files provided as arguments
    process_markdown_files(sys.argv[1:])
