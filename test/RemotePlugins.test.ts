import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test"
import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"
import * as Formatter from "../src/Formatter.js"
import { findLocalPlugin } from "./Testing.js"

/**
 * Get the cache directory path (matches formatter.js implementation)
 */
function getRemotePluginCacheDir() {
  if (process.env.DPRINT_CACHE_DIR) {
    return path.join(process.env.DPRINT_CACHE_DIR, "cache")
  }

  const platform = os.platform()
  const homeDir = os.homedir()

  if (platform === "win32") {
    const localAppData = process.env.LOCALAPPDATA
      || path.join(homeDir, "AppData", "Local")
    return path.join(localAppData, "dprint", "cache")
  } else if (platform === "darwin") {
    return path.join(homeDir, "Library", "Caches", "dprint", "cache")
  } else {
    return path.join(homeDir, ".cache", "dprint", "cache")
  }
}

/**
 * Create a mock fetch function that returns plugin files from local node_modules
 */
function createMockFetch() {
  return async (url: string | URL | Request) => {
    const urlString = typeof url === "string"
      ? url
      : url instanceof URL
      ? url.toString()
      : url.url

    // Extract plugin name from URL pattern: https://plugins.dprint.dev/{name}-{version}.wasm
    // or: https://plugins.dprint.dev/{org}/{name}-v{version}.wasm
    const match = urlString.match(/\/([a-z_]+)-[v0-9]/)
    if (!match) {
      return new Response(null, { status: 404, statusText: "Not Found" })
    }

    const pluginName = match[1]
    const pluginPath = findLocalPlugin(pluginName)

    if (!pluginPath) {
      return new Response(null, {
        status: 404,
        statusText: `Plugin ${pluginName} not found locally`,
      })
    }

    const buffer = fs.readFileSync(pluginPath)
    return new Response(buffer, {
      status: 200,
      headers: { "Content-Type": "application/wasm" },
    })
  }
}

