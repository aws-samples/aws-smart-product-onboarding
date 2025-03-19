/**
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

import path from "node:path";
import { monorepo } from "@aws/pdk";
import { CloudscapeReactTsWebsiteProject } from "@aws/pdk/cloudscape-react-ts-website";
import { InfrastructureTsProject } from "@aws/pdk/infrastructure";
import {
  DocumentationFormat,
  Language,
  Library,
  ModelLanguage,
  NodeVersion,
  PythonVersion,
  TypeSafeApiProject,
} from "@aws/pdk/type-safe-api";
import { NodePackageManager } from "projen/lib/javascript";
import { PythonProject } from "projen/lib/python";

const cdkVersion = "2.178.1";
const pdkVersion = "0.25.17";
const projectName = "smart-product-onboarding";
const npmPrefix = "@aws-samples/";
const pypiPrefix = "amzn-";

const context = {
  /**
   * Download url for word2vec vectors to use as fallback for metaclass identification.
   *
   * See https://fasttext.cc/docs/en/crawl-vectors.html for URLs
   *
   * Default - en "https://dl.fbaipublicfiles.com/fasttext/vectors-english/crawl-300d-2M.vec.zip"
   * Other options:
   * chilean spanish - "https://zenodo.org/records/3255001/files/embeddings-l-model.vec"
   */
  wordVectorsUrl:
    "https://dl.fbaipublicfiles.com/fasttext/vectors-english/crawl-300d-2M.vec.zip",
};

const toSnakeCase = (str: string): string => {
  return str
    .split(/(?=[A-Z])|[\s-]+/) // Split on uppercase letters, spaces, or hyphens
    .map((word) => word.toLowerCase())
    .join("_");
};

const project = new monorepo.MonorepoTsProject({
  devDeps: [`@aws/pdk@${pdkVersion}`],
  name: npmPrefix + projectName,
  packageManager: NodePackageManager.PNPM,
  projenrcTs: true,
  gitignore: [
    ".bashrc",
    ".profile",
    ".idea",
    ".venv",
    ".DS_Store",
    "__pycache__",
  ],
  prettier: true,
  license: "MIT-0",
  copyrightOwner: "Amazon.com, Inc. or its affiliates",
  copyrightPeriod: "",
  licenseOptions: {
    disableDefaultLicenses: true,
  },
});
project.package.addPackageResolutions(
  `aws-cdk-lib@^${cdkVersion}`,
  "axios@^1.8.2",
  "@babel/runtime@^7.26.10",
  "cross-spawn@^7.0.5",
  "dompurify@^3.1.7",
  "esbuild@^0.25.0",
  "fast-xml-parser@^4.4.1",
  "micromatch@^4.0.8",
  "nth-check@^2.1.1",
  "postcss@^8.4.38",
  "prismjs@^1.30.0",
  "semver@^7.6.2",
  "serialize-javascript@^6.0.2",
  "webpack@^5.94.0",
  "ws@^8.17.1",
);

const coreUtils = new PythonProject({
  parent: project,
  name: `${pypiPrefix}${projectName}-core-utils`,
  outdir: `packages/${projectName}/core-utils`,
  moduleName: `${toSnakeCase(pypiPrefix + projectName)}_core_utils`,
  authorName: "AWS Latam PACE",
  authorEmail: "aws-latam-pace@amazon.com",
  version: "0.1.0",
  deps: [
    "boto3@^1.35.37",
    "lxml@^5.3.0",
    "pydantic@^2.9.2",
    "python@^3.12",
    "tenacity@^9.0.0",
  ],
  devDeps: [
    "boto3-stubs-lite@{version = '^1.35.37', extras = ['bedrock-runtime', 'dynamodb', 'firehose', 's3', 'sagemaker-a2i-runtime', 'ssm', 'stepfunctions']}",
    "moto@{version = '^5.0.16', extras = ['all']}",
    "mypy@^1.11.2",
    "black@^24.10.0",
  ],
  poetry: true,
  pip: false,
  setuptools: false,
  venv: false,
});

const productCategorization = new PythonProject({
  parent: project,
  name: `${pypiPrefix}${projectName}-product-categorization`,
  outdir: `packages/${projectName}/product-categorization`,
  moduleName: `${toSnakeCase(pypiPrefix + projectName)}_product_categorization`,
  authorName: "AWS Latam PACE",
  authorEmail: "aws-latam-pace@amazon.com",
  version: "0.1.0",
  deps: ["python@^3.12", "cachetools@^5.5.1", "jinja2@^3.1.4", "faker@30.1.0"],
  devDeps: [
    "boto3-stubs-lite@{version = '^1.35.37', extras = ['bedrock-runtime', 's3']}",
    "moto@{version = '^5.0.16', extras = ['all']}",
  ],
  poetry: true,
  pip: false,
  setuptools: false,
  venv: false,
});
productCategorization.addDependency(
  `${coreUtils.moduleName}@{ path = "${path.relative(productCategorization.outdir, coreUtils.outdir)}", develop = true }`,
);
project.addImplicitDependency(productCategorization, coreUtils);

