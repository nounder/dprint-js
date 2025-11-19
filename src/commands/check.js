import { loadConfig } from "../config.js";
import { findFiles } from "../files.js";
import { loadPlugins, formatFile } from "../formatter.js";

/**
 * Check for any files that haven't been formatted.
 * @param {string[]} filePatterns - File patterns from CLI arguments
 * @param {object} options - Command options
 * @returns {Promise<void>}
 */
export async function check(filePatterns = [], options = {}) {
  try {
    // Load configuration
    const config = loadConfig(options.config);
    console.log(`Using config: ${config.configPath}`);

    // Load plugins
    console.log("\nLoading plugins...");
    const plugins = await loadPlugins(config);

    if (plugins.length === 0) {
      console.error("Error: No plugins loaded. Cannot check files.");
      process.exit(1);
    }

    // Find files to check
    console.log("\nFinding files...");
    const files = await findFiles(config, filePatterns);

    if (files.length === 0) {
      console.log("No files found to check.");
      return;
    }

    console.log(`Found ${files.length} file(s)\n`);

    // Check each file
    const unformattedFiles = [];
    let errorCount = 0;
    let skippedCount = 0;
    let checkedCount = 0;

    for (const filePath of files) {
      try {
        const result = formatFile(filePath, plugins);

        if (!result.formatted) {
          if (result.reason === "no-formatter") {
            // Skip files with no formatter
            skippedCount++;
          } else {
            console.error(`Error checking ${filePath}: ${result.error}`);
            errorCount++;
          }
          continue;
        }

        checkedCount++;

        if (result.changed) {
          unformattedFiles.push(filePath);
          console.log(`Not formatted: ${filePath}`);
        }
      } catch (error) {
        console.error(`Error checking ${filePath}: ${error.message}`);
        errorCount++;
      }
    }

    // Print summary
    console.log(`\nChecked ${checkedCount} file(s)`);
    if (skippedCount > 0) {
      console.log(`Skipped ${skippedCount} file(s) (no formatter)`);
    }

    if (unformattedFiles.length > 0) {
      console.log(`\nFound ${unformattedFiles.length} unformatted file(s):`);
      unformattedFiles.forEach((file) => console.log(`  - ${file}`));
      console.log("\nRun 'dprint-js fmt' to format these files.");
      process.exit(1);
    } else if (errorCount > 0) {
      console.log(`\nFailed to check ${errorCount} file(s)`);
      process.exit(1);
    } else {
      console.log("\nAll files are formatted! ✓");
    }
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}
