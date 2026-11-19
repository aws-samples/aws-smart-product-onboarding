/**
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

import * as fs from "fs";
import * as path from "path";
import { apiGatewayEvent, lambdaContext } from "./api-gateway-event";
import { RESPONSE_CASES } from "./generate-product.cases";

// The status codes, headers and bodies the handler returned through the generated API runtime used
// before, recorded from that runtime for every case in generate-product.cases.ts. Do not regenerate this
// file from the current handler: it is the baseline the handler must keep matching.
const GOLDEN_PATH = path.join(
  __dirname,
  "golden",
  "generate-product-responses.json",
);

jest.mock("../src/services/productGenerator");
const mockGetConfiguration = jest.fn();
jest.mock("../src/services/appConfigClient", () => ({
  AppConfigClient: jest.fn().mockImplementation(() => ({
    getConfiguration: mockGetConfiguration,
  })),
}));

const originalEnv = process.env;

async function invokeCase(c: (typeof RESPONSE_CASES)[number]) {
  jest.resetModules();
  process.env = { ...originalEnv, IMAGE_BUCKET: "test-bucket", ...c.env };
  for (const [key, value] of Object.entries(c.env ?? {})) {
    if (value === undefined) delete process.env[key];
  }
  mockGetConfiguration.mockReset();
  if (c.appConfigError) {
    mockGetConfiguration.mockRejectedValue(new Error("AppConfig down"));
  } else {
    mockGetConfiguration.mockResolvedValue(null);
  }
  const {
    ProductGeneratorService,
  } = require("../src/services/productGenerator");
  const exceptions = require("../src/utils/exceptions");
  (ProductGeneratorService.prototype.generateProduct as jest.Mock).mockReset();
  if (c.generate) {
    (
      ProductGeneratorService.prototype.generateProduct as jest.Mock
    ).mockImplementation(() => c.generate!(exceptions));
  }
  const { handler } = require("../src/generate-product");
  const result = await handler(
    apiGatewayEvent(JSON.stringify(c.body)),
    lambdaContext,
  );
  // Compare the response as a client sees it: header names are case-insensitive.
  const headers = Object.fromEntries(
    Object.entries<string>(result.headers ?? {}).map(([k, v]) => [
      k.toLowerCase(),
      v,
    ]),
  );
  return {
    statusCode: result.statusCode,
    headers,
    body:
      typeof result.body === "string" ? JSON.parse(result.body) : result.body,
    bodyIsString: typeof result.body === "string",
  };
}

describe("generateProduct responses match the previous runtime", () => {
  afterEach(() => {
    process.env = originalEnv;
  });

  const golden = JSON.parse(fs.readFileSync(GOLDEN_PATH, "utf-8"));
  test.each(RESPONSE_CASES.map((c) => [c.name, c]))("%s", async (name, c) => {
    expect(await invokeCase(c)).toEqual({
      ...golden[name],
      // The previous runtime returned the 404 body as an object, which API Gateway rejects with a 502.
      bodyIsString: true,
      headers: {
        // API Gateway adds this header when a proxy response leaves it out, so clients saw it before too.
        "content-type": "application/json",
        ...golden[name].headers,
      },
    });
  });
});
