import { createFromBuffer, createStreaming } from "@dprint/formatter";
import * as fs from "node:fs";
import * as path from "node:path";
import * as crypto from "node:crypto";
import * as os from "node:os";

/**
 * Get the cache directory path for remote plugins
 * @returns {string} Path to the cache directory
 */
function getRemotePluginCacheDir() {
  // Check for custom cache directory from environment
  if (process.env.DPRINT_CACHE_DIR) {
    return path.join(process.env.DPRINT_CACHE_DIR, "cache");
  }

  // Platform-specific cache directories (matching dprint conventions)
  const platform = os.platform();
  const homeDir = os.homedir();

  if (platform === "win32") {
    // Windows: %LOCALAPPDATA%/dprint/cache
    const localAppData = process.env.LOCALAPPDATA || path.join(homeDir, "AppData", "Local");
    return path.join(localAppData, "dprint", "cache");
  } else if (platform === "darwin") {
    // macOS: ~/Library/Caches/dprint/cache
    return path.join(homeDir, "Library", "Caches", "dprint", "cache");
  } else {
    // Linux and others: ~/.cache/dprint/cache
    return path.join(homeDir, ".cache", "dprint", "cache");
  }
}

/**
 * Get the cache manifest file path
 * @returns {string} Path to the cache manifest
 */
function getCacheManifestPath() {
  return path.join(getRemotePluginCacheDir(), "plugin-cache-manifest.json");
}

/**
 * Load the cache manifest
 * @returns {object} The cache manifest
 */
function loadCacheManifest() {
  const manifestPath = getCacheManifestPath();

  if (!fs.existsSync(manifestPath)) {
    return {
      schemaVersion: 8,
      plugins: {},
    };
  }

  try {
    const content = fs.readFileSync(manifestPath, "utf-8");
    return JSON.parse(content);
  } catch (error) {
    // If manifest is corrupted, return empty manifest
    return {
      schemaVersion: 8,
      plugins: {},
    };
  }
}

/**
 * Save the cache manifest
 * @param {object} manifest - The cache manifest to save
 */
function saveCacheManifest(manifest) {
  const manifestPath = getCacheManifestPath();
  const cacheDir = getRemotePluginCacheDir();

  // Ensure cache directory exists
  fs.mkdirSync(cacheDir, { recursive: true });

  fs.writeFileSync(manifestPath, JSON.stringify(manifest), "utf-8");
}

/**
 * Get plugin info from a remote URL
 * @param {string} url - The plugin URL
 * @returns {object} Plugin info including name, version, and configKey
 */
function getPluginInfoFromUrl(url) {
  // Extract plugin name and version from URL
  // Examples:
  // - https://plugins.dprint.dev/typescript-0.95.11.wasm
  // - https://plugins.dprint.dev/g-plane/markup_fmt-v0.24.0.wasm
  const urlObj = new URL(url);
  const filename = path.basename(urlObj.pathname);

  // Try to match pattern with optional 'v' prefix before version
  // Matches: name-version.wasm or name-vversion.wasm
  const match = filename.match(/^(.+?)-v?([\d.]+)\.wasm$/);

  if (!match) {
    throw new Error(`Unable to parse plugin name and version from URL: ${url}`);
  }

  const [, name, version] = match;

  // The config key is typically the plugin name without the dprint-plugin- prefix
  let configKey = name;
  if (configKey.startsWith("dprint-plugin-")) {
    configKey = configKey.replace("dprint-plugin-", "");
  }

  return {
    name: `dprint-plugin-${name}`,
    version,
    configKey,
  };
}

/**
 * Generate a cache file path for a plugin
 * @param {string} pluginName - The plugin name
 * @param {string} version - The plugin version
 * @returns {string} Path to the cached plugin file
 */
function getCachedPluginPath(pluginName, version) {
  const pluginsDir = path.join(getRemotePluginCacheDir(), "plugins");

  // Generate a hash for the file (simplified version)
  const hash = crypto
    .createHash("sha256")
    .update(`${pluginName}-${version}`)
    .digest("hex")
    .substring(0, 16);

  const filename = `${version}-${hash}`;
  return path.join(pluginsDir, pluginName, filename);
}

/**
 * Get a cached plugin path if it exists
 * @param {string} url - The plugin URL
 * @returns {string|null} Path to the cached plugin file, or null if not cached
 */
