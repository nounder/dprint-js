# AI Agent Guide for dprint-js

This document provides guidance for AI assistants (like Claude) working on the dprint-js project.

## Project Overview

**dprint-js** is a JavaScript/TypeScript implementation of the dprint CLI for code formatting. It aims to provide feature parity with the official Rust dprint CLI while being npm-installable and JavaScript-native.

### Key Goals
1. **Compatibility**: Match Rust dprint's behavior, exit codes, and output exactly
2. **Testing**: Comprehensive test coverage with comparison tests against Rust dprint
3. **Quality**: Clean, maintainable code with proper error handling

## Project Structure

```
dprint-js/
├── src/
│   ├── cli.js              # Main CLI entry point
│   ├── commands/
│   │   ├── check.js        # Check command (exit code 20 if unformatted)
│   │   ├── fmt.js          # Format command
│   │   └── init.js         # Init command
│   ├── config.js           # Config loading and discovery
│   ├── files.js            # File discovery with glob patterns
│   └── formatter.js        # Plugin loading and formatting
├── test/
│   ├── comparison/         # Tests comparing JS vs Rust dprint
│   │   ├── check.test.ts
│   │   ├── fmt.test.ts
│   │   └── init.test.ts
│   ├── check.test.ts       # Unit tests for check command
│   ├── fmt.test.ts         # Unit tests for fmt command
│   ├── init.test.ts        # Unit tests for init command
│   ├── config_includes.test.ts   # 14 tests for include patterns
│   ├── config_excludes.test.ts   # 13 tests for exclude patterns
│   └── config_formatting.test.ts # 5 tests for formatting options
├── bin/
│   └── dprint-js           # Executable entry point
├── dprint.json             # Project's own config
└── package.json
```

## Important Standards

### Exit Codes
The CLI **must** use these exact exit codes to match Rust dprint:
- `0` - Success
- `1` - General error
- `11` - Configuration error (missing/invalid config file)
- `13` - Plugin error (missing/failed to load plugins)
- `14` - No files found (when not using `--allow-no-files`)
- `20` - Files not formatted (check command only)

### Test Requirements

#### Comparison Tests (`test/comparison/`)
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

#### Unit Tests
- Test individual command functionality
- Test error scenarios (missing config, invalid JSON, etc.)
- Test file pattern matching
- Test configuration options

#### Pattern Tests
- Exhaustive testing of includes/excludes patterns
- Must test various glob patterns:
  - Simple wildcards (`*.ts`, `test*.ts`)
  - Double-star patterns (`**/*.ts`, `src/**/*.ts`)
  - Brace expansion (`**/*.{ts,tsx,js}`)
  - Directory-specific patterns
  - Negation and exclusion precedence

### Code Style
- Use modern ES modules (`import`/`export`)
- Prefer `const` over `let`
- Use async/await for async operations
- Add JSDoc comments for public functions
- Handle errors gracefully with proper exit codes

## Common Tasks

### Adding a New Test

1. **Comparison Test** (for behavior that should match Rust dprint):
```typescript
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

2. **Unit Test** (for JS-specific functionality):
```typescript
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

### Modifying Commands

When changing command behavior:
1. Update the source file in `src/commands/`
2. Update or add unit tests in `test/`
3. Add comparison tests if behavior should match Rust dprint
4. Run all tests: `bun test`
5. Ensure exit codes are correct

### Error Handling Pattern

All commands should follow this pattern:

```javascript
export default async function commandName(args, options = {}) {
  // 1. Find config (exit 11 if missing)
  const configPath = findConfigFile(cwd, options);
  if (!configPath) {
    if (shouldLog("error")) {
      console.error("Error: No dprint.json configuration file found");
    }
    return 11;
  }

  // 2. Load config (exit 11 if invalid)
  let config;
  try {
    config = loadConfig(configPath, options);
  } catch (error) {
    if (shouldLog("error")) {
      console.error(`Error: ${error.message}`);
    }
    return 11;
  }

  // 3. Load plugins (exit 13 if missing/failed)
  let loadedPlugins;
  try {
    loadedPlugins = await loadPlugins(config, cwd);
  } catch (error) {
    if (shouldLog("error")) {
      console.error(`Error: ${error.message}`);
    }
    return 13;
  }

  // 4. Execute command logic
  // Return appropriate exit code
}
```

### Working with Glob Patterns

