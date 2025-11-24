/**
 * Helper utilities for finding local dprint plugins in node_modules
 * Used by comparison tests to avoid downloading plugins on every test run
 */

import * as fs from "node:fs"
import * as path from "node:path"
import { fileURLToPath } from "node:url"
import * as Glob from "../src/Glob.js"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/**
 * Find the closest node_modules directory starting from a given directory
 *
 * @param {string} startDir - Directory to start searching from
 * @returns {string|null} Path to node_modules or null if not found
 */
function findNodeModules(startDir) {
  let currentDir = startDir
  const root = path.parse(currentDir).root

  while (currentDir !== root) {
    const nodeModulesPath = path.join(currentDir, "node_modules")
    if (fs.existsSync(nodeModulesPath)) {
      return nodeModulesPath
    }
    currentDir = path.dirname(currentDir)
  }

  return null
}

/**
 * Find local dprint plugin WASM files in node_modules
 *
 * @param {string} pluginName - Name of the plugin (e.g., "typescript", "json", "markdown")
 * @param {string} [cwd=process.cwd()] - Working directory to start search from
 * @returns {string|null} Absolute path to plugin.wasm or null if not found
 */
export function findLocalPlugin(pluginName, cwd = process.cwd()) {
  const nodeModulesPath = findNodeModules(cwd)
  if (!nodeModulesPath) {
    return null
  }

  // Look for plugin.wasm in @dprint/{pluginName}/
  const pluginDir = path.join(nodeModulesPath, "@dprint", pluginName)
  const pluginPath = path.join(pluginDir, "plugin.wasm")

  if (fs.existsSync(pluginPath)) {
    return pluginPath
  }

  return null
}

/**
 * Find all available dprint plugins in node_modules
 *
 * @param {string} [cwd=process.cwd()] - Working directory to start search from
 * @returns {Map<string, string>} Map of plugin names to absolute paths
 */
export function findAllLocalPlugins(cwd = process.cwd()) {
  const nodeModulesPath = findNodeModules(cwd)
  if (!nodeModulesPath) {
    return new Map()
  }

  const plugins = new Map()
  const dprintDir = path.join(nodeModulesPath, "@dprint")

  if (!fs.existsSync(dprintDir)) {
    return plugins
  }

  // Find all plugin.wasm files under @dprint/
  const pluginFiles = Glob.findMatchingFiles(
    ["@dprint/*/plugin.wasm"],
    [],
    nodeModulesPath,
  )

  for (const pluginFile of pluginFiles) {
    // Extract plugin name from path: @dprint/{pluginName}/plugin.wasm
    const match = pluginFile.match(/^@dprint\/([^/]+)\/plugin\.wasm$/)
    if (match) {
      const pluginName = match[1]
      const absolutePath = path.join(nodeModulesPath, pluginFile)
      plugins.set(pluginName, absolutePath)
    }
  }

  return plugins
}

/**
 * Get file:// URL for a local plugin
 *
 * @param {string} pluginName - Name of the plugin (e.g., "typescript", "json", "markdown")
 * @param {string} [cwd=process.cwd()] - Working directory to start search from
 * @returns {string|null} file:// URL to plugin.wasm or null if not found
 */
export function getLocalPluginUrl(pluginName, cwd = process.cwd()) {
  const pluginPath = findLocalPlugin(pluginName, cwd)
  if (!pluginPath) {
    return null
  }

  // Convert to file:// URL
  // On Windows, this will be file:///C:/path/to/plugin.wasm
  // On Unix, this will be file:///path/to/plugin.wasm
  return `file://${pluginPath}`
}

/**
 * Find the Rust dprint binary in node_modules
 *
 * @param {string} [cwd=process.cwd()] - Working directory to start search from
 * @returns {string|null} Absolute path to Rust dprint binary or null if not found
 */
function findTheirBinary(cwd = process.cwd()) {
  const nodeModulesPath = findNodeModules(cwd)
  if (!nodeModulesPath) {
    return null
  }

  const binaryPath = path.join(nodeModulesPath, "dprint", "dprint")
  if (fs.existsSync(binaryPath)) {
    return binaryPath
  }

  return null
}

/**
 * Find our dprint binary (bin/dprint)
 *
 * @returns {string} Absolute path to our dprint binary
 */
function findOursBinary() {
  // Go up from test/ to project root, then to bin/dprint
  const projectRoot = path.resolve(__dirname, "..")
  return path.join(projectRoot, "bin", "dprint")
}

/**
 * Cached Rust dprint binary path for comparison tests
 * @type {string|null}
 */
export const THEIR_BIN = findTheirBinary()

/**
 * Cached our dprint binary path for comparison tests
 * @type {string}
 */
export const OURS_BIN = findOursBinary()
