Python projects in this monorepo are managed by uv if there is a pyproject.yaml
file.

# Working on projects

uv supports managing Python projects, which define their dependencies in a
`pyproject.toml` file.

## Creating a new project

Projects are created with `uv init`.

### Python Project Template

This document provides the standardized `pyproject.toml` template for all Python
packages in the monorepo. Use this template to ensure consistency across
packages.

#### Template Usage

1. Copy the template below to your new package directory as `pyproject.toml`
2. Replace placeholder values with your package-specific information
3. Uncomment dev dependencies as needed for your package type
4. Add your production dependencies to the `dependencies` array

#### pyproject.toml Template

```toml
### pyproject.toml Template for Python Projects
### Copy this template and customize the project-specific sections

[project]
name = "package-name"  # Replace with your package name
version = "1.0.0"
description = "Package description"  # Replace with your package description
requires-python = ">=3.9,<4"
readme = "README.md"
dependencies = [
    # Add your runtime dependencies here
    # Example: "boto3>=1.37.31",

    # AWS Lambda development (uncomment if needed)
    # "aws-lambda-powertools[parser]>=3.8.0",
]

[tool.hatch.build.targets.wheel]
packages = ["package_name"]  # Replace with your package directory name

[tool.hatch.metadata]
allow-direct-references = true

[dependency-groups]
dev = [
    # Code formatting and linting
    "autopep8>=2.3.1",
    "ruff>=0.8.2",

    # Testing (uncomment if needed)
    # "pytest>=8.3.5",
    # "pytest-sugar>=1.0.0",

    # AWS-specific tools (uncomment if needed)
    # "moto[all]>=5.0.16",
    # "boto3-stubs-lite[bedrock-runtime,dynamodb,s3,ssm,stepfunctions,textract]>=1.37.31",

    # Environment management (uncomment if needed)
    # "python-dotenv>=1.1.0",
]

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[tool.ruff]
exclude = [
    ".ruff_cache",
    ".svn",
    ".tox",
    ".venv",
    "dist",
    # Add any generated files that should be excluded
    # "**/models/schema.py",
]

line-length = 120  # Consistent with your core package
indent-width = 4

[tool.ruff.lint]
select = [
    # pycodestyle
    "E",
    # Pyflakes
    "F",
    # pyupgrade
    "UP",
    # flake8-bugbear
    "B",
    # flake8-simplify
    "SIM",
    # isort
    "I",
]
ignore = []

fixable = ["ALL"]
unfixable = []

### Uncomment if you have tests
### [tool.pytest.ini_options]
### markers = [
###     "integration: marks tests as integration tests",
### ]
### testpaths = ["tests"]
### addopts = "-m 'not integration'"
```

#### Standardized Configurations

##### Python Version

- All packages use `>=3.9,<4` for consistency with the monorepo

##### Code Quality

- Line length: 120 characters (matches project standard)
- Ruff linting with consistent rule set across all packages
- Ruff format for automatic formatting
- Run `ruff check --fix` and `ruff format` to ensure code quality and format
  after each change.

##### Build System

- Uses `hatchling` as the build backend
- Consistent wheel packaging configuration
- Direct references allowed for monorepo dependencies

##### Testing

- pytest with integration test markers
- Tests excluded from default runs (use `-m integration` to run integration
  tests)
- Consistent test path configuration

#### Version Management

All packages start at version `1.0.0`. Update versions consistently across
related packages when making breaking changes.

#### Dependencies

##### Runtime Dependencies

- Add only what's needed for runtime
- Use specific version ranges (e.g., `>=1.37.31`)
- Group related dependencies logically

##### Development Dependencies

- Keep dev dependencies in the `dev` group
- Comment out unused tools to keep environments lean
- Update versions consistently across packages

## Project structure

A project consists of a few important parts that work together and allow uv to
manage your project. In addition to the files created by `uv init`, uv will
create a virtual environment and `uv.lock` file in the root of your project the
first time you run a project command, i.e., `uv run`, `uv sync`, or `uv lock`.

A complete listing would look like:

```text
.
├── .venv
│   ├── bin
│   ├── lib
│   └── pyvenv.cfg
├── .python-version
├── README.md
├── main.py
├── pyproject.toml
└── uv.lock
```

### `pyproject.toml`

The `pyproject.toml` contains metadata about your project:

```toml title="pyproject.toml"
[project]
name = "hello-world"
version = "0.1.0"
description = "Add your description here"
readme = "README.md"
dependencies = []
```

You'll use this file to specify dependencies, as well as details about the
project such as its description or license. You can edit this file manually, or
use commands like `uv add` and `uv remove` to manage your project from the
terminal.

!!! tip

    See the official [`pyproject.toml` guide](https://packaging.python.org/en/latest/guides/writing-pyproject-toml/)
    for more details on getting started with the `pyproject.toml` format.

You'll also use this file to specify uv configuration options in a `[tool.uv]`
section.

### `.python-version`

The `.python-version` file contains the project's default Python version. This
file tells uv which Python version to use when creating the project's virtual
environment.

### `.venv`

The `.venv` folder contains your project's virtual environment, a Python
environment that is isolated from the rest of your system. This is where uv will
install your project's dependencies.

### `uv.lock`

`uv.lock` is a cross-platform lockfile that contains exact information about
your project's dependencies. Unlike the `pyproject.toml` which is used to
specify the broad requirements of your project, the lockfile contains the exact
resolved versions that are installed in the project environment. This file
should be checked into version control, allowing for consistent and reproducible
installations across machines.

`uv.lock` is a human-readable TOML file but is managed by uv and should not be
edited manually.

## Managing dependencies

You can add dependencies to your `pyproject.toml` with the `uv add` command.
This will also update the lockfile and project environment:

```console
$ uv add requests
```

You can also specify version constraints or alternative sources:

```console
$ # Specify a version constraint
$ uv add 'requests==2.31.0'

$ # Add a git dependency
$ uv add git+https://github.com/psf/requests
```

To remove a package, you can use `uv remove`:

```console
$ uv remove requests
```

To upgrade a package, run `uv lock` with the `--upgrade-package` flag:

```console
$ uv lock --upgrade-package requests
```

The `--upgrade-package` flag will attempt to update the specified package to the
latest compatible version, while keeping the rest of the lockfile intact.

## Running commands

`uv run` can be used to run arbitrary scripts or commands in your project
environment.

Prior to every `uv run` invocation, uv will verify that the lockfile is
up-to-date with the `pyproject.toml`, and that the environment is up-to-date
with the lockfile, keeping your project in-sync without the need for manual
intervention. `uv run` guarantees that your command is run in a consistent,
locked environment.

For example, to use `flask`:

```console
$ uv add flask
$ uv run -- flask run -p 3000
```

Or, to run a script:

```python title="example.py"
# Require a project dependency
import flask

print("hello world")
```

```console
$ uv run example.py
```

Alternatively, you can use `uv sync` to manually update the environment then
activate it before executing a command:

=== "macOS and Linux"

    ```console
    $ uv sync
    $ source .venv/bin/activate
    $ flask run -p 3000
    $ python example.py
    ```

=== "Windows"

    ```pwsh-session
    PS> uv sync
    PS> .venv\Scripts\activate
    PS> flask run -p 3000
    PS> python example.py
    ```

!!! note

    The virtual environment must be active to run scripts and commands in the project without `uv run`. Virtual environment activation differs per shell and platform.
