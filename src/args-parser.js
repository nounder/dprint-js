/**
 * Argument parser for dprint-js CLI
 */

/**
 * Parse command line arguments with support for flags, options, and positional arguments
 */
export function parseArgs(args) {
  const result = {
    command: null,
    positional: [],
    options: {},
  };

  let i = 0;
  while (i < args.length) {
    const arg = args[i];

    // First non-flag argument is the command
    if (!result.command && !arg.startsWith("-")) {
      result.command = arg;
      i++;
      continue;
    }

    // Handle help flag
    if (arg === "-h" || arg === "--help") {
      result.options.help = true;
      i++;
      continue;
    }

    // Handle -- separator (all remaining are positional)
    if (arg === "--") {
      i++;
      result.positional.push(...args.slice(i));
      break;
    }

    // Handle --flag=value syntax
    if (arg.startsWith("--") && arg.includes("=")) {
      const [flag, ...valueParts] = arg.split("=");
      const value = valueParts.join("=");
      const key = kebabToCamel(flag.slice(2));
      result.options[key] = parseValue(value);
      i++;
      continue;
    }

    // Handle short flags (-c, -L)
    if (arg.startsWith("-") && !arg.startsWith("--") && arg.length === 2) {
      const flag = arg.slice(1);
      const key = flagToKey(flag);

      // Check if next arg is a value or another flag
      if (i + 1 < args.length && !args[i + 1].startsWith("-")) {
        result.options[key] = args[i + 1];
        i += 2;
      } else {
        result.options[key] = true;
        i++;
      }
      continue;
    }

    // Handle long flags (--config, --includes-override)
    if (arg.startsWith("--")) {
      const flag = arg.slice(2);
      const key = kebabToCamel(flag);

      // Check if this is a variadic flag (takes multiple values)
      const variadicFlags = ["includesOverride", "excludes", "excludesOverride", "plugins"];

      if (variadicFlags.includes(key)) {
        result.options[key] = result.options[key] || [];
        // Collect all values until next flag
        i++;
        while (i < args.length && !args[i].startsWith("-")) {
          result.options[key].push(args[i]);
          i++;
        }
        continue;
      }

      // Check if next arg is a value
      if (i + 1 < args.length && !args[i + 1].startsWith("-")) {
        result.options[key] = parseValue(args[i + 1]);
        i += 2;
      } else {
        result.options[key] = true;
        i++;
      }
      continue;
    }

    // Positional argument
    result.positional.push(arg);
    i++;
  }

  return result;
}

/**
 * Map short flags to their long form keys
 */
function flagToKey(flag) {
  const mapping = {
    "c": "config",
    "L": "logLevel",
    "h": "help",
  };
  return mapping[flag] || flag;
}

/**
 * Convert kebab-case to camelCase
 */
