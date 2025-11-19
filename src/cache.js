import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

/**
 * Get the platform-specific cache directory for dprint-js
 * @returns {string} Absolute path to cache directory
 */
export function getCacheDirectory() {
  // Allow override via environment variable
  if (process.env.DPRINT_CACHE_DIR) {
    return process.env.DPRINT_CACHE_DIR;
  }

  const platform = os.platform();
  const homeDir = os.homedir();

  switch (platform) {
    case "darwin": // macOS
      return path.join(homeDir, "Library", "Caches", "dprint-js");
    case "win32": // Windows
      return path.join(process.env.LOCALAPPDATA || path.join(homeDir, "AppData", "Local"), "dprint-js");
    default: // Linux and others
      return path.join(process.env.XDG_CACHE_HOME || path.join(homeDir, ".cache"), "dprint-js");
  }
}

/**
 * Compute xxHash64-like hash of content using Node's crypto module
 * Note: Using SHA-256 truncated for compatibility, as Node doesn't have native xxHash
 * In production, consider using a dedicated xxhash package for better performance
 * @param {string} content - Content to hash
 * @returns {string} Hash as hex string
 */
export function hashContent(content) {
  // Use SHA-256 and take first 16 chars for a fast hash
  // This is a compromise between performance and availability
  const hash = crypto.createHash("sha256");
  hash.update(content);
  return hash.digest("hex").substring(0, 16);
}

/**
 * Compute cache key from configuration and plugin information
 * The cache key changes when formatting-related configuration changes
 * @param {object} config - dprint configuration
 * @param {Array} plugins - Loaded plugin information
 * @returns {string} Cache key as hex string
 */
export function computeCacheKey(config, plugins) {
  const keyComponents = {
    // Include formatting-related config (exclude includes/excludes as they don't affect formatting)
    typescript: config.typescript || {},
    json: config.json || {},
    markdown: config.markdown || {},
    // Include plugin names and versions
    plugins: plugins.map((p) => ({
      name: p.name,
      // Note: We could extract version from package.json if needed
    })),
    // Include dprint-js version
    version: "0.1.0", // Should be imported from package.json
  };

  const keyString = JSON.stringify(keyComponents, null, 0);
  return hashContent(keyString);
}

/**
 * Incremental cache for tracking formatted files
 */
export class IncrementalCache {
  constructor() {
    this.version = "1.0.0";
    this.cacheKey = null;
    this.files = new Map(); // hash -> { paths: Set, formattedAt: timestamp }
    this.metadata = {
      createdAt: Date.now(),
      lastModified: Date.now(),
      formatCount: 0,
    };
    this.dirty = false;
    this.cacheDir = null;
    this.manifestPath = null;
  }

  /**
   * Load cache from disk
   * @param {string} cacheDir - Directory containing cache files
   * @param {string} cacheKey - Current cache key based on config
   * @returns {Promise<void>}
   */
  async load(cacheDir, cacheKey) {
    this.cacheDir = cacheDir;
    this.cacheKey = cacheKey;
    this.manifestPath = path.join(cacheDir, "incremental", "cache-manifest.json");

    // Ensure cache directory exists
    const incrementalDir = path.join(cacheDir, "incremental");
    if (!fs.existsSync(incrementalDir)) {
      fs.mkdirSync(incrementalDir, { recursive: true });
      return; // New cache
    }

    // Load existing cache
    if (!fs.existsSync(this.manifestPath)) {
      return; // No cache file yet
    }

    try {
      const content = fs.readFileSync(this.manifestPath, "utf-8");
      const data = JSON.parse(content);

      // Check version compatibility
      if (data.version !== this.version) {
        console.warn(`Cache version mismatch (${data.version} vs ${this.version}), clearing cache`);
        this.clear();
        return;
      }

      // Check cache key - if different, config changed, so invalidate
      if (data.cacheKey !== cacheKey) {
        console.log("Configuration changed, invalidating cache");
        this.clear();
        return;
      }

      // Load cache data
      this.cacheKey = data.cacheKey;
      this.metadata = data.metadata || this.metadata;

      // Convert stored files object to Map
      if (data.files) {
        for (const [hash, fileData] of Object.entries(data.files)) {
          this.files.set(hash, {
            paths: new Set(fileData.paths || []),
            formattedAt: fileData.formattedAt,
          });
        }
      }
    } catch (error) {
      console.warn(`Failed to load cache: ${error.message}, starting fresh`);
      this.clear();
    }
  }

