/**
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

import * as fs from "fs";
import * as path from "path";
import { parse } from "yaml";
import { genProductRequestSchema } from "../src/schemas/gen-product-request";

// The schema must accept every request the OpenAPI definition allows and reject what it forbids.
const spec = parse(
  fs.readFileSync(
    path.resolve(__dirname, "../../../model/src/main/openapi/main.yaml"),
    "utf-8",
  ),
);
const requestSpec = spec.components.schemas.GenProductRequestContent;
const productDataSpec = spec.components.schemas.ProductData;

const valid = (body: unknown) =>
  genProductRequestSchema.safeParse(body).success;
const images = (n: number) =>
  Array.from({ length: n }, (_, i) => `img${i}.jpg`);

describe("GenProductRequestContent schema matches the OpenAPI definition", () => {
  test("it has the same properties", () => {
    expect(Object.keys(genProductRequestSchema.shape).sort()).toEqual(
      Object.keys(requestSpec.properties).sort(),
    );
  });

  test("only the required properties are required", () => {
    const required = Object.keys(requestSpec.properties).filter(
      (key) =>
        !genProductRequestSchema.shape[
          key as keyof typeof genProductRequestSchema.shape
        ].safeParse(undefined).success,
    );
    expect(required.sort()).toEqual([...requestSpec.required].sort());
  });

  test("it accepts the documented examples and defaults", () => {
    const body: { [key: string]: unknown } = { productImages: images(1) };
    for (const [key, property] of Object.entries<any>(requestSpec.properties)) {
      if (property.example !== undefined) body[key] = property.example;
      else if (property.default !== undefined) body[key] = property.default;
    }
    expect(body.language).toBe("Chilean Spanish");
    expect(valid(body)).toBe(true);
  });

  test("it accepts every enum value and rejects others", () => {
    for (const [key, property] of Object.entries<any>(requestSpec.properties)) {
      if (!property.enum) continue;
      for (const value of property.enum) {
        expect([
          key,
          value,
          valid({ productImages: [], [key]: value }),
        ]).toEqual([key, value, true]);
      }
      expect(valid({ productImages: [], [key]: "not-a-listed-value" })).toBe(
        false,
      );
    }
  });

  test("it enforces the array limits", () => {
    const { maxItems: maxImages } = requestSpec.properties.productImages;
    expect(valid({ productImages: images(maxImages) })).toBe(true);
    expect(valid({ productImages: images(maxImages + 1) })).toBe(false);

    const { maxItems: maxExamples } = requestSpec.properties.examples;
    const example = Object.fromEntries(
      productDataSpec.required.map((key: string) => [key, key]),
    );
    const examples = (n: number) => Array.from({ length: n }, () => example);
    expect(valid({ productImages: [], examples: examples(maxExamples) })).toBe(
      true,
    );
    expect(
      valid({ productImages: [], examples: examples(maxExamples + 1) }),
    ).toBe(false);
  });

  test("examples need the required ProductData properties", () => {
    for (const key of productDataSpec.required) {
      const example = Object.fromEntries(
        productDataSpec.required
          .filter((k: string) => k !== key)
          .map((k: string) => [k, k]),
      );
      expect(valid({ productImages: [], examples: [example] })).toBe(false);
    }
  });

  test("it rejects values of the wrong type", () => {
    for (const [key, property] of Object.entries<any>(requestSpec.properties)) {
      const wrong = property.type === "string" ? 1 : "text";
      expect([key, valid({ productImages: [], [key]: wrong })]).toEqual([
        key,
        false,
      ]);
    }
  });
});
