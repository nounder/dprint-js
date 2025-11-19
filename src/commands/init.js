import { createDefaultConfig, findConfigFile } from "../config.js";
import * as fs from "node:fs";

/**
 * Initialize a dprint configuration file in the current directory.
 * @param {object} options - Command options
 * @returns {Promise<void>}
 */
export async function init(options = {}) {
  const outputPath = options.output || "dprint.json";

  // Check if config already exists
  const existingConfig = findConfigFile();
  if (existingConfig) {
    console.error(`Error: Configuration file already exists at ${existingConfig}`);
    console.error("Remove it first or use a different output path with --output");
    process.exit(1);
  }

  try {
    const configPath = createDefaultConfig(outputPath);
    console.log(`Created ${configPath}`);
    console.log("\nNext steps:");
    console.log("1. Review and customize the configuration");
    console.log("2. Install the formatter plugins:");
    console.log("   npm install --save-dev @dprint/typescript @dprint/json @dprint/markdown");
    console.log("3. Run 'dprint-js fmt' to format your code");
  } catch (error) {
    console.error(`Error: Failed to create configuration: ${error.message}`);
    process.exit(1);
  }
}
