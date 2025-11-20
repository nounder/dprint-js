import fg from "fast-glob";
import { minimatch } from "minimatch";
import * as path from "node:path";

/**
 * Normalize exclude patterns for fast-glob compatibility
 * Converts patterns like "dir/" to "dir/**" to properly exclude directories
 * @param {string[]} patterns - Array of glob patterns
 * @returns {string[]} Normalized patterns
 */
function normalizeExcludePatterns(patterns) {
  return patterns.map((pattern) => {
    // If pattern ends with /, it's a directory exclusion
    // Convert "dir/" to "dir/**" to exclude the directory and all contents
    if (pattern.endsWith("/")) {
      return pattern.slice(0, -1) + "/**";
    }
    // If pattern doesn't contain ** and doesn't end with an extension,
    // it might be a directory name, add /** to exclude directory contents
    if (!pattern.includes("**") && !pattern.includes(".") && !pattern.includes("*")) {
      return pattern + "/**";
    }
    return pattern;
  });
}

/**
 * Find files matching the patterns specified in the configuration
 * @param {object} config - The dprint configuration object
 * @param {string[]} additionalPatterns - Additional file patterns from command line
 * @param {string} cwd - Current working directory
 * @param {object} options - Additional options for file finding
 * @returns {Promise<string[]>} Array of matching file paths
 */
export async function findFiles(config, additionalPatterns = [], cwd = process.cwd(), options = {}) {
  // Determine includes patterns
  let includes;
  if (options.includes_override && options.includes_override.length > 0) {
    // --includes-override completely replaces config includes
    includes = options.includes_override;
  } else if (additionalPatterns.length > 0) {
    // Command line patterns subset config includes
    includes = additionalPatterns;
  } else {
    // Use config includes
    includes = config.includes || ["**/*"];
  }

  // Determine excludes patterns
  let excludes;
  if (options.excludes_override && options.excludes_override.length > 0) {
    // --excludes-override completely replaces config excludes
    excludes = options.excludes_override;
  } else {
    // Start with config excludes
    excludes = config.excludes || [];
    // Add additional excludes from --excludes
    if (options.excludes && options.excludes.length > 0) {
      excludes = [...excludes, ...options.excludes];
    }
  }

  // Add node_modules to excludes unless --allow-node-modules is set
  if (!options.allow_node_modules && !excludes.includes("**/node_modules")) {
    excludes = [...excludes, "**/node_modules"];
  }

  // Normalize exclude patterns for fast-glob compatibility
  const normalizedExcludes = normalizeExcludePatterns(excludes);

  // Use fast-glob to find files
  const files = await fg(includes, {
    cwd,
    ignore: normalizedExcludes,
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
