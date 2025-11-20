# Testing Guide for dprint-js

This skill provides comprehensive testing guidance for the dprint-js project.

## Test Requirements

### Comparison Tests (`test/comparison/`)

These tests run both the JS CLI and Rust dprint (`npx dprint`) side-by-side:

- **Purpose**: Ensure identical behavior between implementations
- **Requirements**:
  - Exit codes must match exactly
  - Output must be byte-for-byte identical
  - File modifications must be identical
- **Test Structure**:
  - "ours" directory: uses npm plugins (`@dprint/typescript`)
  - "theirs" directory: uses URL plugins (Rust dprint)
  - Both use identical configs and test files

### Unit Tests

- Test individual command functionality
- Test error scenarios (missing config, invalid JSON, etc.)
- Test file pattern matching
- Test configuration options

### Pattern Tests

- Exhaustive testing of includes/excludes patterns
- Must test various glob patterns:
  - Simple wildcards (`*.ts`, `test*.ts`)
  - Double-star patterns (`**/*.ts`, `src/**/*.ts`)
  - Brace expansion (`**/*.{ts,tsx,js}`)
  - Directory-specific patterns
  - Negation and exclusion precedence

## Adding a New Test

### Comparison Test

For behavior that should match Rust dprint:

```typescript
import * as t from "bun:test"

t.it("describes the behavior", async () => {
  // Setup files in both oursDir and theirsDir
  fs.writeFileSync(path.join(oursDir, "test.ts"), "const   x=1");
  fs.writeFileSync(path.join(theirsDir, "test.ts"), "const   x=1");

  // Run our implementation
  process.chdir(oursDir);
  const ourExitCode = await checkCommand([], { log_level: "silent" });

  // Run Rust dprint
  process.chdir(theirsDir);
  const theirResult = await Bun.$`npx dprint check --log-level silent`.nothrow().quiet();

  // Compare results
  t.expect(ourExitCode).toBe(theirResult.exitCode);
});
```

### Unit Test

For JS-specific functionality:

```typescript
import * as t from "bun:test"

t.it("describes the functionality", async () => {
  // Setup
  const config = { /* ... */ };
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

  // Execute
  const result = await fmtCommand();

  // Assert
  t.expect(result).toBe(0);
});
```

## Testing Best Practices

### 1. Always Test Error Cases

For every feature, test:

- Happy path (normal operation)
- Missing config
- Invalid config
- Missing files
- Edge cases

### 2. Use Descriptive Test Names

Good: `"returns exit code 11 when config file is missing"`

Bad: `"test error handling"`

### 3. Keep Tests Isolated

- Use `beforeEach` to create fresh test environments
- Use `afterEach` to clean up
- Don't rely on test execution order

### 4. Test Comparison Against Rust dprint

When adding new features:

1. Implement in JS
2. Write comparison test
3. Run Rust dprint to verify expected behavior
4. Ensure JS implementation matches

## Running Tests

```bash
# Run all tests
bun test

# Run specific test file / directory
bun test test/check.test.ts
```

### Testing Against Rust dprint

Comparison tests automatically run Rust dprint via `npx dprint`.
The first run will download it.

## Exit Codes

The CLI **must** use these exact exit codes to match Rust dprint:

- `0` - Success
- `1` - General error
- `11` - Configuration error (missing/invalid config file)
- `13` - Plugin error (missing/failed to load plugins)
- `14` - No files found (when not using `--allow-no-files`)
- `20` - Files not formatted (check command only)

## Test Checklist

When adding or modifying features, ask:

1. **Does this change affect compatibility with Rust dprint?**
   - If yes: Add comparison tests
   - Verify exit codes match

2. **Is the test coverage sufficient?**
   - Happy path tested?
   - Error cases tested?
   - Edge cases tested?

3. **Are exit codes correct?**
   - Config errors return 11
   - Plugin errors return 13
   - No files found returns 14
   - Unformatted files return 20
