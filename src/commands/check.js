import { findConfigFile, loadConfig } from "../config.js";
import { findFiles } from "../files.js";
import { formatFile, loadPlugins } from "../formatter.js";

/**
 * Check if files are formatted correctly
 */
export default async function checkCommand(filePatterns = [], options = {}) {
  const cwd = process.cwd();
  const logLevel = options.log_level || "info";
  const shouldLog = (level) => {
    const levels = ["debug", "info", "warn", "error", "silent"];
    const currentLevel = levels.indexOf(logLevel);
    const messageLevel = levels.indexOf(level);
    return messageLevel >= currentLevel;
  };

  // Find config file
  const configPath = findConfigFile(cwd, options);

  if (!configPath) {
    console.error("Error: No dprint.json configuration file found");
    console.error("Run 'dprint-js init' to create one");
    return 1;
  }

  // Load config with option overrides
  const config = loadConfig(configPath, options);
  if (shouldLog("info")) {
    console.log(`Using configuration from: ${configPath}`);
  }

  // Load plugins
  if (shouldLog("info")) {
    console.log("Loading plugins...");
  }
  const loadedPlugins = await loadPlugins(config, cwd);

  if (loadedPlugins.length === 0) {
    console.error("Error: No formatters loaded. Make sure plugins are installed:");
    console.error("  bun install @dprint/typescript @dprint/json @dprint/markdown");
    return 1;
  }

  if (shouldLog("info")) {
    console.log(`Loaded ${loadedPlugins.length} formatter(s)`);
  }

  // Find files with option overrides
  const files = await findFiles(config, filePatterns, cwd, options);

  if (files.length === 0) {
    if (shouldLog("info")) {
      console.log("No files found to check");
    }
    // Exit with 0 if --allow-no-files, otherwise 14
    return options.allow_no_files ? 0 : 14;
  }

  if (shouldLog("info")) {
    console.log(`Checking ${files.length} file(s)...`);
  }

  // Check files
  const unformattedFiles = [];
  let errorCount = 0;

  for (const file of files) {
    const result = await formatFile(file, loadedPlugins, config, true);

    if (result.error) {
      console.error(`Error checking ${file}: ${result.error}`);
      errorCount++;
    } else if (result.formatted) {
      unformattedFiles.push(file);
    }
  }

  if (unformattedFiles.length > 0) {
    if (options.list_different) {
      // Just output file paths, no extra text
      for (const file of unformattedFiles) {
        console.log(file);
      }
    } else {
      // Show full message with formatting info
      if (shouldLog("info")) {
        console.error(`\nThe following ${unformattedFiles.length} file(s) are not formatted:`);
        for (const file of unformattedFiles) {
          console.error(`  ${file}`);
        }
        console.error("\nRun 'dprint-js fmt' to format them");
      }
    }
    // Return exit code 20 to match dprint standard (20 = unformatted files)
    return 20;
  }

  if (errorCount > 0) {
    console.error(`${errorCount} error(s) occurred`);
    return 1;
  }

  if (shouldLog("info")) {
    console.log("All files are formatted correctly!");
  }
  return 0;
}