The project uses `fast-glob` for file discovery and `minimatch` for pattern matching:

```javascript
// In files.js
import fastGlob from "fast-glob";
import { minimatch } from "minimatch";

// Include patterns
const includePatterns = config.includes || [];

// Exclude patterns (take precedence)
const excludePatterns = config.excludes || [];

// Find files
const files = await fastGlob(includePatterns, {
  ignore: excludePatterns,
  cwd: workingDir,
  absolute: false,
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

### 5. Consolidate Similar Tests
Don't create separate test files for every small variation:
- ✅ `config_formatting.test.ts` (tests lineWidth, indentWidth, useTabs together)
- ❌ `config_lineWidth.test.ts`, `config_indentWidth.test.ts`, `config_useTabs.test.ts`

## Git Workflow

### Branch Naming
Use descriptive branch names:
- `claude/feature-name-<session-id>`
- `claude/fix-bug-<session-id>`

### Commit Messages
Follow this format:
```
Brief summary (50 chars or less)

More detailed explanation if needed. Explain:
- What changed
- Why it changed
- Any important implementation details

**Changes:**
- List specific changes
- Use bullet points
- Be clear and concise
```

### Before Pushing
1. Run all tests: `bun test`
2. Ensure all tests pass
3. Check that new code follows style guidelines
4. Commit related changes together

## Common Pitfalls

### ❌ Don't Do This
```javascript
// Wrong: Using console.log instead of return
console.error("Error occurred");
process.exit(1);  // Breaks tests!

// Wrong: Not checking exit codes
const result = await checkCommand();
// No assertion on result

// Wrong: Hardcoded paths
const file = "/tmp/test.ts";
```

### ✅ Do This
```javascript
// Correct: Return exit codes
if (error) {
  console.error("Error occurred");
  return 1;  // Test can verify this
}

// Correct: Always check exit codes
const exitCode = await checkCommand();
t.expect(exitCode).toBe(0);

// Correct: Use path.join for cross-platform compatibility
const file = path.join(testDir, "test.ts");
```

## Key Implementation Details

### Configuration Discovery
- Walks up directory tree looking for `dprint.json`
- Stops at first match or root directory
- Can be disabled with `options.config_discovery = false`
- Can specify custom path with `options.config`

### Plugin Loading
- Supports npm packages: `@dprint/typescript`
- Dynamically imports from node_modules
- Uses `@dprint/formatter` for WASM loading
- Caches loaded plugins

### File Pattern Matching
- Includes patterns are processed with fast-glob
- Excludes override includes (higher precedence)
- Supports all standard glob syntax:
  - `*` - matches any characters except `/`
  - `**` - matches zero or more directories
  - `{a,b}` - matches `a` or `b`
  - `[0-9]` - matches single character range

## Running the Project

### Development
```bash
# Install dependencies
bun install

# Run formatter on project
bun run fmt

# Check formatting
bun run check

# Run tests
bun test

# Run specific test file
bun test test/check.test.ts
```

### Testing Against Rust dprint
Comparison tests automatically run Rust dprint via `npx dprint`. The first run will download it.

## Questions to Ask

When working on this project, consider:

1. **Does this change affect compatibility with Rust dprint?**
   - If yes: Add comparison tests
   - Verify exit codes match

2. **What error cases exist?**
   - Missing files?
   - Invalid config?
   - Network errors (for plugin downloads)?

3. **How does this interact with glob patterns?**
   - Test with includes/excludes
   - Test nested directories
   - Test edge cases

4. **Is the test coverage sufficient?**
   - Happy path tested?
   - Error cases tested?
   - Edge cases tested?

## Resources

- [dprint Documentation](https://dprint.dev/)
- [fast-glob Documentation](https://github.com/mrmlnc/fast-glob)
- [minimatch Documentation](https://github.com/isaacs/minimatch)
- [Bun Test Documentation](https://bun.sh/docs/cli/test)

## Recent Changes

### Latest Commits
- **3ed6c2c**: Add exhaustive includes/excludes pattern tests (17 new tests)
- **fbe94e4**: Merge global formatting option tests into single file
- **5e001a9**: Add comprehensive error tests for ours & theirs comparison (11 error tests)

### Test Statistics
- Total: 125 tests
- Comparison tests: 33 (11 per command)
- Unit tests: 81
- Pattern tests: 27 (14 includes + 13 excludes)
- Formatting tests: 5

All tests passing ✅
