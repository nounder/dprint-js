import { createFromBuffer } from "@dprint/formatter";
import * as fs from "node:fs";
import * as path from "node:path";

/**
 * Plugin name to extension mapping
 */
const PLUGIN_EXTENSIONS = {
  "@dprint/typescript": [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"],
  "@dprint/json": [".json", ".jsonc"],
  "@dprint/markdown": [".md", ".markdown"]
};

/**
 * Load a plugin from node_modules and create a formatter.
 * @param {string} pluginName - Name of the plugin package (e.g., "@dprint/typescript")
 * @param {object} pluginConfig - Configuration for the plugin
 * @returns {object} - Formatter object with format method
 */
async function loadPlugin(pluginName, pluginConfig = {}) {
  try {
    // Dynamically import the plugin
    const plugin = await import(pluginName);

    // Get the path to the WASM file
    let wasmPath;
    if (typeof plugin.getPath === "function") {
      wasmPath = plugin.getPath();
    } else if (typeof plugin.getBuffer === "function") {
      // Some older plugins use getBuffer
      const buffer = plugin.getBuffer();
      return {
        pluginName,
        formatter: createFromBuffer(buffer),
        supportedExtensions: PLUGIN_EXTENSIONS[pluginName] || [],
        config: pluginConfig
      };
    } else {
      throw new Error(`Plugin ${pluginName} does not export getPath() or getBuffer()`);
    }

    // Read the WASM file
    const buffer = fs.readFileSync(wasmPath);

    // Create formatter from buffer
    const formatter = createFromBuffer(buffer);

    return {
      pluginName,
      formatter,
      supportedExtensions: PLUGIN_EXTENSIONS[pluginName] || [],
      config: pluginConfig
    };
  } catch (error) {
    throw new Error(`Failed to load plugin ${pluginName}: ${error.message}`);
  }
}

/**
 * Load all plugins specified in the configuration.
 * @param {object} config - The dprint configuration object
 * @returns {Promise<object[]>} - Array of loaded plugin objects
 */
export async function loadPlugins(config) {
  const plugins = config.plugins || [];

  if (plugins.length === 0) {
    console.warn("Warning: No plugins specified in configuration");
    return [];
  }

  const loadedPlugins = [];

  for (const pluginName of plugins) {
    try {
      // Get plugin-specific config
      const pluginKey = pluginName.split("/").pop(); // e.g., "typescript" from "@dprint/typescript"
      const pluginConfig = config[pluginKey] || {};

      const plugin = await loadPlugin(pluginName, pluginConfig);
      loadedPlugins.push(plugin);

      console.log(`Loaded plugin: ${pluginName}`);
    } catch (error) {
      console.error(`Error loading plugin ${pluginName}: ${error.message}`);
      // Continue loading other plugins
    }
  }

  return loadedPlugins;
}

/**
 * Find the appropriate formatter for a file based on its extension.
 * @param {string} filePath - Path to the file
 * @param {object[]} plugins - Array of loaded plugin objects
 * @returns {object|null} - The plugin object that can format this file, or null
 */
export function findFormatterForFile(filePath, plugins) {
  const ext = path.extname(filePath);

  for (const plugin of plugins) {
    if (plugin.supportedExtensions && plugin.supportedExtensions.includes(ext)) {
      return plugin;
    }
  }

  return null;
}

/**
 * Format a file using the appropriate plugin.
 * @param {string} filePath - Path to the file to format
 * @param {object[]} plugins - Array of loaded plugin objects
 * @returns {object} - Result object with {formatted: boolean, content: string}
 */
export function formatFile(filePath, plugins) {
  const plugin = findFormatterForFile(filePath, plugins);

  if (!plugin) {
    return {
      formatted: false,
      content: null,
      reason: "no-formatter"
    };
  }

  try {
    const originalContent = fs.readFileSync(filePath, "utf-8");
    const fileName = path.basename(filePath);

    // Format the text using the plugin
    const formattedContent = plugin.formatter.formatText(fileName, originalContent);

    const hasChanged = formattedContent !== originalContent;

    return {
      formatted: true,
      changed: hasChanged,
      content: formattedContent,
      originalContent
    };
  } catch (error) {
    return {
      formatted: false,
      content: null,
      reason: "error",
      error: error.message
    };
  }
}

/**
 * Write formatted content back to a file.
 * @param {string} filePath - Path to the file
 * @param {string} content - Formatted content to write
 */
export function writeFormattedFile(filePath, content) {
  fs.writeFileSync(filePath, content, "utf-8");
}
