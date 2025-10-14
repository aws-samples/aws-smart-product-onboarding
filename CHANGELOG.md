# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [v0.6.0] - 2025-10-14

### Changed
- chore(deps): bump vite-plugin-dts from 3.8.1 to 4.5.4 (#39)
- fix(notebooks): clarify gs1 gpc version (#38)
- feat(website)!: migrate from Create React App to Vite (#37)
- refactor!: migrate from Projen to direct pnpm + Nx management (#36)
- feat(api): implement Handlebars template system for product generation (#35)
- chore: update dependencies (#34)
- chore(deps-dev): bump jupyterlab from 4.4.5 to 4.4.8 in /notebooks (#33)
- chore(deps): add package resolutions for sha.js and tmp (#32)
- chore: update deps (#31)
- chore(deps): bump urllib3 from 2.4.0 to 2.5.0 in /packages/smart-product-onboarding/core-utils (#30)
- chore(deps-dev): bump requests from 2.32.3 to 2.32.4 in /packages/api/handlers/python (#29)
- chore: update tornado (#28)
- chore: update cdk dep in main package.json (#27)
- chore: dependency updates (#26)
- chore(deps-dev): bump h11 from 0.14.0 to 0.16.0 in /notebooks (#25)
- feat: allow setting cors origin in context (#24)
- chore: update deps (#23)
- chore: update deps (#22)
- chore: update deps (#21)
- chore: update deps (#20)
- fix: notebook uses valid bucket (#18)
- feat: camera capture (#15)
- chore(deps): bump jinja2 from 3.1.5 to 3.1.6 in /packages/smart-product-onboarding/product-categorization (#17)
- chore(deps): bump jinja2 from 3.1.5 to 3.1.6 in /packages/smart-product-onboarding/metaclasses (#16)
- chore: update changelog

## [0.5.1] - 2025-02-13
### Changed
* chore(infra): change cognito to plus feature plan by @jstrunk in https://github.com/aws-samples/aws-smart-product-onboarding/pull/14

**Full Changelog**: https://github.com/aws-samples/aws-smart-product-onboarding/compare/v0.5.0...v0.5.1

## [0.5.0] - 2025-02-13
* Replace gensim with faiss
* Use DynamoDB as word vector store to reduce build time and Lambda size
* Multilingual product classification **BREAKING CHANGE**: You must enable Amazon Nova Micro in Amazon Bedrock.
* Remove dependencies on Java and Maven

### Changed
* chore(deps-dev): bump jinja2 from 3.1.4 to 3.1.5 in /packages/smart-product-onboarding/core-utils by @dependabot in https://github.com/aws-samples/aws-smart-product-onboarding/pull/8
* chore(deps): bump jinja2 from 3.1.4 to 3.1.5 in /packages/smart-product-onboarding/product-categorization by @dependabot in https://github.com/aws-samples/aws-smart-product-onboarding/pull/7
* feat(metaclass): replace gensim with faiss and multiple languages support by @jstrunk in https://github.com/aws-samples/aws-smart-product-onboarding/pull/9
* chore: update pdk and cdk and dependencies by @jstrunk in https://github.com/aws-samples/aws-smart-product-onboarding/pull/11
* chore: update deps by @jstrunk in https://github.com/aws-samples/aws-smart-product-onboarding/pull/12
* chore: bump esbuild version by @jstrunk in https://github.com/aws-samples/aws-smart-product-onboarding/pull/13


**Full Changelog**: https://github.com/aws-samples/aws-smart-product-onboarding/compare/v0.4.4...v0.5.0

## [0.4.4] - 2024-12-11

### Changed
- fix: improve build instructions

## [0.4.3] - 2024-12-07

### Changed
- chore: relicense to mit-0

## [0.4.2] - 2024-12-05

### Changed
- chore: api gateway protection doc
- feat: support amazon nova models

## [0.4.1] - 2024-11-29

### Changed
- Added example product images.

## [0.4.0] - 2024-11-28

### Changed
- Improve single product demo ux by calling each task individually instead of in a workflow.

## [0.3.0] - 2024-11-22

### Changed
- Unified previously separate prototypes into a single, cohesive system

## [0.2.0] - 2024-05-05

### Changed
- Support English
- Use GS1 GPC category tree
- Use Anthropic Claude 2 Haiku
- Remove customer references

## [0.1.0] - 2023-11-30

Initial customer delivery of Product Categorization prototype.