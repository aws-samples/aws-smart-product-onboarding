# Design Document

## Overview

This design implements a template system for the TypeScript product generator service to replace inline template strings with external template files. The solution will use Handlebars.js as the template engine, following a similar pattern to the Jinja2 templates used in the Python packages.

The design focuses on minimal changes to maintain backward compatibility while providing a cleaner, more maintainable approach to prompt generation.

## Architecture

### Template Engine Selection

**Handlebars.js** was selected as the template engine for the following reasons:

- **Logic-less**: Clear separation of logic and presentation, similar to Jinja2
- **External files**: Templates stored as separate `.hbs` files, matching the Python package pattern
- **Mature ecosystem**: Well-established with extensive documentation and community support
- **Feature-rich**: Built-in conditionals, loops, and custom helpers for dynamic content
- **Runtime flexibility**: Templates can be modified without code recompilation
- **Familiar syntax**: Similar to Jinja2 templates already used in Python packages
- **TypeScript support**: Excellent TypeScript definitions available

### Directory Structure

```
packages/api/handlers/typescript/
├── src/
│   ├── services/
│   │   └── productGenerator.ts
│   └── templates/
│       └── product-generation.hbs
└── package.json
```

### Template File Organization

Templates will be stored in `src/templates/` directory following the pattern:

- `product-generation.hbs` - Main product generation prompt template

## Components and Interfaces

### Template Service

A new `TemplateService` class will handle template loading and rendering:

```typescript
export class TemplateService {
  private templates: Map<string, HandlebarsTemplateDelegate> = new Map();

  constructor(private templateDir: string) {}

  async loadTemplate(templateName: string): Promise<HandlebarsTemplateDelegate>;
  render(templateName: string, context: any): Promise<string>;
}
```

### Template Context Interface

Define a clear interface for template variables:

```typescript
export interface ProductGenerationContext {
  examples?: ProductData[];
  language?: string;
  descriptionLength?: string;
  paragraphCount?: string;
  metadata?: string;
  imageCount: number;
  hasExamples: boolean;
  hasMetadata: boolean;
}
```

### Modified ProductGeneratorService

The existing service will be updated to use the template system:

```typescript
export class ProductGeneratorService {
  constructor(
    private s3Client: S3Client,
    private bedrockClient: BedrockRuntimeClient,
    private imageBucket: string,
    private templateService: TemplateService, // New dependency
  ) {}

  // Updated method to use templates
  private async preparePrompt(props: PreparePromptProps): Promise<Message>;
}
```

## Data Models

### Template Context

The template will receive a structured context object containing all necessary variables:

```typescript
interface TemplateContext {
  examples?: {
    formatted: string;
    items: ProductData[];
  };
  language?: string;
  descriptionLength?: string;
  paragraphCount?: string;
  metadata?: string;
  imageCount: number;
  conditionals: {
    hasExamples: boolean;
    hasMetadata: boolean;
    hasDescriptionLength: boolean;
    hasLanguage: boolean;
    isMultipleImages: boolean;
  };
}
```

### Template Structure

The Handlebars template will mirror the current prompt structure:

```handlebars
{{#if conditionals.hasExamples}}
<examples>
{{{examples.formatted}}}
</examples>

{{/if}}
You are responsible for creating enticing and informative titles and descriptions for products on an e-commerce site. The products are targeted towards a general consumer audience and cover a wide range of categories, such as electronics, home goods, and apparel.

Output Format:
Please respond in the following XML format:

<product>
    <title>Concise, engaging title. Include the brand name and/or product name if they known. (up to 60 characters)</title>
    <description>Informative description{{#if paragraphCount}} {{{paragraphCount}}}{{/if}} highlighting key features, benefits, and use cases. Multiple paragraphs are separated by newline characters.</description>
</product>

Guidelines:
- Title: Keep it short, clear, and attention-grabbing
- Description: Emphasize the most important details about the product
{{#if conditionals.hasExamples}}
- Use the language, style, and tone demonstrated in <examples>
{{else}}
- Tone: Friendly and conversational, tailored to the target audience
{{/if}}
{{#if conditionals.hasDescriptionLength}}
- Description length: {{{paragraphCount}}}
{{/if}}
- Any additional metadata or constraints will be provided in <metadata> tags
- Respond in the above XML format with exactly one <product> that contains exactly one <title> and exactly one <description>. <title> and <description> contain only strings and no other tags.

Please create a title and a description{{#if conditionals.hasDescriptionLength}} with {{{paragraphCount}}}{{/if}}{{#if conditionals.hasExamples}} following the language, style, and tone provided in <examples>{{/if}}{{#if language}} in {{{language}}}{{/if}} for the product shown in the {{#if conditionals.isMultipleImages}}images{{else}}image{{/if}}{{#if conditionals.hasMetadata}} and metadata in <metadata>{{/if}}.
{{#if conditionals.hasMetadata}}

<metadata>{{{metadata}}}</metadata>
{{/if}}
```

