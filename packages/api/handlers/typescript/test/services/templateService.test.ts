/**
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 */

import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as Handlebars from "handlebars";
import {
  TemplateNotFoundError,
  TemplateSyntaxError,
  TemplateRenderError,
} from "../../src/services/templateErrors";
import { TemplateService } from "../../src/services/templateService";

describe("TemplateService", () => {
  let tempDir: string;
  let templateService: TemplateService;

  beforeEach(() => {
    // Create a temporary directory for test templates
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "template-service-test-"));
    templateService = new TemplateService(tempDir);
  });

  afterEach(() => {
    // Clean up temporary directory
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe("constructor", () => {
    it("should initialize with template directory", () => {
      expect(templateService.getTemplateDir()).toBe(path.resolve(tempDir));
      expect(templateService.getCacheSize()).toBe(0);
    });

    it("should resolve relative paths", () => {
      const relativeService = new TemplateService("./templates");
      expect(path.isAbsolute(relativeService.getTemplateDir())).toBe(true);
    });
  });

  describe("loadTemplate", () => {
    it("should load and compile a valid template", async () => {
      // Create a test template
      const templateContent = "Hello {{name}}!";
      const templatePath = path.join(tempDir, "test.hbs");
      fs.writeFileSync(templatePath, templateContent);

      const template = await templateService.loadTemplate("test");
      expect(template).toBeDefined();
      expect(typeof template).toBe("function");

      // Test that template can render
      const result = template({ name: "World" });
      expect(result).toBe("Hello World!");
    });

    it("should cache templates after first load", async () => {
      const templateContent = "Hello {{name}}!";
      const templatePath = path.join(tempDir, "cached.hbs");
      fs.writeFileSync(templatePath, templateContent);

      // First load
      expect(templateService.isCached("cached")).toBe(false);
      const template1 = await templateService.loadTemplate("cached");
      expect(templateService.isCached("cached")).toBe(true);
      expect(templateService.getCacheSize()).toBe(1);

      // Second load should return cached version
      const template2 = await templateService.loadTemplate("cached");
      expect(template1).toBe(template2); // Same reference
      expect(templateService.getCacheSize()).toBe(1);
    });

    it("should throw TemplateNotFoundError for missing template", async () => {
      await expect(templateService.loadTemplate("nonexistent")).rejects.toThrow(
        TemplateNotFoundError,
      );

      try {
        await templateService.loadTemplate("nonexistent");
      } catch (error) {
        expect(error).toBeInstanceOf(TemplateNotFoundError);
        expect((error as TemplateNotFoundError).templateName).toBe(
          "nonexistent",
        );
        expect((error as TemplateNotFoundError).message).toContain(
          "Template nonexistent",
        );
      }
    });

    it("should handle template compilation errors gracefully", async () => {
      // Test that TemplateSyntaxError is thrown when compilation fails
      // We'll create a new TemplateService instance and spy on Handlebars.compile
      const validTemplate = "Hello {{name}}!";
      const templatePath = path.join(tempDir, "test-error.hbs");
      fs.writeFileSync(templatePath, validTemplate);

      // Create a spy that throws an error
      const compileSpy = jest
        .spyOn(Handlebars, "compile")
        .mockImplementationOnce(() => {
          throw new Error("Mocked compilation error");
        });

      try {
        await expect(
          templateService.loadTemplate("test-error"),
        ).rejects.toThrow(TemplateSyntaxError);
      } finally {
        // Restore the original implementation
        compileSpy.mockRestore();
      }
    });

    it("should handle file system errors", async () => {
      // Create a directory with the template name to cause a file system error
      const dirPath = path.join(tempDir, "directory.hbs");
      fs.mkdirSync(dirPath);

      await expect(templateService.loadTemplate("directory")).rejects.toThrow(
        TemplateNotFoundError,
      );
    });
  });

  describe("render", () => {
    beforeEach(async () => {
      // Create test templates
      const simpleTemplate = "Hello {{name}}!";
      fs.writeFileSync(path.join(tempDir, "simple.hbs"), simpleTemplate);

      const conditionalTemplate = "{{#if show}}Visible{{else}}Hidden{{/if}}";
      fs.writeFileSync(
        path.join(tempDir, "conditional.hbs"),
        conditionalTemplate,
      );

      const complexTemplate = `{{#if user}}Hello {{user.name}}!{{#if user.admin}}
You are an admin.{{/if}}{{else}}Hello Guest!{{/if}}`;
      fs.writeFileSync(path.join(tempDir, "complex.hbs"), complexTemplate);
    });

    it("should render template with simple context", async () => {
      const result = await templateService.render("simple", { name: "World" });
      expect(result).toBe("Hello World!");
    });

    it("should render template with conditional logic", async () => {
      const resultTrue = await templateService.render("conditional", {
        show: true,
      });
      expect(resultTrue).toBe("Visible");

      const resultFalse = await templateService.render("conditional", {
        show: false,
      });
      expect(resultFalse).toBe("Hidden");
    });

    it("should render complex template with nested conditions", async () => {
      const adminContext = {
        user: {
          name: "John",
          admin: true,
        },
      };
      const adminResult = await templateService.render("complex", adminContext);
      expect(adminResult).toBe("Hello John!\nYou are an admin.");

      const userContext = {
        user: {
          name: "Jane",
          admin: false,
        },
      };
      const userResult = await templateService.render("complex", userContext);
      expect(userResult).toBe("Hello Jane!");

      const guestResult = await templateService.render("complex", {});
      expect(guestResult).toBe("Hello Guest!");
    });

    it("should handle null context", async () => {
      const result = await templateService.render("simple", null);
      expect(result).toBe("Hello !"); // Handlebars renders undefined as empty string
    });

    it("should handle empty object context", async () => {
      const result = await templateService.render("simple", {});
      expect(result).toBe("Hello !");
    });

    it("should throw TemplateRenderError for invalid context type", async () => {
      await expect(templateService.render("simple", "invalid")).rejects.toThrow(
        TemplateRenderError,
      );

      await expect(templateService.render("simple", 123)).rejects.toThrow(
        TemplateRenderError,
      );
    });

    it("should throw TemplateNotFoundError for missing template", async () => {
      await expect(templateService.render("nonexistent", {})).rejects.toThrow(
        TemplateNotFoundError,
      );
    });

    it("should use cached templates for rendering", async () => {
      // First render loads and caches template
      await templateService.render("simple", { name: "First" });
      expect(templateService.isCached("simple")).toBe(true);

      // Second render uses cached template
      const result = await templateService.render("simple", { name: "Second" });
      expect(result).toBe("Hello Second!");
    });
  });

  describe("cache management", () => {
    beforeEach(() => {
      const template = "Hello {{name}}!";
      fs.writeFileSync(path.join(tempDir, "cache-test.hbs"), template);
    });

    it("should track cache size correctly", async () => {
      expect(templateService.getCacheSize()).toBe(0);

      await templateService.loadTemplate("cache-test");
      expect(templateService.getCacheSize()).toBe(1);
    });

    it("should clear cache", async () => {
      await templateService.loadTemplate("cache-test");
      expect(templateService.getCacheSize()).toBe(1);
      expect(templateService.isCached("cache-test")).toBe(true);

      templateService.clearCache();
      expect(templateService.getCacheSize()).toBe(0);
      expect(templateService.isCached("cache-test")).toBe(false);
    });

    it("should check if template is cached", async () => {
      expect(templateService.isCached("cache-test")).toBe(false);

      await templateService.loadTemplate("cache-test");
      expect(templateService.isCached("cache-test")).toBe(true);
    });
  });

  describe("error handling edge cases", () => {
    it("should handle template with undefined variables gracefully", async () => {
      const strictTemplate = "Hello {{name}}! Age: {{age}}";
      fs.writeFileSync(path.join(tempDir, "strict.hbs"), strictTemplate);

      // With strict mode disabled, undefined variables render as empty strings
      const result = await templateService.render("strict", { name: "John" });
      expect(result).toBe("Hello John! Age: ");
    });

    it("should handle template file permissions issues", async () => {
      const templatePath = path.join(tempDir, "permission.hbs");
      fs.writeFileSync(templatePath, "Hello {{name}}!");

      // Make file unreadable (skip on Windows as chmod behaves differently)
      if (process.platform !== "win32") {
        fs.chmodSync(templatePath, 0o000);

        await expect(
          templateService.loadTemplate("permission"),
        ).rejects.toThrow(TemplateNotFoundError);

        // Restore permissions for cleanup
        fs.chmodSync(templatePath, 0o644);
      }
    });
  });

  describe("integration with existing template", () => {
    it("should work with product-generation template structure", async () => {
      // Create a template similar to the existing product-generation.hbs
      const productTemplate = `
{{#if conditionals.hasExamples}}
<examples>
{{{examples.formatted}}}
</examples>
{{/if}}

Create a product with title and description{{#if language}} in {{{language}}}{{/if}}.
{{#if conditionals.hasMetadata}}
<metadata>{{{metadata}}}</metadata>
{{/if}}
      `.trim();

      fs.writeFileSync(path.join(tempDir, "product.hbs"), productTemplate);

      const context = {
        conditionals: {
          hasExamples: true,
          hasMetadata: true,
        },
        examples: {
          formatted: "<product><title>Test</title></product>",
        },
        language: "English",
        metadata: "Brand: TestBrand",
      };

      const result = await templateService.render("product", context);
      expect(result).toContain("<examples>");
      expect(result).toContain("<product><title>Test</title></product>");
      expect(result).toContain("in English");
      expect(result).toContain("<metadata>Brand: TestBrand</metadata>");
    });
  });
});
