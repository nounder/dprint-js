import { Glob } from "bun";
import * as fs from "node:fs";
import * as path from "node:path";
import * as Gitignore from "./Gitignore.js";
import * as GlobUtils from "./Glob.js";

/**
 * Dprint configuration object
 */
export interface DprintConfig {
  includes?: string[];
  excludes?: string[];
  plugins?: string[];
  [key: string]: unknown;
}

/**
 * Options for finding files
 */
export interface FindFilesOptions {
  /**
   * Override include patterns completely (from --includes-override)
   */
  includesOverride?: string[];
  /**
   * Override exclude patterns completely (from --excludes-override)
   */
  excludesOverride?: string[];
  /**
   * Additional exclude patterns to add to config excludes (from --excludes)
   */
  excludes?: string[];
  /**
   * Allow files in node_modules directories
   */
  allowNodeModules?: boolean;
  /**
   * Allow files that are gitignored
   */
  allowGitignored?: boolean;
}

/**
 * Ignore instance from the gitignore module
 */
interface IgnoreInstance {
  filter(paths: string[]): string[];
  add(patterns: string | string[]): IgnoreInstance;
  ignores(path: string): boolean;
}

/**
 * Find files matching the patterns specified in the configuration
 * @param config - The dprint configuration object
 * @param additionalPatterns - Additional file patterns from command line
 * @param cwd - Current working directory
 * @param options - Additional options for file finding
 * @returns Array of matching file paths
 */
export async function findFiles(
  config: DprintConfig,
  additionalPatterns: string[] = [],
  cwd: string = process.cwd(),
  options: FindFilesOptions = {},
): Promise<string[]> {
  // Determine includes patterns
  let includes: string[];
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
  let excludes: string[];
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
  const normalizedExcludes = GlobUtils.normalizeExcludePatterns(excludes);

  // Find matching files using glob patterns
  let files = GlobUtils.findMatchingFiles(includes, normalizedExcludes, cwd);

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
 * @param filePath - The file path to check
 * @param config - The dprint configuration object
 * @returns True if the file should be processed
 */
export function shouldProcessFile(filePath: string, config: DprintConfig): boolean {
  const includes = GlobUtils.normalizeIncludePatterns(config.includes || ["**/*"]);
  const excludes = GlobUtils.normalizeExcludePatterns(config.excludes || []);

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
export function getFileExtension(filePath: string): string {
  return path.extname(filePath).slice(1);
}

/**
 * Create an ignore instance from .gitignore files
 * Searches for all .gitignore files in the git repository
 * @param cwd - Current working directory
 * @returns ignore instance or null if no .gitignore files found
 */
export function loadGitignorePatterns(cwd: string = process.cwd()): IgnoreInstance | null {
  const gitRoot = findGitRoot(cwd);
  if (!gitRoot) {
    return null;
  }

  const ig = Gitignore.default();
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
 * @param startDir - Directory to start searching from
 * @returns Path to git root or null if not in a git repository
 */
function findGitRoot(startDir: string): string | null {
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
 * @param gitRoot - Git root directory
 * @returns Array of .gitignore file paths
 */
function findAllGitignoreFiles(gitRoot: string): string[] {
  const gitignoreFiles: string[] = [];

  function traverse(dir: string): void {
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
 * @param content - Content of .gitignore file
 * @param relativeDir - Relative directory path from git root
 * @returns Array of patterns
 */
function parseGitignoreContent(content: string, relativeDir: string = ""): string[] {
  const lines = content.split(/\r?\n/);
  const patterns: string[] = [];

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
 * @param pattern - The pattern from .gitignore
 * @param relativeDir - Relative directory path from git root
 * @returns Array of normalized patterns (usually 1, sometimes 2)
 */
function normalizePatternForDirectory(pattern: string, relativeDir: string): string[] {
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
 * @param files - Array of file paths relative to cwd
 * @param ig - ignore instance
 * @param cwd - Current working directory
 * @returns Filtered array of files
 */
export function filterWithGitignore(
  files: string[],
  ig: IgnoreInstance,
  cwd: string = process.cwd(),
): string[] {
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
