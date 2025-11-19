import { findConfigFile, loadConfig } from "../config.js";
import { findFiles } from "../files.js";
import { loadPlugins, formatFile } from "../formatter.js";

/**
 * Check if files are formatted correctly
 */
export default async function checkCommand(filePatterns = [], options = {}) {
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
    console.log("No files found to check");
    return 0;
  }

  console.log(`Checking ${files.length} file(s)...`);

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
    console.error(`\nThe following ${unformattedFiles.length} file(s) are not formatted:`);
    for (const file of unformattedFiles) {
      console.error(`  ${file}`);
    }
    console.error("\nRun 'dprint-js fmt' to format them");
    return 1;
  }

  if (errorCount > 0) {
    console.error(`${errorCount} error(s) occurred`);
    return 1;
  }

  console.log("All files are formatted correctly!");
  return 0;
}
