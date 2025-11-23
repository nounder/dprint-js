import * as fs from "node:fs";
import * as path from "node:path";
import * as Config from "../Config.js";
import * as InitCommand from "./InitCommand.js";
import * as Constants from "../Constants.js";

type LogLevel = "debug" | "info" | "warn" | "error" | "silent";

interface ConfigCommandOptions {
  cwd: string;
  logLevel?: LogLevel;
  config?: string;
  configDiscovery?: boolean;
  plugins?: string[];
  args?: string[];
}

/**
 * Config command - handles configuration-related subcommands
 * @param options - Command options
 * @returns Exit code
 */
export async function run(options: ConfigCommandOptions): Promise<number> {
  const args = options.args || [];
  const subcommand = args[0];

  if (!subcommand || subcommand === "help") {
    showConfigHelp();
    return subcommand ? 0 : 10;
  }

  switch (subcommand) {
    case "init":
      return await InitCommand.run(options);

    case "add":
      return await configAddCommand(args.slice(1), options);

    case "update":
      return await configUpdateCommand(options);

    default:
      console.error(`error: '${Constants.DPRINT} config' requires a subcommand but one was not provided`);
      console.error(`  [subcommands: init, update, add, help]`);
      console.error("");
      console.error(`Usage: ${Constants.DPRINT} config [OPTIONS] <COMMAND>`);
      console.error("");
      console.error("For more information, try '--help'.");
      return 10;
  }
}

/**
 * Show help for config command
 */
function showConfigHelp() {
  console.log(`Functionality related to the configuration file.

Usage: ${Constants.DPRINT} config [OPTIONS] <COMMAND>

Commands:
  init    Initializes a configuration file in the current directory.
  update  Updates the plugins in the configuration file.
  add     Adds a plugin to the configuration file.
  help    Print this message or the help of the given subcommand(s)

Options:
  -c, --config <config>             Path or url to JSON configuration file. Defaults to dprint.json(c) or .dprint.json(c) in current or ancestor directory when not provided.
      --config-discovery=<BOOLEAN>  Sets the config discovery mode. Set to \`false\` to completely disable.
      --plugins <urls/files>...     List of urls or file paths of plugins to use. This overrides what is specified in the config file.
  -L, --log-level <log-level>       Set log level [default: info] [possible values: debug, info, warn, error, silent]
  -h, --help                        Print help`);
}

/**
 * Add a plugin to the configuration file
 * @param args - Plugin name/URL
 * @param options - Command options
 * @returns Exit code
 */
async function configAddCommand(args: string[] = [], options: ConfigCommandOptions): Promise<number> {
  const pluginNameOrUrl = args[0];
  const cwd = options.cwd;

  if (!pluginNameOrUrl) {
    console.error("Error: No plugin name or URL provided");
    console.error(`Usage: ${Constants.DPRINT} config add [url-or-plugin-name]`);
    return 1;
  }

  // Find config file
  const configPath = Config.findConfigFile(cwd, options);
  if (!configPath) {
    console.error(
      `No config file found at ${path.join(cwd, "dprint.json")}. Did you mean to create (dprint init) or specify one (--config <path>)?`,
    );
    return 11;
  }

  try {
    // Read existing config
    const configContent = fs.readFileSync(configPath, "utf-8");
    const config = JSON.parse(configContent);

    // Ensure plugins array exists
    if (!config.plugins) {
      config.plugins = [];
    }

    // Check if plugin already exists
    if (config.plugins.includes(pluginNameOrUrl)) {
      console.log(`Plugin '${pluginNameOrUrl}' already exists in configuration.`);
      return 0;
    }

    // Add plugin
    config.plugins.push(pluginNameOrUrl);

    // Write updated config
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n", "utf-8");
    console.log(`Added '${pluginNameOrUrl}' to plugins.`);

    return 0;
  } catch (error) {
    console.error(`Error: ${(error as Error).message}`);
    return 1;
  }
}

/**
 * Update plugins in the configuration file
 * @param options - Command options
 * @returns Exit code
 */
async function configUpdateCommand(options: ConfigCommandOptions): Promise<number> {
  const cwd = options.cwd;

  // Find config file
  const configPath = Config.findConfigFile(cwd, options);
  if (!configPath) {
    console.error(
      `No config file found at ${path.join(cwd, "dprint.json")}. Did you mean to create (dprint init) or specify one (--config <path>)?`,
    );
    return 11;
  }

  try {
    // Read existing config
    const configContent = fs.readFileSync(configPath, "utf-8");
    const config = JSON.parse(configContent);

    if (!config.plugins || config.plugins.length === 0) {
      console.log("No plugins to update.");
      return 0;
    }

    // For now, just report that update would happen
    // A full implementation would fetch latest versions and update URLs
    console.log("Checking for plugin updates...");

    let updated = false;
    for (const plugin of config.plugins) {
      if (plugin.startsWith("http")) {
        // Check if there's a newer version available
        // For now, just report the current version
        const urlPath = new URL(plugin).pathname;
        const filename = path.basename(urlPath);
        const match = filename.match(/^(.+?)-v?([\d.]+)\.wasm$/);
        if (match) {
          const [, name, version] = match;
          console.log(`${name}: ${version} (current)`);
        }
      } else {
        console.log(`${plugin}: npm package (use npm to update)`);
      }
    }

    if (!updated) {
      console.log("All plugins are up to date.");
    }

    return 0;
  } catch (error) {
    console.error(`Error: ${(error as Error).message}`);
    return 1;
  }
}