function kebabToCamel(str) {
  return str.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * Parse a value string to appropriate type
 */
function parseValue(value) {
  if (value === "true") return true;
  if (value === "false") return false;
  return value;
}

/**
 * Show general help message
 */
export function showHelp() {
  console.log(`dprint-js - JavaScript implementation of dprint CLI

USAGE:
    dprint-js <SUBCOMMAND> [OPTIONS] [--] [file patterns]...

SUBCOMMANDS:
    init     Initializes a configuration file in the current directory
    fmt      Formats the source files and writes the result to the file system
    check    Checks for any files that haven't been formatted
    help     Shows this help message

Use 'dprint-js <subcommand> --help' for more information on a specific command.
`);
}

/**
 * Show init command help
 */
export function showInitHelp() {
  console.log(`Initializes a configuration file in the current directory.

Usage: dprint init [OPTIONS]

Options:
  -c, --config <config>             Path or url to JSON configuration file. Defaults to dprint.json(c) or .dprint.json(c) in current or ancestor directory when not provided.
      --config-discovery=<BOOLEAN>  Sets the config discovery mode. Set to \`false\` to completely disable.
      --plugins <urls/files>...     List of urls or file paths of plugins to use. This overrides what is specified in the config file.
  -L, --log-level <log-level>       Set log level [default: info] [possible values: debug, info, warn, error, silent]
  -h, --help                        Print help
`);
}

/**
 * Show fmt command help
 */
export function showFmtHelp() {
  console.log(`Formats the source files and writes the result to the file system.

Usage: dprint fmt [OPTIONS] [files]...

Arguments:
  [files]...  List of file patterns in quotes to format. This can be a subset of what is found in the config file.

Options:
      --includes-override <patterns>...
          List of file patterns in quotes to format. This overrides what is specified in the config file.
      --excludes <patterns>...
          List of file patterns or directories in quotes to exclude when formatting. This excludes in addition to what is found in the config file.
      --excludes-override <patterns>...
          List of file patterns or directories in quotes to exclude when formatting. This overrides what is specified in the config file.
      --allow-node-modules
          Allows traversing node module directories (unstable - This flag will be renamed to be non-node specific in the future).
      --allow-gitignored
          Allows formatting files that are ignored by .gitignore. By default, dprint respects .gitignore patterns.
      --incremental[=<incremental>]
          Only format files when they change. This may alternatively be specified in the configuration file. [possible values: true, false]
      --stdin <extension/file-name/file-path>
          Format stdin and output the result to stdout. Provide an absolute file path to apply the inclusion and exclusion rules or an extension or file name to always format the text.
      --diff
          Outputs a check-like diff of every formatted file.
      --staged
          Format only the staged files.
      --allow-no-files
          Causes dprint to exit with exit code 0 when no files are found instead of exit code 14.
  -c, --config <config>
          Path or url to JSON configuration file. Defaults to dprint.json(c) or .dprint.json(c) in current or ancestor directory when not provided.
      --config-discovery=<BOOLEAN>
          Sets the config discovery mode. Set to \`false\` to completely disable.
      --plugins <urls/files>...
          List of urls or file paths of plugins to use. This overrides what is specified in the config file.
  -L, --log-level <log-level>
          Set log level [default: info] [possible values: debug, info, warn, error, silent]
  -h, --help
          Print help
`);
}

/**
 * Show check command help
 */
export function showCheckHelp() {
  console.log(`Checks for any files that haven't been formatted.

Usage: dprint check [OPTIONS] [files]...

Arguments:
  [files]...  List of file patterns in quotes to format. This can be a subset of what is found in the config file.

Options:
      --includes-override <patterns>...
          List of file patterns in quotes to format. This overrides what is specified in the config file.
      --excludes <patterns>...
          List of file patterns or directories in quotes to exclude when formatting. This excludes in addition to what is found in the config file.
      --excludes-override <patterns>...
          List of file patterns or directories in quotes to exclude when formatting. This overrides what is specified in the config file.
      --allow-node-modules
          Allows traversing node module directories (unstable - This flag will be renamed to be non-node specific in the future).
      --allow-gitignored
          Allows checking files that are ignored by .gitignore. By default, dprint respects .gitignore patterns.
      --incremental[=<incremental>]
          Only format files when they change. This may alternatively be specified in the configuration file. [possible values: true, false]
      --allow-no-files
          Causes dprint to exit with exit code 0 when no files are found instead of exit code 14.
      --staged
          Format only the staged files.
      --list-different
          Only outputs file paths that aren't formatted and doesn't output diffs.
  -c, --config <config>
          Path or url to JSON configuration file. Defaults to dprint.json(c) or .dprint.json(c) in current or ancestor directory when not provided.
      --config-discovery=<BOOLEAN>
          Sets the config discovery mode. Set to \`false\` to completely disable.
      --plugins <urls/files>...
          List of urls or file paths of plugins to use. This overrides what is specified in the config file.
  -L, --log-level <log-level>
          Set log level [default: info] [possible values: debug, info, warn, error, silent]
  -h, --help
          Print help
`);
}
