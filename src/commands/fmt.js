import * as fs from "node:fs";
import * as path from "node:path";
import { computeCacheKey, getCacheDirectory, hashContent, IncrementalCache } from "../cache.js";
import { findConfigFile, loadConfig } from "../config.js";
import { findFiles } from "../files.js";
import { formatFile, loadPlugins } from "../formatter.js";

/**
 * Format files according to configuration
 */
export default async function fmtCommand(filePatterns = [], options = {}) {
  const cwd = options.cwd || process.cwd();
  const logLevel = options.log_level || "info";
  const shouldLog = (level) => {
    const levels = ["debug", "info", "warn", "error", "silent"];
    const currentLevel = levels.indexOf(logLevel);
    const messageLevel = levels.indexOf(level);
    return messageLevel >= currentLevel;
  };

  // Find config file
  const configPath = findConfigFile(cwd, options);

  if (!configPath) {
    if (shouldLog("error")) {
      console.error("Error: No dprint.json configuration file found");
      console.error("Run 'dprint-js init' to create one");
    }
    return 11; // Config error exit code
  }

  // Load config with option overrides
  let config;
  try {
    config = loadConfig(configPath, options);
  } catch (error) {
    if (shouldLog("error")) {
      console.error(`Error: ${error.message}`);
    }
    return 11; // Config error exit code
  }

  if (shouldLog("info")) {
    console.log(`Using configuration from: ${configPath}`);
  }

  // Load plugins
  if (shouldLog("info")) {
    console.log("Loading plugins...");
  }

  let loadedPlugins;
  try {
    loadedPlugins = await loadPlugins(config, cwd, configPath);
  } catch (error) {
    if (shouldLog("error")) {
      console.error(`Error: ${error.message}`);
    }
    return 13; // Plugin error exit code
  }

  if (loadedPlugins.length === 0) {
    if (shouldLog("error")) {
      console.error("Error: No formatters loaded. Make sure plugins are installed:");
      console.error("  bun install @dprint/typescript @dprint/json @dprint/markdown");
    }
    return 13; // Plugin error exit code
  }

  if (shouldLog("info")) {
    console.log(`Loaded ${loadedPlugins.length} formatter(s)`);
  }

  // Initialize incremental cache if enabled
  let cache = null;
  const incrementalEnabled = config.incremental !== false && options.incremental !== false;

  if (incrementalEnabled) {
    cache = new IncrementalCache();
    const cacheKey = computeCacheKey(config, loadedPlugins);
    const cacheDir = getCacheDirectory();
    await cache.load(cacheDir, cacheKey);

    if (shouldLog("debug")) {
      const stats = cache.getStats();
      console.log(`[DEBUG] Incremental cache loaded`);
      console.log(`[DEBUG] Cache entries: ${stats.entries}`);
      console.log(`[DEBUG] Cache key: ${stats.cacheKey}`);
    }

    // Prune old entries
    cache.prune();
  }

  // Find files with option overrides
  const files = await findFiles(config, filePatterns, cwd, options);

  if (files.length === 0) {
    if (shouldLog("info")) {
      console.log("No files found to format");
    }
    // Exit with 0 if --allow-no-files, otherwise 14
    return options.allow_no_files ? 0 : 14;
  }

  if (shouldLog("info")) {
    console.log(`Found ${files.length} file(s) to format`);
  }

  // Format files
  let formattedCount = 0;
  let errorCount = 0;
  let skippedCount = 0;
  let cacheHits = 0;
  let cacheMisses = 0;

  for (const file of files) {
    const absolutePath = path.join(cwd, file);

    // Check cache first if enabled
    if (cache) {
      const content = fs.readFileSync(absolutePath, "utf-8");
      const hash = hashContent(content);

      if (cache.hasHash(hash)) {
        // File already formatted, skip
        skippedCount++;
        cacheHits++;
        if (shouldLog("debug")) {
          console.log(`[DEBUG] Cache hit: ${file}`);
        }
        continue;
      }

      cacheMisses++;
    }

    const result = await formatFile(absolutePath, loadedPlugins, config, false);

    if (result.error) {
      console.error(`Error formatting ${file}: ${result.error}`);
      errorCount++;
    } else if (result.formatted) {
      if (shouldLog("info")) {
        console.log(`Formatted ${file}`);
      }
      formattedCount++;

      // Show diff if --diff flag is set
      if (options.diff && result.diff) {
        console.log(result.diff);
      }

      // Add to cache after formatting
      if (cache) {
        const content = fs.readFileSync(absolutePath, "utf-8");
        const hash = hashContent(content);
        cache.addFile(hash, absolutePath);
      }
    } else {
      // File didn't need formatting, add to cache
      if (cache) {
        const content = fs.readFileSync(absolutePath, "utf-8");
        const hash = hashContent(content);
        cache.addFile(hash, absolutePath);
      }
    }
  }

  // Save cache if enabled
  if (cache) {
    await cache.save();

    if (shouldLog("debug")) {
      console.log(`[DEBUG] Cache saved`);
      console.log(`[DEBUG] Cache hits: ${cacheHits}`);
      console.log(`[DEBUG] Cache misses: ${cacheMisses}`);
      if (cacheHits + cacheMisses > 0) {
        const hitRate = ((cacheHits / (cacheHits + cacheMisses)) * 100).toFixed(1);
        console.log(`[DEBUG] Cache hit rate: ${hitRate}%`);
      }
    }
  }

  if (shouldLog("info")) {
    if (skippedCount > 0) {
      console.log(`\nFormatted ${formattedCount} file(s), skipped ${skippedCount} file(s) (already formatted)`);
    } else {
      console.log(`\nFormatted ${formattedCount} file(s)`);
    }
  }

  if (errorCount > 0) {
    console.error(`${errorCount} error(s) occurred`);
    return 1;
  }

  return 0;
}
