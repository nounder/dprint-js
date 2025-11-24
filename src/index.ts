import * as fs from "node:fs"
import * as path from "node:path"
import * as Config from "./Config.ts"
import * as Formatter from "./Formatter.ts"

export interface ParsedArgs {
  command: string | null
  filePatterns: string[]
  options: Record<string, boolean>
}

export async function formatFile(
  filePath: string,
): Promise<string> {
  const absolutePath = path.resolve(process.cwd(), filePath)

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`File not found: ${filePath}`)
  }

  const fileDir = path.dirname(absolutePath)
  const configPath = Config.findConfigFile(fileDir)

  if (!configPath) {
    throw new Error(
      "No dprint.json configuration file found. Run 'dprint init' to create one.",
    )
  }

  let config: Config.DprintConfig
  try {
    config = Config.loadConfig(configPath)
  } catch (error) {
    throw new Error(`Failed to load configuration: ${(error as Error).message}`)
  }

  let loadedPlugins: Formatter.LoadedPlugin[]
  try {
    const configDir = path.dirname(configPath)
    const result = await Formatter.loadPlugins(config, configDir, configPath)
    loadedPlugins = result.plugins
  } catch (error) {
    throw new Error(`Failed to load plugins: ${(error as Error).message}`)
  }

  if (loadedPlugins.length === 0) {
    throw new Error("No plugins loaded. Check your dprint.json configuration.")
  }

  const formatter = Formatter.getFormatterForFile(absolutePath, loadedPlugins)
  if (!formatter) {
    throw new Error(
      `No formatter available for file type: ${path.extname(filePath)}`,
    )
  }

  const content = fs.readFileSync(absolutePath, "utf-8")
  const formatted = Formatter.formatText(absolutePath, content, formatter)

  return formatted
}

export async function formatString(opts: {
  content: string
  filename: string
}): Promise<string> {
  const { content, filename } = opts

  const absolutePath = path.resolve(process.cwd(), filename)
  const configPath = Config.findConfigFile(absolutePath)

  if (!configPath) {
    throw new Error(
      "No dprint.json configuration file found. Run 'dprint init' to create one.",
    )
  }

  let config: Config.DprintConfig
  try {
    config = Config.loadConfig(configPath)
  } catch (error) {
    throw new Error(`Failed to load configuration: ${(error as Error).message}`)
  }

  let loadedPlugins: Formatter.LoadedPlugin[]
  try {
    const configDir = path.dirname(configPath)
    const result = await Formatter.loadPlugins(config, configDir, configPath)
    loadedPlugins = result.plugins
  } catch (error) {
    throw new Error(`Failed to load plugins: ${(error as Error).message}`)
  }

  if (loadedPlugins.length === 0) {
    throw new Error("No plugins loaded. Check your dprint.json configuration.")
  }

  const formatter = Formatter.getFormatterForFile(filename, loadedPlugins)
  if (!formatter) {
    throw new Error(
      `No formatter available for file type: ${path.extname(filename)}`,
    )
  }

  const formatted = Formatter.formatText(filename, content, formatter)

  return formatted
}
