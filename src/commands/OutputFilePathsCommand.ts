import * as path from "node:path"
import * as Config from "../Config.js"
import * as Files from "../Files.js"
import * as Logger from "../Logger.js"

/**
 * Output the resolved file paths based on configuration and arguments
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

  // 3. Find files
  try {
    const files = await Files.findFiles(config, filePatterns, cwd, options)

    // Output absolute paths (only if not silent log level)
    if (Logger.shouldLog(logLevel, "info")) {
      for (const file of files) {
        const absolutePath = path.isAbsolute(file) ? file : path.join(cwd, file)
        console.log(absolutePath)
      }
    }

    return 0
  } catch (error) {
    if (Logger.shouldLog(logLevel, "error")) {
      console.error(`Error: ${(error as Error).message}`)
    }
    return 1
  }
}