function getCachedPluginForUrl(url) {
  const cacheKey = `remote:${url}`;
  const manifest = loadCacheManifest();

  const cachedEntry = manifest.plugins[cacheKey];
  if (!cachedEntry) {
    return null;
  }

  const pluginPath = getCachedPluginPath(cachedEntry.info.name, cachedEntry.info.version);

  // Check if the file actually exists
  if (!fs.existsSync(pluginPath)) {
    return null;
  }

  return { path: pluginPath, info: cachedEntry.info };
}

/**
 * Download a file from a URL
 * @param {string} url - The URL to download from
 * @returns {Promise<Buffer>} The downloaded file content
 */
async function downloadFile(url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to download ${url}: ${response.status} ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Cache a remote plugin
 * @param {string} url - The plugin URL
 * @param {Buffer} content - The plugin content
 * @param {object} info - Plugin info
 * @returns {string} Path to the cached plugin file
 */
function cacheRemotePlugin(url, content, info) {
  const cacheKey = `remote:${url}`;
  const pluginPath = getCachedPluginPath(info.name, info.version);

  // Ensure plugin directory exists
  fs.mkdirSync(path.dirname(pluginPath), { recursive: true });

  // Write plugin content
  fs.writeFileSync(pluginPath, content);

  // Update cache manifest
  const manifest = loadCacheManifest();
  manifest.plugins[cacheKey] = {
    createdTime: Math.floor(Date.now() / 1000),
    info,
  };
  saveCacheManifest(manifest);

  return pluginPath;
}

/**
 * Check if a plugin name is a remote URL
 * @param {string} pluginName - The plugin name/URL
 * @returns {boolean} True if it's a remote URL
 */
function isRemotePlugin(pluginName) {
  return pluginName.startsWith("http://") || pluginName.startsWith("https://");
}

/**
 * Load a remote plugin from URL
 * @param {string} url - The plugin URL
 * @returns {Promise<object>} The loaded formatter with file matching info and config key
 */
async function loadRemotePlugin(url) {
  // Get plugin info
  const info = getPluginInfoFromUrl(url);

  // Check if already cached
  const cached = getCachedPluginForUrl(url);
  if (cached) {
    // Load from cache using streaming API
    const buffer = fs.readFileSync(cached.path);
    const response = new Response(buffer);
    const formatter = await createStreaming(response);
    // Must call setConfig before getFileMatchingInfo
    formatter.setConfig({}, {});
    return {
      formatter,
      fileMatchingInfo: formatter.getFileMatchingInfo(),
      configKey: cached.info.configKey,
    };
  }

  // Download and cache the plugin
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download ${url}: ${response.status} ${response.statusText}`);
  }

  // Get the content as buffer for caching
  const content = Buffer.from(await response.arrayBuffer());

  // Cache the plugin
  const pluginPath = cacheRemotePlugin(url, content, info);

  // Load the plugin using streaming API
  const cachedBuffer = fs.readFileSync(pluginPath);
  const cachedResponse = new Response(cachedBuffer);
  const formatter = await createStreaming(cachedResponse);

  // Must call setConfig before getFileMatchingInfo
  formatter.setConfig({}, {});

  return {
    formatter,
    fileMatchingInfo: formatter.getFileMatchingInfo(),
    configKey: info.configKey,
  };
}

/**
 * Load a plugin from node_modules or remote URL
 * @param {string} pluginName - Name of the plugin package or URL (e.g., "@dprint/typescript" or "https://...")
 * @param {string} cwd - Current working directory
 * @returns {Promise<object>} The loaded formatter with file matching info and optional configKey
 */
export async function loadPlugin(pluginName, cwd = process.cwd()) {
  try {
    // Check if this is a remote plugin
    if (isRemotePlugin(pluginName)) {
      return await loadRemotePlugin(pluginName);
    }

    // Dynamically import the plugin from node_modules
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
      const { formatter, fileMatchingInfo, configKey } = await loadPlugin(pluginName, cwd);

      // Set configuration for the formatter
      // For remote plugins, configKey is provided. For npm plugins, extract from name
      let pluginConfigKey;
      if (configKey) {
        pluginConfigKey = configKey;
      } else {
        pluginConfigKey = pluginName.split("/")[1]; // e.g., '@dprint/typescript' -> 'typescript'
      }

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
      fileText: content,
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
