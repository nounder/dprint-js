/**
 * Glob pattern utilities for consistent pattern matching across fast-glob and minimatch
 *
 * This module provides normalization functions to ensure glob patterns work consistently
 * regardless of the underlying library being used.
 */

import { Glob } from "bun";

/**
 * Normalize exclude patterns for glob matching
 *
 * Converts directory patterns to match the entire directory and its contents.
 * This is needed because both fast-glob and minimatch don't automatically match
 * directory contents with bare directory names.
 *
 * Examples:
 *   "tree/" → "tree/**"   (directory with trailing slash)
 *   "tree"  → "tree/**"   (bare directory name)
 *   "*.ts"  → "*.ts"      (file pattern, unchanged)
 *   "**\/node_modules\/**" → "**\/node_modules\/**" (glob pattern, unchanged)
 *
 * @param {string[]} patterns - Array of exclude glob patterns
 * @returns {string[]} Normalized patterns
 */
export function normalizeExcludePatterns(patterns) {
  return patterns.map((pattern) => {
    // Directory with trailing slash: "dir/" → "dir/**"
    // Excludes the directory and all its contents
    if (pattern.endsWith("/")) {
      return pattern.slice(0, -1) + "/**";
    }

    // Pattern already ending with /** is normalized
    if (pattern.endsWith("/**")) {
      return pattern;
    }

    // Bare directory name: "dir" → "dir/**"
    // Directory pattern without trailing **: "**/node_modules" → "**/node_modules/**"
    // Only normalize if it doesn't look like a file pattern (no extension)
    if (!pattern.includes(".") && !pattern.endsWith("*")) {
      return pattern + "/**";
    }

    // Already a proper glob pattern, leave unchanged
    // Examples: "*.test.ts", "**/*.ts", "**/*"
    return pattern;
  });
}

/**
 * Normalize include patterns for glob matching
 *
 * Include patterns are NOT normalized like exclude patterns.
 * This matches original dprint behavior where:
 *   - EXCLUDES: "tree/" and "tree" both exclude directory and contents
 *   - INCLUDES: "src/" and "src" find NO files (you must use explicit patterns like "src/**")
 *
 * Users must explicitly specify patterns like "src/**" to include directory contents.
 *
 * @param {string[]} patterns - Array of include glob patterns
 * @returns {string[]} Normalized patterns (typically unchanged)
 */
export function normalizeIncludePatterns(patterns) {
  // Include patterns are passed through unchanged to match original dprint behavior
  // Users must explicitly use patterns like "**/*.ts" or "src/**"
  return patterns;
}

/**
 * Normalize glob pattern based on its purpose
 *
 * @param {string} pattern - Glob pattern to normalize
 * @param {'include'|'exclude'} type - Whether this is an include or exclude pattern
 * @returns {string} Normalized pattern
 */
export function normalizePattern(pattern, type = "exclude") {
  if (type === "exclude") {
    return normalizeExcludePatterns([pattern])[0];
  } else {
    return normalizeIncludePatterns([pattern])[0];
  }
}

/**
 * Find files matching include patterns while excluding specified patterns
 *
 * @param {string[]} includePatterns - Array of glob patterns to include
 * @param {string[]} excludePatterns - Array of glob patterns to exclude (normalized)
 * @param {string} cwd - Current working directory
 * @returns {string[]} Array of matching file paths
 */
export function findMatchingFiles(includePatterns, excludePatterns, cwd) {
  // Determine if we need to scan dot files
  // If any include pattern explicitly references dot files/directories, enable dot scanning
  const needsDotFiles = includePatterns.some((pattern) => pattern.startsWith(".") || pattern.includes("/."));

  const allFiles = new Set();
  const excludeGlobs = excludePatterns.map((pattern) => new Glob(pattern));

  for (const pattern of includePatterns) {
    const glob = new Glob(pattern);

    try {
      const iterator = glob.scanSync({
        cwd,
        dot: needsDotFiles,
        absolute: false,
        onlyFiles: true,
        followSymlinks: false, // Prevent following symlinks to avoid circular references
      });

      // Process each file from the iterator
      for (const file of iterator) {
        // Security: Filter out paths that escape cwd (Bun glob bug defense)
        // https://github.com/oven-sh/bun/issues/24936
        // Paths starting with ../ or containing /../ are outside the working directory
        if (file.startsWith("../") || file.includes("/../")) {
          continue;
        }

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
    } catch (error) {
      // Skip patterns that cause filesystem errors
      // ENAMETOOLONG: filename too long (from circular symlinks)
      // ELOOP: too many symlink levels
      // EPERM: permission denied
      if (error.code === "ENAMETOOLONG" || error.code === "ELOOP" || error.code === "EPERM") {
        console.warn(`Warning: Skipping pattern '${pattern}' due to filesystem error: ${error.message}`);
        continue;
      }
      throw error;
    }
  }

  return Array.from(allFiles);
}
