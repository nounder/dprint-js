import * as path from "node:path";
import { findConfigFile, loadConfig } from "../config.js";
import { findFiles } from "../files.js";

/**
 * Output the resolved file paths based on configuration and arguments
 * @param {string[]} patterns - Additional file patterns from command line
 * @param {object} options - Command options
 * @returns {Promise<number>} Exit code (0 for success, 11 for config error, 13 for plugin error, 14 for no files)
 */
export default async function outputFilePathsCommand(patterns = [], options = {}) {
  const cwd = options.cwd || process.cwd();
  const logLevel = options.logLevel || "info";
  const shouldLog = (level) => {
    const levels = ["debug", "info", "warn", "error", "silent"];
    const currentLevel = levels.indexOf(logLevel);
    const messageLevel = levels.indexOf(level);
    return messageLevel >= currentLevel;
  };

  // 1. Find config file
  const configPath = findConfigFile(cwd, options);
  if (!configPath) {
    if (shouldLog("error")) {
      console.error(
        `No config file found at ${path.join(cwd, "dprint.json")}. Did you mean to create (dprint init) or specify one (--config <path>)?`,
      );
    }
    return 11;
  }

  // 2. Load config
  let config;
  try {
    config = loadConfig(configPath, options);
  } catch (error) {
    if (shouldLog("error")) {
      console.error(`Error: ${error.message}`);
    }
    return 11;
  }

  // 3. Find files
  try {
    const files = await findFiles(config, patterns, cwd, options);

    // Output absolute paths (only if not silent log level)
    if (shouldLog("info")) {
      for (const file of files) {
        const absolutePath = path.isAbsolute(file) ? file : path.join(cwd, file);
        console.log(absolutePath);
      }
    }

    return 0;
  } catch (error) {
    if (shouldLog("error")) {
      console.error(`Error: ${error.message}`);
    }
    return 1;
  }
}
