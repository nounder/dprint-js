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

## Dependencies

- `@dprint/formatter` - Core formatting engine
- `@dprint/typescript` - TypeScript/JavaScript formatter
- `@dprint/json` - JSON formatter
- `@dprint/markdown` - Markdown formatter
- `fast-glob` - Fast file globbing
- `minimatch` - Pattern matching for include/exclude

## License

MIT
