/**
 * Glob pattern utilities for consistent pattern matching across fast-glob and minimatch
 *
 * This module provides normalization functions to ensure glob patterns work consistently
 * regardless of the underlying library being used.
 */

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

    // Bare directory name: "dir" → "dir/**"
    // Only normalize if it doesn't already have wildcards or look like a file pattern
    if (!pattern.includes("**") && !pattern.includes(".") && !pattern.includes("*")) {
      return pattern + "/**";
    }

    // Already a proper glob pattern, leave unchanged
    // Examples: "*.test.ts", "**/*.ts", "**/node_modules/**"
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
