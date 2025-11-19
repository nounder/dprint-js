import { globby } from "globby";
import * as path from "node:path";

/**
 * Find files based on configuration and additional patterns.
 * @param {object} config - The dprint configuration object
 * @param {string[]} additionalPatterns - Additional file patterns from CLI arguments
 * @returns {Promise<string[]>} - Array of file paths to process
 */
export async function findFiles(config, additionalPatterns = []) {
  const baseDir = config.configDir || process.cwd();

  // Determine patterns to use
  let includePatterns;
  if (additionalPatterns && additionalPatterns.length > 0) {
    // If patterns are provided via CLI, use them
    includePatterns = additionalPatterns;
  } else {
    // Otherwise use includes from config
    includePatterns = config.includes || ["**/*"];
  }

  // Always use excludes from config
  const excludePatterns = config.excludes || [];

  try {
    const files = await globby(includePatterns, {
      cwd: baseDir,
      ignore: excludePatterns,
      absolute: true,
      gitignore: true,
      dot: false
    });

    return files.sort();
  } catch (error) {
    throw new Error(`Failed to find files: ${error.message}`);
  }
}

/**
 * Get the file extension from a file path.
 * @param {string} filePath - The file path
 * @returns {string} - The file extension (e.g., ".ts", ".json")
 */
export function getFileExtension(filePath) {
  return path.extname(filePath);
}

/**
 * Determine if a file should be formatted based on its extension.
 * @param {string} filePath - The file path
 * @param {object[]} formatters - Array of formatter objects with supportedExtensions
 * @returns {boolean} - True if the file should be formatted
 */
export function shouldFormatFile(filePath, formatters) {
  const ext = getFileExtension(filePath);

  for (const formatter of formatters) {
    if (formatter.supportedExtensions && formatter.supportedExtensions.includes(ext)) {
      return true;
    }
  }

  return false;
}
