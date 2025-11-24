import * as fs from "node:fs"
import * as path from "node:path"
import * as Cache from "../Cache.js"
import * as Config from "../Config.js"
import * as Constants from "../Constants.js"
import * as Files from "../Files.js"
import * as Formatter from "../Formatter.js"
import * as Logger from "../Logger.js"

/**
 * Read all data from stdin
 * @returns The stdin content
 */
async function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: string[] = []
    process.stdin.setEncoding("utf-8")

    process.stdin.on("data", (chunk) => {
      chunks.push(chunk.toString())
    })

    process.stdin.on("end", () => {
      resolve(chunks.join(""))
    })

    process.stdin.on("error", (error) => {
      reject(error)
    })
  })
}

/**
 * Handle stdin formatting
 * @param stdinValue - The value of --stdin (extension, filename, or filepath)
 * @param loadedPlugins - Array of loaded plugin objects
 * @param cwd - Current working directory
 * @param logLevel - The log level to use
 * @returns Exit code
 */
async function handleStdin(
  stdinValue: string,
  loadedPlugins: any[],
  cwd: string,
  logLevel: Logger.LogLevel,
): Promise<number> {
  try {
    // Read content from stdin
    const content = await readStdin()

    // Determine the file path to use for formatter selection
    // If it's an absolute path, use it as-is
    // If it's a relative path or just an extension/filename, resolve it
    let filePath: string
    if (path.isAbsolute(stdinValue)) {
      filePath = stdinValue
    } else if (stdinValue.includes("/") || stdinValue.includes("\\")) {
      // Relative path
      filePath = path.join(cwd, stdinValue)
    } else if (stdinValue.includes(".")) {
      // Filename with extension (e.g., "test.ts" or just ".ts")
      filePath = stdinValue.startsWith(".") ? `file${stdinValue}` : stdinValue
    } else {
      // Just an extension (e.g., "ts")
      filePath = `file.${stdinValue}`
    }

    // Get the appropriate formatter
    const formatter = Formatter.getFormatterForFile(filePath, loadedPlugins)

    if (!formatter) {
      if (Logger.shouldLog(logLevel, "error")) {
        console.error(`Error: No formatter found for ${stdinValue}`)
      }
      return 13 // Plugin error exit code
    }

    // Format the content
    const formatted = Formatter.formatText(filePath, content, formatter)

    // Output ONLY the formatted content to stdout
    process.stdout.write(formatted)

    return 0
  } catch (error) {
    if (Logger.shouldLog(logLevel, "error")) {
      console.error(`Error: ${(error as Error).message}`)
    }
    return 1
  }
}

/**
 * Format files according to configuration
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
  stdin?: string
  diff?: boolean
}): Promise<number> {
  const filePatterns = options.filePatterns || []
  const cwd = options.cwd
  // Default to silent mode for stdin to prevent diagnostic messages in stdout
  // But respect explicit logLevel if provided
  const logLevel = options.logLevel || (options.stdin ? "silent" : "info")

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

  // Handle stdin mode
  if (options.stdin) {
    return await handleStdin(options.stdin, loadedPlugins, cwd, logLevel)
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
      console.log("No files found to format")
    }
    // Exit with 0 if --allow-no-files, otherwise 14
    return options.allowNoFiles ? 0 : 14
  }

  if (Logger.shouldLog(logLevel, "info")) {
    console.log(`Found ${files.length} file(s) to format`)
  }

  // Format files
  let formattedCount = 0
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
      false,
    )

    if (result.error) {
      console.error(`Error formatting ${file}: ${result.error}`)
      errorCount++
    } else if (result.formatted) {
      if (Logger.shouldLog(logLevel, "info")) {
        console.log(`Formatted ${file}`)
      }
      formattedCount++

      // Show diff if --diff flag is set
      if (options.diff && result.diff) {
        console.log(result.diff)
      }

      // Add to cache after formatting
      if (cache) {
        const content = fs.readFileSync(absolutePath, "utf-8")
        const hash = Cache.hashContent(content)
        cache.addFile(hash, absolutePath)
      }
    } else {
      // File didn't need formatting, add to cache
      if (cache) {
        const content = fs.readFileSync(absolutePath, "utf-8")
        const hash = Cache.hashContent(content)
        cache.addFile(hash, absolutePath)
      }
    }
  }

  // Save cache if enabled
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

  if (Logger.shouldLog(logLevel, "info")) {
    if (skippedCount > 0) {
      console.log(
        `\nFormatted ${formattedCount} file(s), skipped ${skippedCount} file(s) (already formatted)`,
      )
    } else {
      console.log(`\nFormatted ${formattedCount} file(s)`)
    }
  }

  if (errorCount > 0) {
    console.error(`${errorCount} error(s) occurred`)
    return 1
  }

  return 0
}
