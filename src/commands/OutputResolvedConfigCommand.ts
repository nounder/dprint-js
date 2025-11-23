import * as Config from "../Config.js";
import * as Formatter from "../Formatter.js";
import * as Logger from "../Logger.js";
import * as path from "node:path";

/**
 * Output the resolved configuration for the plugins
 * @param options - Command options
 * @returns Exit code (0 for success, 11 for config error, 13 for plugin error)
 */
export async function run(options: {
  cwd: string;
  logLevel?: Logger.LogLevel;
  config?: string;
  configDiscovery?: boolean;
  plugins?: string[];
}): Promise<number> {
  // Note: This command does not use filePatterns
  const cwd = options.cwd;
  const logLevel = options.logLevel || "info";

  // 1. Find config file
  const configPath = Config.findConfigFile(cwd, options);
  if (!configPath) {
    if (Logger.shouldLog(logLevel, "error")) {
      console.error(
        `No config file found at ${path.join(cwd, "dprint.json")}. Did you mean to create (dprint init) or specify one (--config <path>)?`,
      );
    }
    return 11;
  }

  // 2. Load config
  let config: any;
  try {
    config = Config.loadConfig(configPath, options);
  } catch (error) {
    if (Logger.shouldLog(logLevel, "error")) {
      console.error(`Error: ${(error as Error).message}`);
    }
    return 11;
  }

  // 3. Load plugins
  let loadedPlugins: any[];
  try {
    const result = await Formatter.loadPlugins(config, cwd, configPath);
    loadedPlugins = result.plugins;

    if (loadedPlugins.length === 0) {
      if (Logger.shouldLog(logLevel, "error")) {
        console.error("No plugins found. Please specify plugins in your dprint.json file.");
      }
      return 13;
    }
  } catch (error) {
    if (Logger.shouldLog(logLevel, "error")) {
      console.error(`Error: ${(error as Error).message}`);
    }
    return 13;
  }

  // 4. Get resolved configuration from each plugin
  const resolvedConfig: Record<string, any> = {};

  for (const plugin of loadedPlugins) {
    try {
      // Get the config key from the plugin name
      // @dprint/typescript -> typescript
      // https://plugins.dprint.dev/typescript-0.93.0.wasm -> typescript
      const parts = plugin.name.split("/");
      let configKey = parts.length > 1 ? parts[1] : plugin.name;

      // For remote plugins, extract name from URL
      if (plugin.name.startsWith("http")) {
        const urlPath = new URL(plugin.name).pathname;
        const filename = path.basename(urlPath);
        const match = filename.match(/^(.+?)-v?([\d.]+)\.wasm$/);
        if (match) {
          configKey = match[1];
        }
      }

      // Get the resolved config from the formatter
      const resolved = plugin.formatter.getResolvedConfig();
      resolvedConfig[configKey] = resolved;
    } catch (error) {
      // Skip plugins that don't support getResolvedConfig
      if (Logger.shouldLog(logLevel, "warn")) {
        console.warn(`Warning: Could not get resolved config for ${plugin.name}: ${(error as Error).message}`);
      }
    }
  }

  // 5. Output as JSON (only if not silent log level)
  if (Logger.shouldLog(logLevel, "info")) {
    console.log(JSON.stringify(resolvedConfig, null, 2));
  }

  return 0;
}
