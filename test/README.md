# Test Suite Organization

The test suite is organized for both speed and comprehensive coverage.

## Test Structure

```
test/
├── **/*.test.ts              # Unit tests (fast)
├── comparison/
│   └── core.test.ts         # Critical comparison tests (10 tests, ~30s)
├── comparison-extended/      # Detailed comparison tests (CI only, ~100s)
│   ├── fmt.test.ts
│   ├── check.test.ts
│   ├── init.test.ts
│   ├── cache.test.ts
│   └── stdin.test.ts
└── helpers.ts                # Shared test utilities

```

## Running Tests

### Fast (Local Development)
```bash
bun test              # or bun run test:fast
```
- **226 tests in ~40 seconds**
- Includes all unit tests + core comparison tests
- Skips detailed comparison tests
- Perfect for local development and quick feedback

### Full (CI/Pre-commit)
```bash
bun run test:full
```
- **264 tests in ~130 seconds**
- Includes all tests including detailed comparison tests
- Comprehensive compatibility validation
- Run before pushing or in CI

## Test Categories

### Unit Tests
Fast tests that validate individual functions and commands without external dependencies.
- Located in `test/**/*.test.ts`
- ~5 seconds runtime
- Examples: `fmt.test.ts`, `check.test.ts`, `config_*.test.ts`

### Core Comparison Tests (`test/comparison/core.test.ts`)
Critical tests that verify compatibility with Rust dprint by spawning both implementations.
- ~10 essential tests
- ~30 seconds runtime
- Covers:
  - Formatting all file types (TS, JSON, MD)
  - File patterns and excludes
  - Check command exit codes
  - Error handling (missing config, no files)
  - Stdin formatting
  - Init command compatibility

### Extended Comparison Tests (`test/comparison-extended/`)
Detailed comparison tests for comprehensive validation.
- ~40 additional tests
- ~100 seconds runtime
- Only run with `bun run test:full`
- Covers edge cases, performance, caching, etc.

## Why This Structure?

**Problem**: Comparison tests are slow because each spawns `npx dprint` (1-3s per test)

**Solution**:
1. Keep critical comparison tests in the fast suite (10 tests = ~30s overhead)
2. Move detailed comparison tests to extended suite (runs in CI only)
3. Maintain comprehensive unit test coverage (fast, no external processes)

**Benefits**:
- Fast local feedback: 40s vs 130s (69% faster)
- Full CI coverage: All tests still run in CI
- No coverage loss: All 264 tests maintained
- Clear separation: Developers know what runs when

## Writing Tests

### Unit Tests
Use shared helpers from `test/helpers.ts`:
```typescript
import { createTestDir, createTestFiles, malformattedTS } from "./helpers.js";

let testDir: string;

t.beforeEach(() => {
  const dirs = createTestDir("my-test-");
  testDir = dirs.testDir;
});

t.afterEach(() => {
  cleanupDir(testDir);
});
```

### Comparison Tests
- **Core**: Add to `test/comparison/core.test.ts` if testing critical compatibility
- **Extended**: Add to appropriate file in `test/comparison-extended/` for detailed validation

## CI Configuration

In your CI pipeline, use:
```yaml
- name: Run tests
  run: bun run test:full
```

This ensures comprehensive validation while keeping local development fast.
