// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

// Bundles the OpenAPI definition into one JSON file for the infrastructure.
// References to other files under src/main/openapi are inlined; internal references are kept.
import { rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import SwaggerParser from "@apidevtools/swagger-parser";

const here = dirname(fileURLToPath(import.meta.url));
const output = join(here, ".api.json");
const spec = await SwaggerParser.bundle(
  join(here, "src/main/openapi/main.yaml"),
);
// Earlier builds wrote this file read-only, so replace it rather than overwrite it.
rmSync(output, { force: true });
writeFileSync(output, JSON.stringify(spec, null, 2));
