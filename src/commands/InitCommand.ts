import * as fs from "node:fs";
import * as path from "node:path";
import * as Config from "../Config.js";

interface InitCommandOptions {
  cwd: string;
  config?: string;
  plugins?: string[];
  logLevel?: "debug" | "info" | "warn" | "error" | "silent";
}

type LogLevel = "debug" | "info" | "warn" | "error" | "silent";

/**
 * Initialize a new dprint.json configuration file
 */
export async function run(options: InitCommandOptions): Promise<number> {
  const cwd = options.cwd;
  const logLevel = options.logLevel || "info";
  const shouldLog = (level: LogLevel): boolean => {
    const levels: LogLevel[] = ["debug", "info", "warn", "error", "silent"];
    const currentLevel = levels.indexOf(logLevel);
    const messageLevel = levels.indexOf(level);
    return messageLevel >= currentLevel;
  };

  // Use custom config path if provided, otherwise use dprint.json in current directory
  const configPath = options.config ? path.join(cwd, options.config) : path.join(cwd, "dprint.json");

  if (fs.existsSync(configPath)) {
    if (shouldLog("error")) {
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
    if (shouldLog("info")) {
      console.log(`Created ${path.basename(configPath)}`);
    }
    return 0;
  } catch (error) {
    if (shouldLog("error")) {
      console.error(`Error: Failed to create config file: ${(error as Error).message}`);
    }
    return 1;
  }
}
