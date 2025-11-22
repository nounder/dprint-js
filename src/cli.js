import { parseArgs, showCheckHelp, showFmtHelp, showHelp, showInitHelp } from "./args-parser.js";
import checkCommand from "./commands/check.js";
import fmtCommand from "./commands/fmt.js";
import initCommand from "./commands/init.js";
import configCommand from "./commands/config.js";
import outputFilePathsCommand from "./commands/output-file-paths.js";
import outputResolvedConfigCommand from "./commands/output-resolved-config.js";
import outputFormatTimesCommand from "./commands/output-format-times.js";
import { DPRINT } from "./constants.js";

/**
 * Main CLI function
 */
export async function main(args = process.argv.slice(2)) {
  const parsed = parseArgs(args);

  // Show general help if no command or help command
  if (!parsed.command || parsed.command === "help") {
    showHelp();
    return 0;
  }

  // Show command-specific help if --help flag is present
  if (parsed.options.help) {
    switch (parsed.command) {
      case "init":
        showInitHelp();
        return 0;
      case "fmt":
        showFmtHelp();
        return 0;
      case "check":
        showCheckHelp();
        return 0;
      default:
        showHelp();
        return 0;
    }
  }

  try {
    switch (parsed.command) {
      case "init":
        return await initCommand(parsed.options);

      case "fmt":
        return await fmtCommand(parsed.positional, parsed.options);

      case "check":
        return await checkCommand(parsed.positional, parsed.options);

      case "config":
        return await configCommand(parsed.positional, parsed.options);

      case "output-file-paths":
        return await outputFilePathsCommand(parsed.positional, parsed.options);

      case "output-resolved-config":
        return await outputResolvedConfigCommand(parsed.options);

      case "output-format-times":
        return await outputFormatTimesCommand(parsed.positional, parsed.options);

      default:
        console.error(`Error: Unknown command '${parsed.command}'`);
        console.error(`Run '${DPRINT} help' for usage information`);
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