const metaclasses = new PythonProject({
  parent: project,
  name: `${pypiPrefix}${projectName}-metaclasses`,
  outdir: `packages/${projectName}/metaclasses`,
  moduleName: `${toSnakeCase(pypiPrefix + projectName)}_metaclasses`,
  authorName: "AWS Latam PACE",
  authorEmail: "aws-latam-pace@amazon.com",
  version: "0.1.0",
  deps: [
    "python@^3.12",
    "nltk@^3.9.1",
    "numpy@^2.2.2",
    "inflect@^7.4.0",
    "faiss-cpu@^1.10.0",
    "cachetools@^5.5.1",
    "jinja2@^3.1.4",
  ],
  devDeps: [
    "boto3-stubs-lite@{version = '^1.35.37', extras = ['bedrock-runtime', 's3', 'dynamodb']}",
  ],
  poetry: true,
  pip: false,
  setuptools: false,
  venv: false,
});

metaclasses.addDependency(
  `${coreUtils.moduleName}@{ path = "${path.relative(metaclasses.outdir, coreUtils.outdir)}", develop = true }`,
);
project.addImplicitDependency(metaclasses, coreUtils);

const api = new TypeSafeApiProject({
  parent: project,
  name: `${npmPrefix}${projectName}-api`,
  outdir: "packages/api",
  model: {
    language: ModelLanguage.OPENAPI,
    options: {
      openapi: {
        title: `${projectName}-api`,
      },
    },
  },
  infrastructure: {
    language: Language.TYPESCRIPT,
    options: {
      typescript: {
        deps: [`@aws/pdk@^${pdkVersion}`],
      },
    },
  },
  handlers: {
    languages: [Language.PYTHON, Language.TYPESCRIPT],
    options: {
      python: {
        name: `${pypiPrefix}${projectName}-api-python-handlers`,
        moduleName: `${toSnakeCase(pypiPrefix + projectName)}_api_python_handlers`,
        devDeps: [
          "pytest@*",
          "boto3-stubs-lite@{version = '^1.35.37', extras = ['dynamodb', 's3', 'stepfunctions']}",
          "moto@{version = '^5.0.16', extras = ['all']}",
        ],
        runtimeVersion: PythonVersion.PYTHON_3_13,
      },
      typescript: {
        deps: [
          "@aws-sdk/client-bedrock-runtime",
          "@aws-sdk/client-s3",
          "@aws-sdk/client-ssm",
          "@aws-lambda-powertools/logger@^2.10.0",
          "@aws-lambda-powertools/parameters@^2.10.0",
          "fast-xml-parser@^4.3.6",
        ],
        devDeps: ["esbuild@^0.25.0"],
        runtimeVersion: NodeVersion.NODE_22,
        prettier: true,
      },
    },
  },
  runtime: {
    languages: [Language.PYTHON],
    options: {
      python: {
        name: `${pypiPrefix}${projectName}-api-python-runtime`,
        moduleName: `${toSnakeCase(pypiPrefix + projectName)}_api_python_runtime`,
        commitGenerated: true,
      },
    },
  },
  library: {
    libraries: [Library.TYPESCRIPT_REACT_QUERY_HOOKS],
  },
  documentation: {
    formats: [DocumentationFormat.MARKDOWN],
  },
  commitGenerated: true,
});

api.runtime.python?.gitignore.removePatterns(
  "README.md",
  api.runtime.python?.moduleName,
);

// Copy api.runtime.python files to packages/${projectName} for use in Lambda handlers
const runtimeDest = path.relative(
  api.runtime.python?.outdir!,
  `packages/${projectName}`,
);

api.runtime.python?.packageTask.prependExec(`chmod -R u+w ${runtimeDest}/api`);
api.runtime.python?.packageTask.prependExec(
  `rsync -r ./README.md ./pyproject.toml ./poetry.lock ./${api.runtime.python?.moduleName} ${runtimeDest}/api`,
);
api.runtime.python?.packageTask.prependExec(`mkdir -p ${runtimeDest}/api`);

metaclasses.addDependency(
  `${api.runtime.python?.moduleName}@{ path = "../api", develop = true }`,
);
project.addImplicitDependency(metaclasses, api.runtime.python!);

productCategorization.addDependency(
  `${api.runtime.python?.moduleName}@{ path = "../api", develop = true }`,
);
project.addImplicitDependency(productCategorization, api.runtime.python!);

const website = new CloudscapeReactTsWebsiteProject({
  parent: project,
  outdir: "packages/website",
  name: `${npmPrefix}${projectName}-demo-website`,
  typeSafeApis: [api],
  deps: [
    "@aws-sdk/client-s3",
    "@aws-sdk/core",
    "@aws-sdk/types",
    "browser-image-resizer@^2.4.1",
    "@cloudscape-design/collection-hooks",
  ],
  gitignore: ["public/runtime-config*.json"],
  prettier: true,
});

const infra = new InfrastructureTsProject({
  parent: project,
  name: `${npmPrefix}${projectName}-infra`,
  outdir: "packages/infra",
  cdkVersion: cdkVersion,
  deps: [
    `@aws/pdk@^${pdkVersion}`,
    "@aws-cdk/aws-lambda-python-alpha",
    "cdk-nag",
    "@dontirun/state-machine-semaphore",
    `${api.runtime.typescript?.package.packageName!}@${
      api.infrastructure.typescript?.package.manifest.version
    }`,
  ],
  context: context,
  typeSafeApis: [api],
  cloudscapeReactTsWebsites: [website],
  prettier: true,
});

project.addImplicitDependency(infra, productCategorization);
project.addImplicitDependency(infra, metaclasses);

project.synth();
