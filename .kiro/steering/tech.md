# Technology Stack

## Build System & Monorepo

- **Nx** - Monorepo build system and task orchestration
- **pnpm** - Package manager with workspaces
- **TypeScript** - Primary language for infrastructure and frontend

## AWS Infrastructure

- **AWS CDK** v2.277.0 - Infrastructure as Code
- **Amazon Bedrock** - AI/ML models (Claude Haiku 5.5, Claude Sonnet 5.5, Nova Micro), called through cross-region inference profiles
- **AWS Step Functions** - Workflow orchestration for batch processing
- **AWS Lambda** - Serverless compute (Python 3.14, Node.js 24)
- **Amazon S3** - Storage for images, configurations, and results
- **Amazon DynamoDB** - Metaclass word vector store and process status
- **Amazon Cognito** - Authentication for demo website
- **AWS API Gateway** - REST API endpoints

## Python Stack

- **uv** - Python dependency management and project management
- **Python 3.12+** - Required runtime version
- **Pydantic** - Data validation and serialization
- **boto3** - AWS SDK
- **NLTK** - Natural language processing
- **NumPy** - Numerical computing
- **FAISS** - Vector similarity search
- **Jinja2** - Template engine

## Frontend

- **React** - UI framework
- **React Aria Components** and **Tailwind CSS** - UI components and styling
- **TypeScript** - Type safety
- **TanStack Query** with **openapi-fetch** - API calls typed from the OpenAPI definition

## Development Tools

- **ESLint** - Code linting
- **Prettier** - Code formatting
- **Jest** - Testing framework
- **Docker** - Containerization
- **Jupyter** - Notebooks for configuration

## Package Manager Guidelines

- **Use `pnpm exec` instead of `npx`** - This project uses pnpm as the package manager

## Common Commands

### Initial Setup

```bash
# Install dependencies
pnpm install
pnpm build

# Docker login for public ECR
aws ecr-public get-login-password --region us-east-1 | docker login --username AWS --password-stdin public.ecr.aws
```

### Development

```bash
# Build all packages
pnpm build

# Run tests
pnpm test

# Lint code
pnpm lint
```

### Deployment

```bash
# Deploy infrastructure
cd packages/infra
pnpm cdk bootstrap
pnpm cdk deploy smart-product-onboarding

# Deploy with cross-account Bedrock access
pnpm cdk deploy smart-product-onboarding --context BEDROCK_XACCT_ROLE=<ARN_OF_ROLE>
```

### Configuration (Notebooks)

```bash
cd notebooks
uv sync
uv run jupyter notebook
```

### Website Development

```bash
cd packages/website
# Download runtime config from S3
aws s3 cp s3://<ConfigurationBucket>/frontend/runtime-config.json public/runtime-config.json
pnpm dev
```

## Key Dependencies

- Node.js 22 or 24
- Python >= 3.12
- uv >= 0.5.0 - Python package and project manager
- pnpm >= 8.6.3
- AWS CLI configured
- Docker Desktop
