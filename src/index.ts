import * as NPath from "node:path"
import * as Config from "./Config.ts"
import * as Formatter from "./Formatter.ts"

export interface ParsedArgs {
  command: string | null
  filePatterns: string[]
  options: Record<string, boolean>
}

export async function formatText(opts: {
  text: string
  filename: string
}): Promise<string> {
  const absolutePath = NPath.resolve(process.cwd(), opts.filename)
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
    const configDir = NPath.dirname(configPath)
    const result = await Formatter.loadPlugins(config, configDir, configPath)
    loadedPlugins = result.plugins
  } catch (error) {
    throw new Error(`Failed to load plugins: ${(error as Error).message}`)
  }

  if (loadedPlugins.length === 0) {
    throw new Error("No plugins loaded. Check your dprint.json configuration.")
  }

  const formatter = Formatter.getFormatterForFile(opts.filename, loadedPlugins)
  if (!formatter) {
    throw new Error(
      `No formatter available for file type: ${NPath.extname(opts.filename)}`,
    )
  }

  const formatted = Formatter.formatText(opts.filename, opts.text, formatter)

  return formatted
}