describe("Remote Plugin Caching", () => {
  const testCacheDir = path.join(os.tmpdir(), "dprint-js-test-cache")
  let originalCacheDir: string | undefined
  let fetchMock: ReturnType<typeof spyOn>

  beforeEach(() => {
    // Set custom cache directory for tests
    originalCacheDir = process.env.DPRINT_CACHE_DIR
    process.env.DPRINT_CACHE_DIR = testCacheDir

    // Clean up test cache directory
    if (fs.existsSync(testCacheDir)) {
      fs.rmSync(testCacheDir, { recursive: true })
    }

    // Mock global fetch
    fetchMock = spyOn(globalThis, "fetch").mockImplementation(
      createMockFetch() as any,
    )
  })

  afterEach(() => {
    // Restore original fetch
    fetchMock.mockRestore()

    // Restore original cache directory
    if (originalCacheDir) {
      process.env.DPRINT_CACHE_DIR = originalCacheDir
    } else {
      delete process.env.DPRINT_CACHE_DIR
    }

    // Clean up test cache directory
    if (fs.existsSync(testCacheDir)) {
      fs.rmSync(testCacheDir, { recursive: true })
    }
  })

  test("downloads and caches a remote plugin", async () => {
    const pluginUrl = "https://plugins.dprint.dev/typescript-0.95.11.wasm"

    // Load plugin for the first time (should download using mock)
    const result = await Formatter.loadPlugin(pluginUrl)

    // Verify fetch was called with the plugin URL
    expect(fetchMock).toHaveBeenCalledWith(pluginUrl)

    expect(result).toBeDefined()
    expect(result.formatter).toBeDefined()
    expect(result.fileMatchingInfo).toBeDefined()
    expect(result.configKey).toBe("typescript")

    // Check that cache directory was created
    const cacheDir = getRemotePluginCacheDir()
    expect(fs.existsSync(cacheDir)).toBe(true)

    // Check that manifest was created
    const manifestPath = path.join(cacheDir, "plugin-cache-manifest.json")
    expect(fs.existsSync(manifestPath)).toBe(true)

    // Read and verify manifest
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"))
    expect(manifest.schemaVersion).toBe(8)
    expect(manifest.plugins).toBeDefined()

    const cacheKey = `remote:${pluginUrl}`
    expect(manifest.plugins[cacheKey]).toBeDefined()
    expect(manifest.plugins[cacheKey].info.name).toBe(
      "dprint-plugin-typescript",
    )
    expect(manifest.plugins[cacheKey].info.version).toBe("0.95.11")
    expect(manifest.plugins[cacheKey].info.configKey).toBe("typescript")
    expect(manifest.plugins[cacheKey].createdTime).toBeDefined()

    // Check that plugin file was created
    const pluginsDir = path.join(
      cacheDir,
      "plugins",
      "dprint-plugin-typescript",
    )
    expect(fs.existsSync(pluginsDir)).toBe(true)

    const files = fs.readdirSync(pluginsDir)
    expect(files.length).toBe(1)
    expect(files[0]).toMatch(/^0\.95\.11-[a-f0-9]+$/)
  })

  test("loads plugin from cache on subsequent calls", async () => {
    const pluginUrl = "https://plugins.dprint.dev/typescript-0.95.11.wasm"

    // First load (downloads)
    await Formatter.loadPlugin(pluginUrl)

    // Get cache directory contents
    const cacheDir = getRemotePluginCacheDir()
    const pluginsDir = path.join(
      cacheDir,
      "plugins",
      "dprint-plugin-typescript",
    )
    const filesBefore = fs.readdirSync(pluginsDir)

    // Wait a bit to ensure timestamp would change if re-downloaded
    await new Promise((resolve) => setTimeout(resolve, 100))

    // Second load (should use cache)
    const result = await Formatter.loadPlugin(pluginUrl)

    expect(result).toBeDefined()
    expect(result.formatter).toBeDefined()
    expect(result.configKey).toBe("typescript")

    // Verify no new files were created
    const filesAfter = fs.readdirSync(pluginsDir)
    expect(filesAfter).toEqual(filesBefore)
  })

  test("caches multiple remote plugins", async () => {
    const plugins = [
      "https://plugins.dprint.dev/typescript-0.95.11.wasm",
      "https://plugins.dprint.dev/markdown-0.19.0.wasm",
    ]

    // Load all plugins
    for (const pluginUrl of plugins) {
      await Formatter.loadPlugin(pluginUrl)
    }

    // Check manifest has both plugins
    const cacheDir = getRemotePluginCacheDir()
    const manifestPath = path.join(cacheDir, "plugin-cache-manifest.json")
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"))

    expect(Object.keys(manifest.plugins).length).toBe(2)

    for (const pluginUrl of plugins) {
      const cacheKey = `remote:${pluginUrl}`
      expect(manifest.plugins[cacheKey]).toBeDefined()
    }

    // Check that all plugin directories were created
    const pluginsDir = path.join(cacheDir, "plugins")
    const pluginDirs = fs.readdirSync(pluginsDir)

    expect(pluginDirs).toContain("dprint-plugin-typescript")
    expect(pluginDirs).toContain("dprint-plugin-markdown")
  })

  test("extracts correct plugin info from URL", async () => {
    const pluginUrl = "https://plugins.dprint.dev/typescript-0.95.11.wasm"
    const result = await Formatter.loadPlugin(pluginUrl)

    expect(result.configKey).toBe("typescript")

    // Verify manifest
    const cacheDir = getRemotePluginCacheDir()
    const manifestPath = path.join(cacheDir, "plugin-cache-manifest.json")
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"))

    const cacheKey = `remote:${pluginUrl}`
    const entry = manifest.plugins[cacheKey]

    expect(entry.info.name).toBe("dprint-plugin-typescript")
    expect(entry.info.version).toBe("0.95.11")
    expect(entry.info.configKey).toBe("typescript")
  })

  test("Formatter.loadPlugins works with mixed npm and remote plugins", async () => {
    const config = {
      typescript: { semiColons: "asi" },
      markdown: {},
      plugins: [
        "@dprint/typescript",
        "https://plugins.dprint.dev/markdown-0.19.0.wasm",
      ],
    }

    const { plugins: loadedPlugins } = await Formatter.loadPlugins(config)

    // Should load both plugins successfully
    expect(loadedPlugins.length).toBe(2)

    // Check that remote plugin was cached
    const cacheDir = getRemotePluginCacheDir()
    const manifestPath = path.join(cacheDir, "plugin-cache-manifest.json")
    expect(fs.existsSync(manifestPath)).toBe(true)

    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"))
    const cacheKey = "remote:https://plugins.dprint.dev/markdown-0.19.0.wasm"
    expect(manifest.plugins[cacheKey]).toBeDefined()
  })

  test("cache directory structure matches dprint conventions", async () => {
    const pluginUrl = "https://plugins.dprint.dev/typescript-0.95.11.wasm"
    await Formatter.loadPlugin(pluginUrl)

    const cacheDir = getRemotePluginCacheDir()

    // Check directory structure
    expect(fs.existsSync(path.join(cacheDir, "plugin-cache-manifest.json")))
      .toBe(true)
    expect(fs.existsSync(path.join(cacheDir, "plugins"))).toBe(true)
    expect(
      fs.existsSync(path.join(cacheDir, "plugins", "dprint-plugin-typescript")),
    )
      .toBe(true)

    // Verify manifest structure
    const manifest = JSON.parse(
      fs.readFileSync(
        path.join(cacheDir, "plugin-cache-manifest.json"),
        "utf-8",
      ),
    )

    expect(manifest).toHaveProperty("schemaVersion")
    expect(manifest).toHaveProperty("plugins")
    expect(typeof manifest.schemaVersion).toBe("number")
    expect(typeof manifest.plugins).toBe("object")

    // Verify plugin entry structure
    const cacheKey = `remote:${pluginUrl}`
    const entry = manifest.plugins[cacheKey]

    expect(entry).toHaveProperty("createdTime")
    expect(entry).toHaveProperty("info")
    expect(entry.info).toHaveProperty("name")
    expect(entry.info).toHaveProperty("version")
    expect(entry.info).toHaveProperty("configKey")
    expect(typeof entry.createdTime).toBe("number")
  })

  test("formatter can format text after loading from cache", async () => {
    const pluginUrl = "https://plugins.dprint.dev/typescript-0.95.11.wasm"

    // First load
    await Formatter.loadPlugin(pluginUrl)

    // Second load from cache
    const result = await Formatter.loadPlugin(pluginUrl)

    // Set config
    result.formatter.setConfig({}, { semiColons: "asi" })

    // Test formatting
    const formatted = result.formatter.formatText({
      filePath: "test.ts",
      fileText: "const x    =    1;",
    })

    expect(formatted).toBe("const x = 1\n")
  })
})
