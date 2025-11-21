import { Glob } from "bun";
import * as path from "node:path";
import * as fs from "node:fs";
import { normalizeExcludePatterns, normalizeIncludePatterns } from "./glob.js";
import ignore from "./gitignore.js";

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

  // Normalize exclude patterns
  const normalizedExcludes = normalizeExcludePatterns(excludes);

  // Determine if we need to scan dot files
  // If any include pattern explicitly references dot files/directories, enable dot scanning
  const needsDotFiles = includes.some((pattern) => pattern.startsWith(".") || pattern.includes("/."));

  // Use Bun.Glob to find files
  const allFiles = new Set();
  const excludeGlobs = normalizedExcludes.map((pattern) => new Glob(pattern));

  for (const pattern of includes) {
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
      // Skip patterns that cause filesystem errors (e.g., ENAMETOOLONG from circular symlinks)
      if (error.code === 'ENAMETOOLONG' || error.code === 'ELOOP') {
        console.error(`Warning: Skipping pattern '${pattern}' due to filesystem error: ${error.message}`);
        continue;
      }
      throw error;
    }
  }

  let files = Array.from(allFiles);

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

/**
 * Create an ignore instance from .gitignore files
 * Searches for all .gitignore files in the git repository
 * @param {string} cwd - Current working directory
 * @returns {Object|null} ignore instance or null if no .gitignore files found
 */
export function loadGitignorePatterns(cwd = process.cwd()) {
  const gitRoot = findGitRoot(cwd);
  if (!gitRoot) {
    return null;
  }

  const ig = ignore();
  let foundAny = false;

  // Find all .gitignore files in the repository
  const gitignorePaths = findAllGitignoreFiles(gitRoot);

  for (const gitignorePath of gitignorePaths) {
    try {
      const content = fs.readFileSync(gitignorePath, "utf-8");
      // Calculate relative path for proper pattern resolution
      const relativeDir = path.relative(gitRoot, path.dirname(gitignorePath));

      // Parse and add patterns
      const patterns = parseGitignoreContent(content, relativeDir);
      if (patterns.length > 0) {
        ig.add(patterns);
        foundAny = true;
      }
    } catch (error) {
      // Silently skip unreadable .gitignore files
      continue;
    }
  }

  return foundAny ? ig : null;
}

/**
 * Find the git root directory by looking for .git directory
 * Looks for .git starting from startDir and walking up
 * @param {string} startDir - Directory to start searching from
 * @returns {string|null} Path to git root or null if not in a git repository
 */
function findGitRoot(startDir) {
  // First check if startDir itself has a .git directory
  const gitDirInStart = path.join(startDir, ".git");
  if (fs.existsSync(gitDirInStart)) {
    return startDir;
  }

  let currentDir = path.dirname(startDir);

  while (true) {
    const gitDir = path.join(currentDir, ".git");
    if (fs.existsSync(gitDir)) {
      return currentDir;
    }

    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      // Reached root directory
      return null;
    }
    currentDir = parentDir;
  }
}

/**
 * Find all .gitignore files in the git repository
 * Uses recursive directory traversal to find all .gitignore files
 * @param {string} gitRoot - Git root directory
 * @returns {string[]} Array of .gitignore file paths
 */
function findAllGitignoreFiles(gitRoot) {
  const gitignoreFiles = [];

  function traverse(dir) {
    try {
      const gitignorePath = path.join(dir, ".gitignore");
      if (fs.existsSync(gitignorePath)) {
        gitignoreFiles.push(gitignorePath);
      }

      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory() && entry.name !== ".git" && entry.name !== "node_modules") {
          traverse(path.join(dir, entry.name));
        }
      }
    } catch (error) {
      // Skip unreadable directories
      return;
    }
  }

  traverse(gitRoot);
  return gitignoreFiles.sort(); // Sort to ensure consistent order
}

/**
 * Parse .gitignore content and return array of patterns
 * @param {string} content - Content of .gitignore file
 * @param {string} relativeDir - Relative directory path from git root
 * @returns {string[]} Array of patterns
 */
function parseGitignoreContent(content, relativeDir = "") {
  const lines = content.split(/\r?\n/);
  const patterns = [];

  for (let line of lines) {
    // Remove trailing whitespace
    line = line.trimEnd();

    // Skip empty lines and comments
    if (!line || line.startsWith("#")) {
      continue;
    }

    // Normalize the pattern(s) for the relative directory
    const normalizedPatterns = normalizePatternForDirectory(line, relativeDir);
    patterns.push(...normalizedPatterns);
  }

  return patterns;
}

/**
 * Normalize a gitignore pattern for a specific directory
 * @param {string} pattern - The pattern from .gitignore
 * @param {string} relativeDir - Relative directory path from git root
 * @returns {string[]} Array of normalized patterns (usually 1, sometimes 2)
 */
function normalizePatternForDirectory(pattern, relativeDir) {
  if (!relativeDir) {
    return [pattern];
  }

  // Normalize relative directory to use forward slashes
  const normalizedDir = relativeDir.replace(/\\/g, "/");

  // Handle negation patterns
  const isNegation = pattern.startsWith("!");
  const cleanPattern = isNegation ? pattern.slice(1) : pattern;

  // Handle root-anchored patterns (starting with /)
  if (cleanPattern.startsWith("/")) {
    // Root-anchored pattern in subdirectory should be anchored to that subdirectory
    // /temp in src/.gitignore becomes src/temp
    const result = normalizedDir + cleanPattern;
    return [isNegation ? "!" + result : result];
  }

  // Non-root-anchored patterns need special handling
  // A pattern like "temp" in src/.gitignore should match:
  // - src/temp
  // - src/foo/temp
  // - src/foo/bar/temp
  if (cleanPattern.includes("/")) {
    // Pattern already has a slash, so it's a path pattern
    // Just prefix with directory
    const result = normalizedDir + "/" + cleanPattern;
    return [isNegation ? "!" + result : result];
  } else {
    // Pattern without slash - should match anywhere in the subtree
    // We need to add it twice: once for the directory itself, once for subdirectories
    const directMatch = normalizedDir + "/" + cleanPattern;
    const subMatch = normalizedDir + "/**/" + cleanPattern;

    if (isNegation) {
      return ["!" + directMatch, "!" + subMatch];
    } else {
      return [directMatch, subMatch];
    }
  }
}

/**
 * Filter files using gitignore patterns
 * @param {string[]} files - Array of file paths relative to cwd
 * @param {Object} ig - ignore instance
 * @param {string} cwd - Current working directory
 * @returns {string[]} Filtered array of files
 */
export function filterWithGitignore(files, ig, cwd = process.cwd()) {
  if (!ig) {
    return files;
  }

  const gitRoot = findGitRoot(cwd);
  if (!gitRoot) {
    return files;
  }

  // Convert files to be relative to git root for ignore to work correctly
  const filesRelativeToGitRoot = files.map((file) => {
    const absolutePath = path.isAbsolute(file) ? file : path.join(cwd, file);
    return path.relative(gitRoot, absolutePath);
  });

  // Filter using ignore
  const filteredRelativeToGitRoot = ig.filter(filesRelativeToGitRoot);

  // Convert back to original format (relative to cwd)
  return filteredRelativeToGitRoot.map((file) => {
    const absolutePath = path.join(gitRoot, file);
    return path.relative(cwd, absolutePath);
  });
}
