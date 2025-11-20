import { Glob } from "bun";
import * as path from "node:path";
import { normalizeExcludePatterns, normalizeIncludePatterns } from "./glob.js";

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

  // Normalize exclude patterns
  const normalizedExcludes = normalizeExcludePatterns(excludes);

  // Determine if we need to scan dot files
  // If any include pattern explicitly references dot files/directories, enable dot scanning
  const needsDotFiles = includes.some((pattern) =>
    pattern.startsWith(".") || pattern.includes("/.")
  );

  // Use Bun.Glob to find files
  const allFiles = new Set();
  const excludeGlobs = normalizedExcludes.map((pattern) => new Glob(pattern));

  for (const pattern of includes) {
    const glob = new Glob(pattern);
    const iterator = glob.scanSync({
      cwd,
      dot: needsDotFiles,
      absolute: false,
      onlyFiles: true,
    });

    // Process each file from the iterator
    for (const file of iterator) {
      // Check if file matches any exclude pattern
      let shouldExclude = false;
      for (const excludeGlob of excludeGlobs) {
        if (excludeGlob.match(file)) {
          shouldExclude = true;
          break;
        }
      }

      if (!shouldExclude) {
        allFiles.add(file);
      }
    }
  }

  return Array.from(allFiles).sort();
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
    const glob = new Glob(pattern);
    if (glob.match(filePath)) {
      return false;
    }
  }

  // Check includes (not normalized - users must use explicit patterns)
  for (const pattern of includes) {
    const glob = new Glob(pattern);
    if (glob.match(filePath)) {
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
