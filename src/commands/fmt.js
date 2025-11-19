import { loadConfig } from "../config.js";
import { findFiles } from "../files.js";
import { loadPlugins, formatFile, writeFormattedFile } from "../formatter.js";

/**
 * Format source files and write the result to the file system.
 * @param {string[]} filePatterns - File patterns from CLI arguments
 * @param {object} options - Command options
 * @returns {Promise<void>}
 */
export async function fmt(filePatterns = [], options = {}) {
  try {
    // Load configuration
    const config = loadConfig(options.config);
    console.log(`Using config: ${config.configPath}`);

    // Load plugins
    console.log("\nLoading plugins...");
    const plugins = await loadPlugins(config);

    if (plugins.length === 0) {
      console.error("Error: No plugins loaded. Cannot format files.");
      process.exit(1);
    }

    // Find files to format
    console.log("\nFinding files...");
    const files = await findFiles(config, filePatterns);

    if (files.length === 0) {
      console.log("No files found to format.");
      return;
    }

    console.log(`Found ${files.length} file(s)\n`);

    // Format each file
    let formattedCount = 0;
    let errorCount = 0;
    let skippedCount = 0;

    for (const filePath of files) {
      try {
        const result = formatFile(filePath, plugins);

        if (!result.formatted) {
          if (result.reason === "no-formatter") {
            // Skip files with no formatter
            skippedCount++;
          } else {
            console.error(`Error formatting ${filePath}: ${result.error}`);
            errorCount++;
          }
          continue;
        }

        if (result.changed) {
          // Write the formatted content back to the file
          writeFormattedFile(filePath, result.content);
          console.log(`Formatted ${filePath}`);
          formattedCount++;
        }
      } catch (error) {
        console.error(`Error formatting ${filePath}: ${error.message}`);
        errorCount++;
      }
    }

    // Print summary
    console.log(`\nFormatted ${formattedCount} file(s)`);
    if (skippedCount > 0) {
      console.log(`Skipped ${skippedCount} file(s) (no formatter)`);
    }
    if (errorCount > 0) {
      console.log(`Failed to format ${errorCount} file(s)`);
      process.exit(1);
    }
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}
