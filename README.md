# dprint-js

A JavaScript implementation of the dprint CLI for code formatting. This tool provides the core functionality of dprint, allowing you to format source code files using dprint's plugin system.

## Features

- **Multiple Language Support**: Format TypeScript, JavaScript, JSON, and Markdown files
- **Plugin System**: Load formatters from npm packages
- **Configuration**: Uses `dprint.json` for configuration with include/exclude patterns
- **Three Main Commands**:
  - `init` - Initialize a new configuration file
  - `fmt` - Format files and write changes
  - `check` - Check if files are formatted correctly
- **Rust dprint Compatibility**: Exit codes and behavior match the official Rust dprint CLI
- **Comprehensive Testing**: 125+ tests ensuring feature parity and correctness

## Installation

First, install the dependencies:

```bash
npm install
```

Make the CLI executable:

```bash
chmod +x bin/dprint-js.js
```

Optionally, link it globally:

```bash
npm link
```

## Usage

### Initialize Configuration

Create a new `dprint.json` configuration file in the current directory:

```bash
node bin/dprint-js.js init
```

### Format Files

Format all files according to the configuration:

```bash
node bin/dprint-js.js fmt
```

Format specific files or patterns:

```bash
node bin/dprint-js.js fmt src/**/*.ts
node bin/dprint-js.js fmt -- src/**/*.ts test/**/*.js
```

### Check Formatting

Check if files are formatted correctly without modifying them:

```bash
node bin/dprint-js.js check
```

Check specific files:

```bash
node bin/dprint-js.js check src/**/*.ts
```

## Configuration

The `dprint.json` file configures which files to format and how. Example:

```json
{
  "$schema": "https://dprint.dev/schemas/v0.json",
  "projectType": "openSource",
  "incremental": true,
  "includes": ["**/*.{ts,tsx,js,jsx,json,md}"],
  "excludes": [
    "**/node_modules",
    "**/*-lock.json",
    "**/dist",
    "**/build",
    "**/coverage"
  ],
  "plugins": [
    "@dprint/typescript",
    "@dprint/json",
    "@dprint/markdown"
  ],
  "typescript": {},
  "json": {},
  "markdown": {}
}
```

### Plugin Configuration

Plugins are loaded from your `node_modules` directory. Make sure to install the required plugins:

```bash
npm install @dprint/typescript @dprint/json @dprint/markdown
```

The plugins in `dprint.json` should match npm package names installed in your project.

## How It Works

1. **Configuration Discovery**: Searches for `dprint.json` starting from the current directory and walking up the directory tree
2. **Plugin Loading**: Dynamically imports formatter plugins from npm packages
3. **File Discovery**: Uses glob patterns to find files matching include patterns while excluding specified patterns
4. **Formatting**: Loads WASM formatters and applies them to matching files

## Example Workflow

```bash
# 1. Initialize project
node bin/dprint-js.js init

# 2. Install formatter plugins
npm install @dprint/typescript @dprint/json @dprint/markdown

# 3. Format your code
node bin/dprint-js.js fmt

# 4. Check formatting in CI
node bin/dprint-js.js check
```

## CLI Options

```
USAGE:
    dprint-js <SUBCOMMAND> [OPTIONS] [--] [file patterns]...

SUBCOMMANDS:
    init     Initializes a configuration file in the current directory
    fmt      Formats the source files and writes the result to the file system
    check    Checks for any files that haven't been formatted
    help     Shows this help message

OPTIONS:
    --       Treat all following arguments as file patterns
```

## Testing

The project includes comprehensive test coverage with 125+ tests:

### Run All Tests
```bash
bun test
```

### Run Specific Test Suites
```bash
# Comparison tests (JS CLI vs Rust dprint)
bun test test/comparison/

# Unit tests for specific commands
bun test test/check.test.ts
bun test test/fmt.test.ts
bun test test/init.test.ts

# Configuration tests
bun test test/config_includes.test.ts
bun test test/config_excludes.test.ts
bun test test/config_formatting.test.ts
```

### Test Coverage

- **Comparison Tests (33 tests)**: Verify JS CLI matches Rust dprint behavior
  - Exit codes match exactly
  - Output formatting is identical
  - Error handling is consistent

- **Unit Tests (81 tests)**: Command-specific functionality
  - File formatting and checking
  - Configuration loading and validation
  - Error handling and edge cases

- **Pattern Tests (27 tests)**: Includes/excludes glob patterns
  - Single file patterns
  - Wildcard patterns
  - Directory-specific patterns
  - Complex glob patterns with multiple wildcards
  - Nested directory exclusions
  - Brace expansion patterns

- **Formatting Option Tests (5 tests)**: Global formatting options
  - lineWidth
  - indentWidth
  - useTabs

### Exit Codes

The CLI uses standard dprint exit codes:
- `0` - Success
- `1` - General error
- `11` - Configuration error (missing/invalid config)
- `13` - Plugin error (missing/failed to load)
- `14` - No files found (when not using `--allow-no-files`)
- `20` - Files not formatted (check command)

## Dependencies

- `@dprint/formatter` - Core formatting engine
- `@dprint/typescript` - TypeScript/JavaScript formatter
- `@dprint/json` - JSON formatter
- `@dprint/markdown` - Markdown formatter
- `fast-glob` - Fast file globbing
- `minimatch` - Pattern matching for include/exclude

## Development

See [AGENTS.md](./AGENTS.md) for information about working with AI assistants on this project.

## License

MIT
