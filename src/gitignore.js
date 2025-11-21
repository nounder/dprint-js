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

    // If this .gitignore is in a subdirectory, prefix patterns with the directory
    if (relativeDir && line.startsWith("!/")) {
      // Negation with rooted pattern in nested .gitignore
      // !/build in src/.gitignore should become !/src/build
      patterns.push("!/" + path.join(relativeDir, line.slice(2)));
    } else if (relativeDir && line.startsWith("!")) {
      // Negation without rooted pattern in nested .gitignore
      const negatedPattern = line.slice(1);
      if (negatedPattern.startsWith("/")) {
        // This shouldn't happen (!/...) but handle it anyway
        patterns.push("!/" + path.join(relativeDir, negatedPattern.slice(1)));
      } else {
        // Check if negated pattern is recursive (no slash, or only trailing slash)
        const patternWithoutTrailingSlash = negatedPattern.endsWith('/')
          ? negatedPattern.slice(0, -1)
          : negatedPattern;
        const hasSlash = patternWithoutTrailingSlash.includes('/');

        if (hasSlash) {
          // Pattern with slash - anchored
          // !build/dist in src/.gitignore should become !src/build/dist
          patterns.push("!" + path.join(relativeDir, negatedPattern));
        } else {
          // Pattern without slash - recursive
          // !important.log in src/.gitignore should become !src/**/important.log
          patterns.push("!" + path.join(relativeDir, '**', negatedPattern));
        }
      }
    } else if (relativeDir && line.startsWith("/")) {
      // Rooted pattern in nested .gitignore
      // /build in src/.gitignore should become /src/build
      patterns.push("/" + path.join(relativeDir, line.slice(1)));
    } else if (relativeDir) {
      // Non-rooted pattern in nested .gitignore
      // Check if pattern is recursive (no slash, or only trailing slash)
      const patternWithoutTrailingSlash = line.endsWith('/')
        ? line.slice(0, -1)
        : line;
      const hasSlash = patternWithoutTrailingSlash.includes('/');

      if (hasSlash) {
        // Pattern with slash - anchored, not recursive
        // build/dist in src/.gitignore should become src/build/dist
        patterns.push(path.join(relativeDir, line));
      } else {
        // Pattern without slash - recursive at any depth
        // *.log in src/.gitignore should become src/**/*.log
        // temp in src/.gitignore should become src/**/temp
        // build/ in src/.gitignore should become src/**/build/
        patterns.push(path.join(relativeDir, '**', line));
      }
    } else {
      // Root .gitignore patterns - use as-is
      patterns.push(line);
    }
  }

  return patterns;
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
