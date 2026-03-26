# Testing Efficiency Guidelines

## Avoid Redundant Testing

When implementing and validating changes, follow these principles to avoid unnecessary work:

### Trust Existing Test Suites

- If unit tests pass, they already validate that dependencies are installed and importable
- Don't run additional import tests (`python -c "import ..."`) after successful unit tests
- Unit tests are comprehensive validation - they test both functionality and environment setup

### Minimal Validation Approach

- Run the primary test suite (pytest, jest, etc.) first
- If tests pass, the implementation is validated
- Only run additional checks if tests fail or if testing specific edge cases not covered by existing tests

### Efficient Test Execution

- Use existing test commands rather than creating ad-hoc validation scripts
- Leverage build tools and CI pipelines that already validate functionality
- Trust the test framework's output rather than duplicating validation

### When Additional Testing Is Appropriate

- Testing deployment-specific scenarios not covered by unit tests
- Validating cross-platform compatibility
- Testing integration points between systems
- Verifying performance characteristics

### Examples of Redundant Testing to Avoid

- Running import tests after unit tests pass
- Re-testing basic functionality that's already covered
- Multiple validation of the same dependency installation
- Duplicate build verification steps

### Manual Approval Required

One-liner validation commands (e.g., `python -c "import module"`, `node -e "require('module')"`) require manual approval and should be avoided when comprehensive tests already validate functionality.

## Summary

Efficient testing means trusting your existing test suite and avoiding redundant validation steps. If unit tests pass, the implementation is working correctly.
