import { createFromBuffer } from "@dprint/formatter";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Load a plugin from node_modules
 * @param {string} pluginName - Name of the plugin package (e.g., "@dprint/typescript")
 * @param {string} cwd - Current working directory
 * @returns {object} The loaded formatter
 */
export async function loadPlugin(pluginName, cwd = process.cwd()) {
  try {
    // Dynamically import the plugin
    const pluginModule = await import(pluginName);

    // Get the path to the WASM file
    let wasmPath;
    if (typeof pluginModule.getPath === "function") {
      wasmPath = pluginModule.getPath();
    } else if (typeof pluginModule.getBuffer === "function") {
      // For plugins that haven't updated to getPath yet
      const buffer = pluginModule.getBuffer();
      return createFromBuffer(buffer);
    } else {
      throw new Error(`Plugin ${pluginName} does not export getPath() or getBuffer()`);
    }

    // Read the WASM file
    const buffer = fs.readFileSync(wasmPath);
    return createFromBuffer(buffer);
  } catch (error) {
    throw new Error(`Failed to load plugin ${pluginName}: ${error.message}`);
  }
}

/**
 * Load all plugins specified in the configuration
 * @param {object} config - The dprint configuration
 * @param {string} cwd - Current working directory
 * @returns {Promise<Map<string, object>>} Map of plugin name to formatter
 */
export async function loadPlugins(config, cwd = process.cwd()) {
  const plugins = config.plugins || [];
  const formatters = new Map();

  for (const pluginName of plugins) {
    try {
      const formatter = await loadPlugin(pluginName, cwd);

      // Set configuration for the formatter
      const pluginConfigKey = pluginName.split('/')[1]; // e.g., '@dprint/typescript' -> 'typescript'
      const pluginConfig = config[pluginConfigKey] || {};

      // Call setConfig with the plugin-specific configuration
      formatter.setConfig({}, pluginConfig);

      formatters.set(pluginName, formatter);
    } catch (error) {
      console.error(`Warning: ${error.message}`);
    }
  }

  return formatters;
}

/**
 * Get the appropriate formatter for a file based on its extension
 * @param {string} filePath - Path to the file
 * @param {Map<string, object>} formatters - Map of loaded formatters
 * @param {object} config - The dprint configuration
 * @returns {object|null} The formatter to use, or null if none found
 */
export function getFormatterForFile(filePath, formatters, config) {
  const ext = path.extname(filePath).slice(1);

  // Map extensions to plugin names
  const extensionMap = {
    'ts': '@dprint/typescript',
    'tsx': '@dprint/typescript',
    'js': '@dprint/typescript',
    'jsx': '@dprint/typescript',
    'json': '@dprint/json',
    'md': '@dprint/markdown',
    'markdown': '@dprint/markdown',
  };

  const pluginName = extensionMap[ext];
  if (!pluginName) {
    return null;
  }

  return formatters.get(pluginName) || null;
}

/**
 * Format a file's content
 * @param {string} filePath - Path to the file
 * @param {string} content - File content
 * @param {object} formatter - The formatter to use
 * @param {object} config - The dprint configuration
 * @returns {string} Formatted content
 */
export function formatText(filePath, content, formatter, config) {
  try {
    // The formatter.formatText API uses object parameter syntax
    const formatted = formatter.formatText({
      filePath: filePath,
      fileText: content
    });

    return formatted;
  } catch (error) {
    throw new Error(`Failed to format ${filePath}: ${error.message}`);
  }
}

/**
 * Format a file and optionally write it back
 * @param {string} filePath - Path to the file
 * @param {Map<string, object>} formatters - Map of loaded formatters
 * @param {object} config - The dprint configuration
 * @param {boolean} check - If true, only check formatting without writing
 * @returns {Promise<{formatted: boolean, error: string|null}>}
 */
export async function formatFile(filePath, formatters, config, check = false) {
  try {
    const formatter = getFormatterForFile(filePath, formatters, config);
    if (!formatter) {
      // No formatter for this file type
      return { formatted: false, error: null };
    }

    const content = fs.readFileSync(filePath, "utf-8");
    const formatted = formatText(filePath, content, formatter, config);

    if (formatted === content) {
      // File is already formatted
      return { formatted: false, error: null };
    }

    if (!check) {
      // Write the formatted content back
      fs.writeFileSync(filePath, formatted, "utf-8");
    }

    return { formatted: true, error: null };
  } catch (error) {
    return { formatted: false, error: error.message };
  }
}
