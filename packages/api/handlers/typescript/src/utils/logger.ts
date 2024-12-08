/**
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

import { Logger, LogLevel } from "@aws-lambda-powertools/logger";

function isValidLogLevel(
  level: string | undefined,
): level is keyof typeof LogLevel {
  return Object.values(LogLevel).includes(level as any);
}

const envLogLevel = process.env.LOG_LEVEL;
const logLevel = isValidLogLevel(envLogLevel) ? envLogLevel : "INFO";

export const logger = new Logger({
  serviceName: "GenerateProduct",
  logLevel: logLevel,
});
