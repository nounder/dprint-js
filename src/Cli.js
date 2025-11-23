import * as ArgsParser from "./ArgsParser.js";
import * as CheckCommand from "./commands/CheckCommand.js";
import * as FmtCommand from "./commands/FmtCommand.js";
import * as InitCommand from "./commands/InitCommand.js";
import * as ConfigCommand from "./commands/ConfigCommand.js";
import * as OutputFilePathsCommand from "./commands/OutputFilePathsCommand.js";
import * as OutputResolvedConfigCommand from "./commands/OutputResolvedConfigCommand.js";
import * as OutputFormatTimesCommand from "./commands/OutputFormatTimesCommand.js";
import * as Constants from "./Constants.js";

/**
 * Main CLI function
 */
export async function main(args = process.argv.slice(2)) {
  const parsed = ArgsParser.parseArgs(args);

  // Show general help if no command or help command
  if (!parsed.command || parsed.command === "help") {
    ArgsParser.showHelp();
    return 0;
  }

  // Show command-specific help if --help flag is present
  if (parsed.options.help) {
    switch (parsed.command) {
      case "init":
        ArgsParser.showInitHelp();
        return 0;
      case "fmt":
        ArgsParser.showFmtHelp();
        return 0;
      case "check":
        ArgsParser.showCheckHelp();
        return 0;
      default:
        ArgsParser.showHelp();
        return 0;
    }
  }

  try {
    // Ensure cwd is always set in options
    const options = { ...parsed.options, cwd: parsed.options.cwd || process.cwd() };

    switch (parsed.command) {
      case "init":
        return await InitCommand.run(options);

      case "fmt":
        return await FmtCommand.run({ ...options, filePatterns: parsed.positional });

      case "check":
        return await CheckCommand.run({ ...options, filePatterns: parsed.positional });

      case "config":
        return await ConfigCommand.run({ ...options, args: parsed.positional });

      case "output-file-paths":
        return await OutputFilePathsCommand.run({ ...options, filePatterns: parsed.positional });

      case "output-resolved-config":
        return await OutputResolvedConfigCommand.run(options);

      case "output-format-times":
        return await OutputFormatTimesCommand.run({ ...options, filePatterns: parsed.positional });

      default:
        console.error(`Error: Unknown command '${parsed.command}'`);
        console.error(`Run '${Constants.DPRINT} help' for usage information`);
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
