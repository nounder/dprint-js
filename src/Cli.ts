import * as ArgsParser from "./ArgsParser.ts"
import * as CheckCommand from "./commands/CheckCommand.ts"
import * as ConfigCommand from "./commands/ConfigCommand.ts"
import * as FmtCommand from "./commands/FmtCommand.ts"
import * as HelpCommand from "./commands/HelpCommand.ts"
import * as InitCommand from "./commands/InitCommand.ts"
import * as OutputFilePathsCommand from "./commands/OutputFilePathsCommand.ts"
import * as OutputFormatTimesCommand from "./commands/OutputFormatTimesCommand.ts"
import * as OutputResolvedConfigCommand from "./commands/OutputResolvedConfigCommand.ts"
import * as Constants from "./Constants.ts"

/**
 * Main CLI function
 * @param args - Command line arguments (defaults to process.argv.slice(2))
 * @returns Exit code
 */
export async function main(
  args: string[] = process.argv.slice(2),
): Promise<number> {
  const parsed = ArgsParser.parseArgs(args)

  // Show general help if no command or help command
  if (!parsed.command || parsed.command === "help") {
    return await HelpCommand.run()
  }

  // Show command-specific help if --help flag is present
  if (parsed.options.help) {
    return await HelpCommand.run({ subcommand: parsed.command })
  }

  try {
    // Ensure cwd is always set in options
    const cwdValue = typeof parsed.options.cwd === "string"
      ? parsed.options.cwd
      : process.cwd()
    const baseOptions = { ...parsed.options, cwd: cwdValue }

    switch (parsed.command) {
      case "init":
        return await InitCommand.run(baseOptions as any)

      case "fmt":
        return await FmtCommand.run(
          { ...baseOptions, filePatterns: parsed.positional } as any,
        )

      case "check":
        return await CheckCommand.run(
          { ...baseOptions, filePatterns: parsed.positional } as any,
        )

      case "config":
        return await ConfigCommand.run(
          { ...baseOptions, args: parsed.positional } as any,
        )

      case "output-file-paths":
        return await OutputFilePathsCommand.run(
          { ...baseOptions, filePatterns: parsed.positional } as any,
        )

      case "output-resolved-config":
        return await OutputResolvedConfigCommand.run(baseOptions as any)

      case "output-format-times":
        return await OutputFormatTimesCommand.run(
          { ...baseOptions, filePatterns: parsed.positional } as any,
        )

      default:
        console.error(`Error: Unknown command '${parsed.command}'`)
        console.error(`Run '${Constants.DPRINT} help' for usage information`)
        return 1
    }
  } catch (error) {
    const err = error as Error
    console.error(`Error: ${err.message}`)
    if (err.stack) {
      console.error(err.stack)
    }
    return 1
  }
}
