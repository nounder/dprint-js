import { createFromBuffer } from "@dprint/formatter";
import * as fs from "node:fs";
import * as path from "node:path";

/**
 * Load a plugin from node_modules
 * @param {string} pluginName - Name of the plugin package (e.g., "@dprint/typescript")
 * @param {string} cwd - Current working directory
 * @returns {Promise<object>} The loaded formatter with file matching info
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
      const formatter = createFromBuffer(buffer);
      return { formatter, fileMatchingInfo: formatter.getFileMatchingInfo() };
    } else {
      throw new Error(`Plugin ${pluginName} does not export getPath() or getBuffer()`);
    }

    // Read the WASM file
    const buffer = fs.readFileSync(wasmPath);
    const formatter = createFromBuffer(buffer);

    return { formatter, fileMatchingInfo: formatter.getFileMatchingInfo() };
  } catch (error) {
    throw new Error(`Failed to load plugin ${pluginName}: ${error.message}`);
  }
}

/**
 * Load all plugins specified in the configuration
 * @param {object} config - The dprint configuration
 * @param {string} cwd - Current working directory
 * @returns {Promise<Array<{name: string, formatter: object, extensions: string[], fileNames: string[]}>>}
 */
export async function loadPlugins(config, cwd = process.cwd()) {
  const plugins = config.plugins || [];
  const loadedPlugins = [];

  for (const pluginName of plugins) {
    try {
      const { formatter, fileMatchingInfo } = await loadPlugin(pluginName, cwd);

      // Set configuration for the formatter
      const pluginConfigKey = pluginName.split('/')[1]; // e.g., '@dprint/typescript' -> 'typescript'
      const pluginConfig = config[pluginConfigKey] || {};

      // Call setConfig with the plugin-specific configuration
      formatter.setConfig({}, pluginConfig);

      loadedPlugins.push({
        name: pluginName,
        formatter,
        extensions: fileMatchingInfo.fileExtensions || [],
        fileNames: fileMatchingInfo.fileNames || [],
      });
    } catch (error) {
      console.error(`Warning: ${error.message}`);
    }
  }

  return loadedPlugins;
}

/**
 * Get the appropriate formatter for a file based on its extension and name
 * @param {string} filePath - Path to the file
 * @param {Array} loadedPlugins - Array of loaded plugin objects
 * @returns {object|null} The formatter to use, or null if none found
 */
export function getFormatterForFile(filePath, loadedPlugins) {
  const ext = path.extname(filePath).slice(1); // Remove leading dot
  const fileName = path.basename(filePath);

  for (const plugin of loadedPlugins) {
    // Check if file name matches
    if (plugin.fileNames.includes(fileName)) {
      return plugin.formatter;
    }

    // Check if extension matches
    if (plugin.extensions.includes(ext)) {
      return plugin.formatter;
    }
  }

  return null;
}

/**
 * Format a file's content
 * @param {string} filePath - Path to the file
 * @param {string} content - File content
 * @param {object} formatter - The formatter to use
 * @returns {string} Formatted content
 */
export function formatText(filePath, content, formatter) {
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
 * @param {Array} loadedPlugins - Array of loaded plugin objects
 * @param {object} config - The dprint configuration
 * @param {boolean} check - If true, only check formatting without writing
 * @returns {Promise<{formatted: boolean, error: string|null}>}
 */
export async function formatFile(filePath, loadedPlugins, config, check = false) {
  try {
    const formatter = getFormatterForFile(filePath, loadedPlugins);
    if (!formatter) {
      // No formatter for this file type
      return { formatted: false, error: null };
    }

    const content = fs.readFileSync(filePath, "utf-8");
    const formatted = formatText(filePath, content, formatter);

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
