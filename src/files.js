import fg from "fast-glob";
import { minimatch } from "minimatch";
import * as path from "node:path";
import { normalizeExcludePatterns, normalizeIncludePatterns } from "./glob.js";
import { loadGitignorePatterns, filterWithGitignore } from "./gitignore.js";

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
  if (options.includesOverride && options.includesOverride.length > 0) {
    // --includes-override completely replaces config includes
    includes = options.includesOverride;
  } else if (additionalPatterns.length > 0) {
    // Command line patterns subset config includes
    includes = additionalPatterns;
  } else {
    // Use config includes
    includes = config.includes || ["**/*"];
  }

  // Determine excludes patterns
  let excludes;
  if (options.excludesOverride && options.excludesOverride.length > 0) {
    // --excludes-override completely replaces config excludes
    excludes = options.excludesOverride;
  } else {
    // Start with config excludes
    excludes = config.excludes || [];
    // Add additional excludes from --excludes
    if (options.excludes && options.excludes.length > 0) {
      excludes = [...excludes, ...options.excludes];
    }
  }

  // Add node_modules to excludes unless --allow-node-modules is set
  if (!options.allowNodeModules && !excludes.includes("**/node_modules")) {
    excludes = [...excludes, "**/node_modules"];
  }

  // Normalize exclude patterns for fast-glob compatibility
  const normalizedExcludes = normalizeExcludePatterns(excludes);

  // Use fast-glob to find files
  let files = await fg(includes, {
    cwd,
    ignore: normalizedExcludes,
    dot: false,
    absolute: false,
    onlyFiles: true,
  });

  // Apply .gitignore patterns unless disabled
  if (!options.allowGitignored) {
    const ig = loadGitignorePatterns(cwd);
    if (ig) {
      files = filterWithGitignore(files, ig, cwd);
    }
  }

  return files.sort();
}

/**
 * Check if a file matches the include/exclude patterns
 * @param {string} filePath - The file path to check
 * @param {object} config - The dprint configuration object
 * @returns {boolean} True if the file should be processed
 */
export function shouldProcessFile(filePath, config) {
  const includes = normalizeIncludePatterns(config.includes || ["**/*"]);
  const excludes = normalizeExcludePatterns(config.excludes || []);

  // Check excludes first (normalized to match directory contents)
  for (const pattern of excludes) {
    if (minimatch(filePath, pattern, { dot: true })) {
      return false;
    }
  }

  // Check includes (not normalized - users must use explicit patterns)
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
