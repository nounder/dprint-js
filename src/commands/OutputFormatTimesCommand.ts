import * as fs from "node:fs"
import * as path from "node:path"
import * as Config from "../Config.ts"
import * as Files from "../Files.ts"
import * as Formatter from "../Formatter.ts"
import * as Logger from "../Logger.ts"

/**
 * Output the amount of time it takes to format each file
 * @param options - Command options
 * @returns Exit code (0 for success, 11 for config error, 13 for plugin error, 14 for no files)
 */
export async function run(options: {
  cwd: string
  logLevel?: Logger.LogLevel
  config?: string
  configDiscovery?: boolean
  plugins?: string[]
  includesOverride?: string[]
  excludes?: string[]
  excludesOverride?: string[]
  allowNodeModules?: boolean
  allowGitignored?: boolean
  allowNoFiles?: boolean
  filePatterns?: string[]
}): Promise<number> {
  const filePatterns = options.filePatterns || []
  const cwd = options.cwd
  const logLevel = options.logLevel || "info"

  // 1. Find config file
  const configPath = Config.findConfigFile(cwd, options)
  if (!configPath) {
    if (Logger.shouldLog(logLevel, "error")) {
      console.error(
        `No config file found at ${
          path.join(cwd, "dprint.json")
        }. Did you mean to create (dprint init) or specify one (--config <path>)?`,
      )
    }
    return 11
  }

  // 2. Load config
  let config: any
  try {
    config = Config.loadConfig(configPath, options)
  } catch (error) {
    if (Logger.shouldLog(logLevel, "error")) {
      console.error(`Error: ${(error as Error).message}`)
    }
    return 11
  }

  // 3. Load plugins
  let loadedPlugins: any[]
  try {
    const result = await Formatter.loadPlugins(config, cwd, configPath)
    loadedPlugins = result.plugins

    if (loadedPlugins.length === 0) {
      if (Logger.shouldLog(logLevel, "error")) {
        console.error(
          "No plugins found. Please specify plugins in your dprint.json file.",
        )
      }
      return 13
    }
  } catch (error) {
    if (Logger.shouldLog(logLevel, "error")) {
      console.error(`Error: ${(error as Error).message}`)
    }
    return 13
  }

  // 4. Find files
  let files: string[]
  try {
    files = await Files.findFiles(config, filePatterns, cwd, options)

    // If no files found, return error (unless --allow-no-files)
    if (files.length === 0) {
      if (options.allowNoFiles) {
        return 0
      }
      if (Logger.shouldLog(logLevel, "error")) {
        console.error("No files found to format with the specified plugins.")
      }
      return 14
    }
  } catch (error) {
    if (Logger.shouldLog(logLevel, "error")) {
      console.error(`Error: ${(error as Error).message}`)
    }
    return 1
  }

  // 5. Format each file and measure time
  for (const file of files) {
    const absolutePath = path.isAbsolute(file) ? file : path.join(cwd, file)

    try {
      const formatter = Formatter.getFormatterForFile(
        absolutePath,
        loadedPlugins,
      )
      if (!formatter) {
        // No formatter for this file type, skip it
        continue
      }

      const content = fs.readFileSync(absolutePath, "utf-8")

      // Measure formatting time
      const startTime = performance.now()
      Formatter.formatText(absolutePath, content, formatter)
      const endTime = performance.now()

      const timeMs = Math.round(endTime - startTime)
      // Only output if not silent log level
      if (Logger.shouldLog(logLevel, "info")) {
        console.log(`${timeMs}ms - ${absolutePath}`)
      }
    } catch (error) {
      if (Logger.shouldLog(logLevel, "error")) {
        console.error(
          `Error formatting ${absolutePath}: ${(error as Error).message}`,
        )
      }
    }
  }

  return 0
}
