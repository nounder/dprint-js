import { initCommand, fmtCommand, checkCommand } from "./commands.js";

/**
 * Parse command line arguments
 */
export function parseArgs(args) {
  const result = {
    command: null,
    filePatterns: [],
    options: {},
  };

  let i = 0;
  while (i < args.length) {
    const arg = args[i];

    if (!result.command && !arg.startsWith("-")) {
      // First non-flag argument is the command
      result.command = arg;
      i++;
      continue;
    }

    if (arg === "--") {
      // Everything after -- is file patterns
      i++;
      result.filePatterns.push(...args.slice(i));
      break;
    }

    if (arg.startsWith("-")) {
      // Option flag
      result.options[arg] = true;
      i++;
      continue;
    }

    // File pattern
    result.filePatterns.push(arg);
    i++;
  }

  return result;
}

/**
 * Show help message
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

OPTIONS:
    --       Treat all following arguments as file patterns

EXAMPLES:
    dprint-js init
    dprint-js fmt
    dprint-js check
    dprint-js fmt src/**/*.ts
    dprint-js check -- src/**/*.ts test/**/*.ts
`);
}

/**
 * Main CLI function
 */
export async function main(args = process.argv.slice(2)) {
  const parsed = parseArgs(args);

  if (!parsed.command || parsed.command === "help") {
    showHelp();
    return 0;
  }

  try {
    switch (parsed.command) {
      case "init":
        return await initCommand(parsed.options);

      case "fmt":
        return await fmtCommand(parsed.filePatterns, parsed.options);

      case "check":
        return await checkCommand(parsed.filePatterns, parsed.options);

      default:
        console.error(`Error: Unknown command '${parsed.command}'`);
        console.error("Run 'dprint-js help' for usage information");
        return 1;
    }
  } catch (error) {
    console.error(`Error: ${error.message}`);
    if (error.stack) {
      console.error(error.stack);
    }
    return 1;
  }
}