  /**
   * Check if a file hash exists in cache
   * @param {string} hash - Hash of file content
   * @returns {boolean}
   */
  hasHash(hash) {
    return this.files.has(hash);
  }

  /**
   * Add a formatted file to cache
   * @param {string} hash - Hash of formatted file content
   * @param {string} filePath - Absolute path to file
   */
  addFile(hash, filePath) {
    if (!this.files.has(hash)) {
      this.files.set(hash, {
        paths: new Set([filePath]),
        formattedAt: Date.now(),
      });
    } else {
      // Add path to existing hash entry
      this.files.get(hash).paths.add(filePath);
    }

    this.metadata.formatCount++;
    this.metadata.lastModified = Date.now();
    this.dirty = true;
  }

  /**
   * Save cache to disk
   * @returns {Promise<void>}
   */
  async save() {
    if (!this.dirty || !this.manifestPath) {
      return;
    }

    // Convert Map to plain object for JSON serialization
    const filesObject = {};
    for (const [hash, fileData] of this.files.entries()) {
      filesObject[hash] = {
        paths: Array.from(fileData.paths),
        formattedAt: fileData.formattedAt,
      };
    }

    const data = {
      version: this.version,
      cacheKey: this.cacheKey,
      files: filesObject,
      metadata: this.metadata,
    };

    // Ensure directory exists
    const dir = path.dirname(this.manifestPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Write atomically: write to temp file, then rename
    const tempPath = this.manifestPath + ".tmp";
    try {
      fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), "utf-8");
      fs.renameSync(tempPath, this.manifestPath);
      this.dirty = false;
    } catch (error) {
      console.warn(`Failed to save cache: ${error.message}`);
      // Clean up temp file if it exists
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }
    }
  }

  /**
   * Clear all cache entries
   */
  clear() {
    this.files.clear();
    this.metadata = {
      createdAt: Date.now(),
      lastModified: Date.now(),
      formatCount: 0,
    };
    this.dirty = true;
  }

  /**
   * Prune old entries from cache
   * @param {number} maxAge - Maximum age in milliseconds (default: 30 days)
   * @param {number} maxEntries - Maximum number of entries (default: 10000)
   */
  prune(maxAge = 30 * 24 * 60 * 60 * 1000, maxEntries = 10000) {
    const now = Date.now();
    let pruned = 0;

    // Remove entries older than maxAge
    for (const [hash, fileData] of this.files.entries()) {
      if (now - fileData.formattedAt > maxAge) {
        this.files.delete(hash);
        pruned++;
      }
    }

    // If still too many entries, remove oldest
    if (this.files.size > maxEntries) {
      // Convert to array and sort by age
      const entries = Array.from(this.files.entries()).sort(
        (a, b) => a[1].formattedAt - b[1].formattedAt,
      );

      // Remove oldest entries
      const toRemove = this.files.size - maxEntries;
      for (let i = 0; i < toRemove; i++) {
        this.files.delete(entries[i][0]);
        pruned++;
      }
    }

    if (pruned > 0) {
      this.dirty = true;
      console.log(`Pruned ${pruned} old cache entries`);
    }
  }

  /**
   * Get cache statistics
   * @returns {object} Cache statistics
   */
  getStats() {
    return {
      entries: this.files.size,
      createdAt: new Date(this.metadata.createdAt).toISOString(),
      lastModified: new Date(this.metadata.lastModified).toISOString(),
      formatCount: this.metadata.formatCount,
      cacheKey: this.cacheKey,
    };
  }
}
// test comment
