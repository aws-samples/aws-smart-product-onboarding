# Project Structure

## Monorepo Organization

This is a monorepo managed directly with pnpm workspaces and Nx. Each package defines its Nx targets in `project.json`; edit `package.json`, `project.json` and `pyproject.toml` files directly.

## Root Level

- `package.json` - Root scripts and shared development dependencies
- `nx.json` - Nx configuration for build system
- `pnpm-workspace.yaml` - Workspace configuration
- `notebooks/` - Jupyter notebooks for system configuration
- `samples/` - Sample product data for testing
- `documentation/` - Architecture diagrams and guides
- `scripts/` - Release and documentation helper scripts

## Core Packages (`packages/`)

### API (`packages/api/`)

The REST API, defined by an OpenAPI definition:

- `model/` - OpenAPI definition (`src/main/openapi/main.yaml`). Its `generate` target bundles it into `.api.json` for the infrastructure.
- `handlers/typescript/` - TypeScript Lambda handlers (runtime: Node.js 24)
- `generated/types/typescript/` - TypeScript types generated from the definition (checked in)
- `generated/documentation/` - Markdown API documentation written by `scripts/generate-pdf-doc.sh` (not checked in)

### Infrastructure (`packages/infra/`)

**CDK Infrastructure** project:

- `src/` - CDK stack definitions
- `cdk.json` - CDK configuration
- `src/constructs/apis/open-api-rest-api.ts` - Builds the API Gateway REST API from the bundled OpenAPI definition

### Website (`packages/website/`)

**React demo** application:

- `src/` - React application source
- `public/` - Static assets
- Uses React Aria Components styled with Tailwind CSS, and TanStack Query with openapi-fetch to call the API
- Requires runtime config from S3 for deployment

### Smart Product Onboarding (`packages/smart-product-onboarding/`)

**Python microservices** for AI processing, in one uv workspace:

#### Core Utils (`core-utils/`)

- Shared utilities and base classes
- Pydantic models for data validation
- AWS service integrations

#### Product Categorization (`product-categorization/`)

- Bottom-up categorization logic
- Category tree processing
- Jinja2 templates for prompts

#### Metaclasses (`metaclasses/`)

- Word vector processing with FAISS
- NLTK text processing
- Metaclass generation and matching

#### API (`api/`)

- `api/common/` - Pydantic models generated from the OpenAPI definition (checked in), and the shared handler wrapper
- `api/handlers/` - Python Lambda handlers (runtime: Python 3.14)

## Configuration Workflow

### 1. Notebooks (`notebooks/`)

**Required setup steps** after deployment:

- `1 - category tree prep.ipynb` - Prepare category hierarchies
- `2 - metaclasses generation.ipynb` - Generate word vectors
- Uses uv for Python dependency management

### 2. Sample Data (`samples/`)

Example product data structure:

```
samples/
├── B074M5HPBD/          # Product ID
│   ├── *.jpg            # Product images
│   └── metadata.txt     # Product metadata
└── README.md
```

## Development Patterns

### Python Package Dependencies

- `core-utils` is a dependency of other Python packages
- Use uv for Python dependency management (workspace at `packages/smart-product-onboarding/`)

### API Development

- Define the operation in `packages/api/model/src/main/openapi/main.yaml`
- Regenerate the checked-in TypeScript types, website types and Python models (see `packages/api/README.md`); CI fails if they drift from the definition
- Implement the handler and add it to the API's `integrations` in `packages/infra/src/constructs/apis/smartproductonboardingapi.ts`

### Build Dependencies

```
infra → api model (bundled OpenAPI definition)
infra → api handlers (TypeScript and Python)
infra → website (for deployment)
infra → smart-product-onboarding packages
metaclasses → core-utils
product-categorization → core-utils
```

## Key Files to Modify

- `packages/api/model/` - API specifications
- `packages/infra/src/` - Infrastructure code
- `packages/website/src/` - Frontend code
- `packages/smart-product-onboarding/*/` - AI processing logic
- `notebooks/*.ipynb` - Configuration notebooks

## Generated Files (Do Not Edit)

Regenerate these from the OpenAPI definition instead:

- `packages/api/generated/types/typescript/src/api.d.ts`
- `packages/website/src/api/schema.d.ts`
- `packages/smart-product-onboarding/api/common/amzn_smart_product_onboarding_api_common/models.py`
- `packages/api/model/.api.json` and CDK `cdk.out/` directories (not checked in)
