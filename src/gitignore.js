import ignore from "ignore";
import * as fs from "node:fs";
import * as path from "node:path";

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
