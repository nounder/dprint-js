import * as fs from "node:fs";
import * as path from "node:path";
import { getDefaultConfig } from "../config.js";

/**
 * Initialize a new dprint.json configuration file
 */
export default async function initCommand(options = {}) {
  // Use custom config path if provided, otherwise use dprint.json in current directory
  const configPath = options.config || path.join(process.cwd(), "dprint.json");

  if (fs.existsSync(configPath)) {
    console.error(`Configuration file '${path.basename(configPath)}' already exists in the current directory.`);
    return 1;
  }

  // Get default config
  const config = getDefaultConfig();

  // Override plugins if provided via --plugins
  if (options.plugins && options.plugins.length > 0) {
    config.plugins = options.plugins;
  }

  const configJson = JSON.stringify(config, null, 2);

  try {
    fs.writeFileSync(configPath, configJson, "utf-8");
    console.log(`Created ${path.basename(configPath)}`);
    return 0;
  } catch (error) {
    console.error(`Error: Failed to create config file: ${error.message}`);
    return 1;
  }
}