## Error Handling

### Template Loading Errors

- **Missing Template Files**: Throw `TemplateNotFoundError` with clear file path
- **Invalid Template Syntax**: Throw `TemplateSyntaxError` with line number and description
- **File System Errors**: Wrap and re-throw with context

### Template Rendering Errors

- **Missing Variables**: Use Handlebars strict mode to catch undefined variables
- **Rendering Failures**: Catch and wrap Handlebars errors with context
- **Invalid Context**: Validate context object before rendering

### Error Classes

```typescript
export class TemplateError extends Error {
  constructor(
    message: string,
    public templateName: string,
  ) {
    super(`Template ${templateName}: ${message}`);
  }
}

export class TemplateNotFoundError extends TemplateError {}
export class TemplateSyntaxError extends TemplateError {}
export class TemplateRenderError extends TemplateError {}
```

## Testing Strategy

### Unit Tests

1. **Template Service Tests**

   - Template loading and caching
   - Error handling for missing/invalid templates
   - Context validation

2. **Template Rendering Tests**

   - All conditional branches in templates
   - Variable interpolation
   - Edge cases (empty arrays, null values)

3. **Integration Tests**
   - End-to-end prompt generation
   - Comparison with current implementation output
   - Performance benchmarks

### Test Data

- Create test fixtures with various combinations of parameters
- Mock template files for error condition testing
- Snapshot testing for prompt output consistency

### Performance Testing

- Measure template loading and rendering performance
- Compare with current string concatenation approach
- Ensure Lambda cold start impact is minimal

## Implementation Phases

### Phase 1: Template Infrastructure

- Add Handlebars dependency
- Create TemplateService class
- Implement template loading and caching

### Phase 2: Template Creation

- Convert current prompt to Handlebars template
- Create template context interface
- Implement context preparation logic

### Phase 3: Integration

- Update ProductGeneratorService to use templates
- Maintain backward compatibility
- Add comprehensive error handling

### Phase 4: Testing & Validation

- Unit and integration tests
- Performance validation
- Output comparison with current implementation

## Migration Strategy

1. **Parallel Implementation**: Keep existing code while building template system
2. **Feature Flag**: Use environment variable to toggle between implementations
3. **Gradual Rollout**: Test in development before production deployment
4. **Rollback Plan**: Maintain ability to revert to string-based approach
5. **Cleanup**: Remove old implementation after successful validation

## Dependencies

### New Dependencies

- `handlebars`: Template engine (^4.7.8)
- `@types/handlebars`: TypeScript definitions (^4.1.0)

### Dependency Management

- Dependencies must be added to `.projenrc.ts` configuration file
- Run `pnpm pdk` after updating `.projenrc.ts` to regenerate `package.json`
- Follow the Projen workflow for all dependency changes

### Build Process

- Templates will be included in the Lambda deployment package
- No additional build steps required (templates are loaded at runtime)

## Security Considerations

- Templates contain no user input - only predefined structure
- Use triple-brace syntax `{{{variable}}}` for HTML/XML content to prevent escaping
- Validate template context to prevent injection attacks
- Templates are read-only and loaded from trusted sources
