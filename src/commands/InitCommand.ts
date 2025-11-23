import * as fs from "node:fs";
import * as path from "node:path";
import * as Config from "../Config.js";
import * as Logger from "../Logger.js";

/**
 * Initialize a new dprint.json configuration file
 */
export async function run(options: {
  cwd: string;
  config?: string;
  plugins?: string[];
  logLevel?: Logger.LogLevel;
}): Promise<number> {
  const cwd = options.cwd;
  const logLevel = options.logLevel || "info";

  // Use custom config path if provided, otherwise use dprint.json in current directory
  const configPath = options.config ? path.join(cwd, options.config) : path.join(cwd, "dprint.json");

  if (fs.existsSync(configPath)) {
    if (Logger.shouldLog(logLevel, "error")) {
      console.error(`Configuration file '${path.basename(configPath)}' already exists in the current directory.`);
    }
    return 1;
  }

  // Get default config
  const config = Config.getDefaultConfig();

  // Override plugins if provided via --plugins
  if (options.plugins && options.plugins.length > 0) {
    config.plugins = options.plugins;
  }

  const configJson = JSON.stringify(config, null, 2);

  try {
    fs.writeFileSync(configPath, configJson, "utf-8");
    if (Logger.shouldLog(logLevel, "info")) {
      console.log(`Created ${path.basename(configPath)}`);
    }
    return 0;
  } catch (error) {
    if (Logger.shouldLog(logLevel, "error")) {
      console.error(`Error: Failed to create config file: ${(error as Error).message}`);
    }
    return 1;
  }
}
