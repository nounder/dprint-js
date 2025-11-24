import * as Constants from "../Constants.ts"

/**
 * Show general help message
 */
export function showHelp(): void {
  console.log(`${Constants.DPRINT} - JavaScript implementation of dprint CLI

USAGE:
    ${Constants.DPRINT} <SUBCOMMAND> [OPTIONS] [--] [file patterns]...

SUBCOMMANDS:
    init                    Initializes a configuration file in the current directory
    fmt                     Formats the source files and writes the result to the file system
    check                   Checks for any files that haven't been formatted
    config                  Functionality related to the configuration file
    output-file-paths       Prints the resolved file paths for the plugins based on the args and configuration
    output-resolved-config  Prints the resolved configuration for the plugins based on the args and configuration
    output-format-times     Prints the amount of time it takes to format each file. Use this for debugging
    help                    Shows this help message

Use '${Constants.DPRINT} <subcommand> --help' for more information on a specific command.
`)
}

/**
 * Show init command help
 */
export function showInitHelp(): void {
  console.log(`Initializes a configuration file in the current directory.

Usage: dprint init [OPTIONS]

Options:
  -c, --config <config>             Path or url to JSON configuration file. Defaults to dprint.json(c) or .dprint.json(c) in current or ancestor directory when not provided.
      --config-discovery=<BOOLEAN>  Sets the config discovery mode. Set to \`false\` to completely disable.
      --plugins <urls/files>...     List of urls or file paths of plugins to use. This overrides what is specified in the config file.
  -L, --log-level <log-level>       Set log level [default: info] [possible values: debug, info, warn, error, silent]
  -h, --help                        Print help
`)
}

/**
 * Show fmt command help
 */
export function showFmtHelp(): void {
  console.log(
    `Formats the source files and writes the result to the file system.

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
`,
  )
}

/**
 * Show check command help
 */
export function showCheckHelp(): void {
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
`)
}

/**
 * Main help command handler
 * @param options - Command options with optional subcommand
 * @returns Exit code (always 0)
 */
export async function run(
  options: { subcommand?: string } = {},
): Promise<number> {
  const subcommand = options.subcommand

  switch (subcommand) {
    case "init":
      showInitHelp()
      break
    case "fmt":
      showFmtHelp()
      break
    case "check":
      showCheckHelp()
      break
    default:
      showHelp()
      break
  }

  return 0
}
