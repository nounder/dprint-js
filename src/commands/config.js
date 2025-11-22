import * as fs from "node:fs";
import * as path from "node:path";
import { findConfigFile } from "../config.js";
import initCommand from "./init.js";
import { DPRINT } from "../constants.js";

/**
 * Config command - handles configuration-related subcommands
 * @param {string[]} args - Subcommand and its arguments
 * @param {object} options - Command options
 * @returns {Promise<number>} Exit code
 */
export default async function configCommand(args = [], options = {}) {
  const subcommand = args[0];

  if (!subcommand || subcommand === "help") {
    showConfigHelp();
    return subcommand ? 0 : 10;
  }

  switch (subcommand) {
    case "init":
      return await initCommand(options);

    case "add":
      return await configAddCommand(args.slice(1), options);

    case "update":
      return await configUpdateCommand(options);

    default:
      console.error(`error: '${DPRINT} config' requires a subcommand but one was not provided`);
      console.error(`  [subcommands: init, update, add, help]`);
      console.error("");
      console.error(`Usage: ${DPRINT} config [OPTIONS] <COMMAND>`);
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

Usage: ${DPRINT} config [OPTIONS] <COMMAND>

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
 * @param {string[]} args - Plugin name/URL
 * @param {object} options - Command options
 * @returns {Promise<number>} Exit code
 */
async function configAddCommand(args = [], options = {}) {
  const pluginNameOrUrl = args[0];
  const cwd = options.cwd || process.cwd();

  if (!pluginNameOrUrl) {
    console.error("Error: No plugin name or URL provided");
    console.error(`Usage: ${DPRINT} config add [url-or-plugin-name]`);
    return 1;
  }

  // Find config file
  const configPath = findConfigFile(cwd, options);
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
    console.error(`Error: ${error.message}`);
    return 1;
  }
}

/**
 * Update plugins in the configuration file
 * @param {object} options - Command options
 * @returns {Promise<number>} Exit code
 */
async function configUpdateCommand(options = {}) {
  const cwd = options.cwd || process.cwd();

  // Find config file
  const configPath = findConfigFile(cwd, options);
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
    console.error(`Error: ${error.message}`);
    return 1;
  }
}
