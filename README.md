# dprint-js

A JavaScript implementation of the dprint CLI that uses the `@dprint/formatter` package to format source code. Unlike the standard dprint CLI which downloads WASM plugins from URLs, this implementation loads formatters directly from npm packages installed in your `node_modules`.

## Features

- **Format code** using dprint formatter plugins from npm
- **Check formatting** without modifying files
- **Initialize** configuration files
- **Include/exclude patterns** for file selection
- **Plugin configuration** via dprint.json

## Installation

```bash
npm install --save-dev @dprint/typescript @dprint/json @dprint/markdown
```

## Usage

### Initialize Configuration

Create a `dprint.json` configuration file in your project:

```bash
node bin/dprint.js init
```

This creates a default configuration file with TypeScript, JSON, and Markdown plugins.

### Format Files

Format all files matching the patterns in your configuration:

```bash
node bin/dprint.js fmt
```

Format specific files or patterns:

```bash
node bin/dprint.js fmt "src/**/*.ts"
node bin/dprint.js fmt "src/**/*.{js,json}"
```

### Check Formatting

Check if files are formatted without modifying them:

```bash
node bin/dprint.js check
```

Check specific files:

```bash
node bin/dprint.js check "src/**/*.ts"
```

## Configuration

The `dprint.json` file controls which files to format and how to format them:

```json
{
  "$schema": "https://dprint.dev/schemas/v0.json",
  "includes": ["**/*.{ts,tsx,js,jsx,json,md}"],
  "excludes": [
    "**/node_modules",
    "**/.git",
    "**/dist",
    "**/build"
  ],
  "plugins": [
    "@dprint/typescript",
    "@dprint/json",
    "@dprint/markdown"
  ],
  "typescript": {
    "quoteStyle": "double",
    "semiColons": "always"
  },
  "json": {
    "indentWidth": 2
  }
}
```

### Configuration Options

- **includes**: Array of glob patterns for files to format (default: `["**/*"]`)
- **excludes**: Array of glob patterns for files to exclude (default: common ignore patterns)
- **plugins**: Array of npm package names for formatter plugins
- **[pluginName]**: Plugin-specific configuration objects

## Plugins

The `plugins` array in `dprint.json` should reference npm packages, not URLs:

```json
{
  "plugins": [
    "@dprint/typescript",
    "@dprint/json",
    "@dprint/markdown"
  ]
}
```

Make sure these packages are installed in your `node_modules`:

```bash
npm install --save-dev @dprint/typescript @dprint/json @dprint/markdown
```

### Supported Plugins

- **@dprint/typescript**: Formats `.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`, `.cjs` files
- **@dprint/json**: Formats `.json`, `.jsonc` files
- **@dprint/markdown**: Formats `.md`, `.markdown` files

## Differences from Standard dprint

This implementation differs from the standard dprint CLI in the following ways:

1. **Plugin Loading**: Uses npm packages instead of downloading WASM plugins from URLs
2. **Runtime**: Pure JavaScript/Node.js implementation using `@dprint/formatter` package
3. **Configuration**: Plugins are specified as npm package names, not URLs
4. **Installation**: Requires plugins to be installed via npm

## Programmatic Usage

You can also use dprint-js programmatically in your JavaScript/TypeScript code:

```javascript
import { loadConfig, loadPlugins, formatFile } from "./src/index.js";

// Load configuration
const config = loadConfig();

// Load formatter plugins
const plugins = await loadPlugins(config);

// Format a specific file
const result = formatFile("path/to/file.js", plugins);
if (result.changed) {
  console.log("File needs formatting");
}
```

## CLI Options

### Global Options

- `--config <path>`: Specify a custom configuration file path
- `--help, -h`: Show help message
- `--version, -v`: Show version information

### Commands

- `init`: Initialize a configuration file
  - `--output, -o <path>`: Specify output path for config file
- `fmt`: Format files and write changes
- `check`: Check formatting without writing changes

## Examples

```bash
# Initialize configuration
node bin/dprint.js init

# Format all files in the project
node bin/dprint.js fmt

# Check only TypeScript files
node bin/dprint.js check "src/**/*.ts"

# Format with custom config
node bin/dprint.js fmt --config custom-dprint.json

# Format specific directories
node bin/dprint.js fmt "src/**/*" "tests/**/*"
```

## Testing

The project includes sample test files to verify functionality:

```bash
# Check test files
node bin/dprint.js check "test/**/*"

# Format test files
node bin/dprint.js fmt "test/**/*"
```

## License

MIT
