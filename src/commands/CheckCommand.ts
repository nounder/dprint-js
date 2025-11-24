import * as fs from "node:fs"
import * as path from "node:path"
import * as Cache from "../Cache.ts"
import * as Config from "../Config.ts"
import * as Constants from "../Constants.ts"
import * as Files from "../Files.ts"
import * as Formatter from "../Formatter.ts"
import * as Logger from "../Logger.ts"

/**
 * Check if files are formatted correctly
 */
export async function run(options: {
  cwd: string
  filePatterns?: string[]
  logLevel?: Logger.LogLevel
  config?: string
  configDiscovery?: boolean
  plugins?: string[]
  includesOverride?: string[]
  excludes?: string[]
  excludesOverride?: string[]
  allowNodeModules?: boolean
  allowGitignored?: boolean
  incremental?: boolean
  allowNoFiles?: boolean
  staged?: boolean
  listDifferent?: boolean
}): Promise<number> {
  const cwd = options.cwd
  const filePatterns = options.filePatterns || []
  const logLevel = options.logLevel || "info"

  // Find config file
  const configPath = Config.findConfigFile(cwd, options)

  if (!configPath) {
    if (Logger.shouldLog(logLevel, "error")) {
      console.error("Error: No dprint.json configuration file found")
      console.error(`Run '${Constants.DPRINT} init' to create one`)
    }
    return 11 // Config error exit code
  }

  // Load config with option overrides
  let config: any
  try {
    config = Config.loadConfig(configPath, options)
  } catch (error) {
    if (Logger.shouldLog(logLevel, "error")) {
      console.error(`Error: ${(error as Error).message}`)
    }
    return 11 // Config error exit code
  }

  if (Logger.shouldLog(logLevel, "info")) {
    console.log(`Using configuration from: ${configPath}`)
  }

  // Load plugins
  if (Logger.shouldLog(logLevel, "info")) {
    console.log("Loading plugins...")
  }

  let loadedPlugins: any[]
  let autoDiscovered: string[]
  try {
    const pluginData = await Formatter.loadPlugins(config, cwd, configPath)
    loadedPlugins = pluginData.plugins
    autoDiscovered = pluginData.autoDiscovered
  } catch (error) {
    if (Logger.shouldLog(logLevel, "error")) {
      console.error(`Error: ${(error as Error).message}`)
    }
    return 13 // Plugin error exit code
  }

  // Log auto-discovered plugins
  if (autoDiscovered.length > 0 && Logger.shouldLog(logLevel, "info")) {
    console.log(
      `[INFO] No plugins specified in config, auto-discovered from package.json:`,
    )
    for (const plugin of autoDiscovered) {
      console.log(`  - ${plugin}`)
    }
  }

  if (loadedPlugins.length === 0) {
    if (Logger.shouldLog(logLevel, "error")) {
      console.error(
        "Error: No formatters loaded. Make sure plugins are installed:",
      )
      console.error(
        "  bun install @dprint/typescript @dprint/json @dprint/markdown",
      )
    }
    return 13 // Plugin error exit code
  }

  if (Logger.shouldLog(logLevel, "info")) {
    console.log(`Loaded ${loadedPlugins.length} formatter(s)`)
  }

  // Initialize incremental cache if enabled
  let cache: any = null
  const incrementalEnabled = config.incremental !== false
    && options.incremental !== false

  if (incrementalEnabled) {
    cache = new Cache.IncrementalCache()
    const cacheKey = Cache.computeCacheKey(config, loadedPlugins)
    const cacheDir = Cache.getCacheDirectory()
    await cache.load(cacheDir, cacheKey)

    if (Logger.shouldLog(logLevel, "debug")) {
      const stats = cache.getStats()
      console.log(`[DEBUG] Incremental cache loaded`)
      console.log(`[DEBUG] Cache entries: ${stats.entries}`)
      console.log(`[DEBUG] Cache key: ${stats.cacheKey}`)
    }

    // Prune old entries
    cache.prune()
  }

  // Find files with option overrides
  const files = await Files.findFiles(config, filePatterns, cwd, options)

  if (files.length === 0) {
    if (Logger.shouldLog(logLevel, "info")) {
      console.log("No files found to check")
    }
    // Exit with 0 if --allow-no-files, otherwise 14
    return options.allowNoFiles ? 0 : 14
  }

  if (Logger.shouldLog(logLevel, "info")) {
    console.log(`Checking ${files.length} file(s)...`)
  }

  // Check files
  const unformattedFiles: string[] = []
  let errorCount = 0
  let skippedCount = 0
  let cacheHits = 0
  let cacheMisses = 0

  for (const file of files) {
    const absolutePath = path.join(cwd, file)

    // Check cache first if enabled
    if (cache) {
      const content = fs.readFileSync(absolutePath, "utf-8")
      const hash = Cache.hashContent(content)

      if (cache.hasHash(hash)) {
        // File already formatted, skip
        skippedCount++
        cacheHits++
        if (Logger.shouldLog(logLevel, "debug")) {
          console.log(`[DEBUG] Cache hit: ${file}`)
        }
        continue
      }

      cacheMisses++
    }

    const result = await Formatter.formatFile(
      absolutePath,
      loadedPlugins,
      config,
      true,
    )

    if (result.error) {
      console.error(`Error checking ${file}: ${result.error}`)
      errorCount++
    } else if (result.formatted) {
      unformattedFiles.push(file)
    } else {
      // File is properly formatted, add to cache
      if (cache) {
        const content = fs.readFileSync(absolutePath, "utf-8")
        const hash = Cache.hashContent(content)
        cache.addFile(hash, absolutePath)
      }
    }
  }

  // Save cache if enabled (only for files that passed the check)
  if (cache) {
    await cache.save()

    if (Logger.shouldLog(logLevel, "debug")) {
      console.log(`[DEBUG] Cache saved`)
      console.log(`[DEBUG] Cache hits: ${cacheHits}`)
      console.log(`[DEBUG] Cache misses: ${cacheMisses}`)
      if (cacheHits + cacheMisses > 0) {
        const hitRate = ((cacheHits / (cacheHits + cacheMisses)) * 100).toFixed(
          1,
        )
        console.log(`[DEBUG] Cache hit rate: ${hitRate}%`)
      }
    }
  }

  if (unformattedFiles.length > 0) {
    if (options.listDifferent) {
      // Just output file paths, no extra text
      for (const file of unformattedFiles) {
        console.log(file)
      }
    } else {
      // Show full message with formatting info
      if (Logger.shouldLog(logLevel, "info")) {
        console.error(
          `\nThe following ${unformattedFiles.length} file(s) are not formatted:`,
        )
        for (const file of unformattedFiles) {
          console.error(`  ${file}`)
        }
        console.error(`\nRun '${Constants.DPRINT} fmt' to format them`)
      }
    }
    // Return exit code 20 to match dprint standard (20 = unformatted files)
    return 20
  }

  if (errorCount > 0) {
    console.error(`${errorCount} error(s) occurred`)
    return 1
  }

  if (Logger.shouldLog(logLevel, "info")) {
    if (skippedCount > 0) {
      console.log(
        `All files are formatted correctly! (checked ${cacheMisses} file(s), skipped ${skippedCount} cached file(s))`,
      )
    } else {
      console.log("All files are formatted correctly!")
    }
  }
  return 0
}
