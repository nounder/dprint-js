import fg from "fast-glob";
import { minimatch } from "minimatch";
import * as path from "node:path";

/**
 * Find files matching the patterns specified in the configuration
 * @param {object} config - The dprint configuration object
 * @param {string[]} additionalPatterns - Additional file patterns from command line
 * @param {string} cwd - Current working directory
 * @returns {Promise<string[]>} Array of matching file paths
 */
export async function findFiles(config, additionalPatterns = [], cwd = process.cwd()) {
  const includes = config.includes || ["**/*"];
  const excludes = config.excludes || [];

  // Combine config includes with command-line patterns
  const patterns = additionalPatterns.length > 0 ? additionalPatterns : includes;

  // Use fast-glob to find files
  const files = await fg(patterns, {
    cwd,
    ignore: excludes,
    dot: false,
    absolute: false,
    onlyFiles: true,
  });

  return files.sort();
}

/**
 * Check if a file matches the include/exclude patterns
 * @param {string} filePath - The file path to check
 * @param {object} config - The dprint configuration object
 * @returns {boolean} True if the file should be processed
 */
export function shouldProcessFile(filePath, config) {
  const includes = config.includes || ["**/*"];
  const excludes = config.excludes || [];

  // Check excludes first
  for (const pattern of excludes) {
    if (minimatch(filePath, pattern, { dot: true })) {
      return false;
    }
  }

  // Check includes
  for (const pattern of includes) {
    if (minimatch(filePath, pattern, { dot: true })) {
      return true;
    }
  }

  return false;
}

/**
 * Get the file extension
 */
export function getFileExtension(filePath) {
  return path.extname(filePath).slice(1);
}
