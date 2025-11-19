#!/usr/bin/env node

import minimist from "minimist";
import { init } from "../src/commands/init.js";
import { fmt } from "../src/commands/fmt.js";
import { check } from "../src/commands/check.js";

const USAGE = `
dprint-js - Auto-format source code based on specified plugins

USAGE:
    dprint-js <SUBCOMMAND> [OPTIONS] [--] [file patterns]...

SUBCOMMANDS:
    init      Initializes a configuration file in the current directory
    fmt       Formats the source files and writes the result to the file system
    check     Checks for any files that haven't been formatted

OPTIONS:
    --config <path>    Path to the configuration file (default: auto-detect)
    --help, -h         Show this help message
    --version, -v      Show version information

EXAMPLES:
    dprint-js init
    dprint-js fmt
    dprint-js check
    dprint-js fmt "src/**/*.ts"
    dprint-js check --config ./custom-dprint.json
`;

function showHelp() {
  console.log(USAGE);
}

function showVersion() {
  // Read version from package.json
  import("node:fs").then((fs) => {
    import("node:path").then((path) => {
      import("node:url").then((url) => {
        const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
        const pkgPath = path.join(__dirname, "..", "package.json");
        const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
        console.log(`dprint-js v${pkg.version}`);
      });
    });
  });
}

async function main() {
  const args = minimist(process.argv.slice(2), {
    string: ["config", "output"],
    boolean: ["help", "version"],
    alias: {
      h: "help",
      v: "version",
      c: "config",
      o: "output"
    }
  });

  // Handle help flag
  if (args.help) {
    showHelp();
    process.exit(0);
  }

  // Handle version flag
  if (args.version) {
    showVersion();
    process.exit(0);
  }

  const subcommand = args._[0];
  const filePatterns = args._.slice(1);

  const options = {
    config: args.config,
    output: args.output
  };

  try {
    switch (subcommand) {
      case "init":
        await init(options);
        break;

      case "fmt":
      case "format":
        await fmt(filePatterns, options);
        break;

      case "check":
        await check(filePatterns, options);
        break;

      case undefined:
        console.error("Error: No subcommand specified");
        showHelp();
        process.exit(1);
        break;

      default:
        console.error(`Error: Unknown subcommand '${subcommand}'`);
        showHelp();
        process.exit(1);
    }
  } catch (error) {
    console.error(`Fatal error: ${error.message}`);
    if (process.env.DEBUG) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

main();
