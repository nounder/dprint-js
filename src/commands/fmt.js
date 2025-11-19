import { findConfigFile, loadConfig } from "../config.js";
import { findFiles } from "../files.js";
import { loadPlugins, formatFile } from "../formatter.js";

/**
 * Format files according to configuration
 */
export default async function fmtCommand(filePatterns = [], options = {}) {
  const cwd = process.cwd();
  const configPath = findConfigFile(cwd);

  if (!configPath) {
    console.error("Error: No dprint.json configuration file found");
    console.error("Run 'dprint-js init' to create one");
    return 1;
  }

  const config = loadConfig(configPath);
  console.log(`Using configuration from: ${configPath}`);

  // Load plugins
  console.log("Loading plugins...");
  const loadedPlugins = await loadPlugins(config, cwd);

  if (loadedPlugins.length === 0) {
    console.error("Error: No formatters loaded. Make sure plugins are installed:");
    console.error("  bun install @dprint/typescript @dprint/json @dprint/markdown");
    return 1;
  }

  console.log(`Loaded ${loadedPlugins.length} formatter(s)`);

  // Find files
  const files = await findFiles(config, filePatterns, cwd);

  if (files.length === 0) {
    console.log("No files found to format");
    return 0;
  }

  console.log(`Found ${files.length} file(s) to format`);

  // Format files
  let formattedCount = 0;
  let errorCount = 0;

  for (const file of files) {
    const result = await formatFile(file, loadedPlugins, config, false);

    if (result.error) {
      console.error(`Error formatting ${file}: ${result.error}`);
      errorCount++;
    } else if (result.formatted) {
      console.log(`Formatted ${file}`);
      formattedCount++;
    }
  }

  console.log(`\nFormatted ${formattedCount} file(s)`);

  if (errorCount > 0) {
    console.error(`${errorCount} error(s) occurred`);
    return 1;
  }

  return 0;
}
