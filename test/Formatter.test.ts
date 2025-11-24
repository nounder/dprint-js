import * as t from "bun:test"
import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"
import * as Formatter from "../src/Formatter.ts"

t.it("loads @dprint/typescript plugin successfully", async () => {
  const result = await Formatter.loadPlugin("@dprint/typescript")

  t.expect(result).toBeDefined()
  t.expect(result.formatter).toBeDefined()
  t.expect(result.fileMatchingInfo).toBeDefined()
  t.expect(result.fileMatchingInfo.fileExtensions).toContain("ts")
  t.expect(result.fileMatchingInfo.fileExtensions).toContain("js")
})

t.it("loads @dprint/json plugin successfully", async () => {
  const result = await Formatter.loadPlugin("@dprint/json")

  t.expect(result).toBeDefined()
  t.expect(result.formatter).toBeDefined()
  t.expect(result.fileMatchingInfo.fileExtensions).toContain("json")
})

t.it("loads @dprint/markdown plugin successfully", async () => {
  const result = await Formatter.loadPlugin("@dprint/markdown")

  t.expect(result).toBeDefined()
  t.expect(result.formatter).toBeDefined()
  t.expect(result.fileMatchingInfo.fileExtensions).toContain("md")
  t.expect(result.fileMatchingInfo.fileExtensions).toContain("markdown")
})

t.it("throws error for non-existent plugin", async () => {
  t
    .expect(async () => {
      await Formatter.loadPlugin("@dprint/nonexistent")
    })
    .toThrow()
})

t.it("throws error for invalid plugin package", async () => {
  t
    .expect(async () => {
      await Formatter.loadPlugin("invalid-plugin-name")
    })
    .toThrow()
})

t.it("loads all plugins from config", async () => {
  const config = {
    plugins: ["@dprint/typescript", "@dprint/json", "@dprint/markdown"],
    typescript: {},
    json: {},
    markdown: {},
  }

  const { plugins } = await Formatter.loadPlugins(config)

  t.expect(plugins.length).toBe(3)
  t.expect(plugins[0].name).toBe("@dprint/typescript")
  t.expect(plugins[1].name).toBe("@dprint/json")
  t.expect(plugins[2].name).toBe("@dprint/markdown")
})

t.it("handles missing plugin gracefully", async () => {
  const config = {
    plugins: ["@dprint/typescript", "@dprint/nonexistent", "@dprint/json"],
    typescript: {},
    json: {},
  }

  const { plugins } = await Formatter.loadPlugins(config)

  // Should load 2 plugins (typescript and json), skip the nonexistent one
  t.expect(plugins.length).toBe(2)
})

t.it(
  "returns empty array when no plugins specified and no package.json",
  async () => {
    // Create a unique temp directory without package.json
    const uniqueTempDir = path.join(
      process.cwd(),
      "test-tmp-no-plugins-" + Date.now(),
    )
    if (!fs.existsSync(uniqueTempDir)) {
      fs.mkdirSync(uniqueTempDir, { recursive: true })
    }
    const configPath = path.join(uniqueTempDir, "dprint.json")
    fs.writeFileSync(configPath, JSON.stringify({ plugins: [] }))

    const config = { plugins: [] }
    const result = await Formatter.loadPlugins(
      config,
      uniqueTempDir,
      configPath,
    )
    const plugins = result.plugins

    t.expect(plugins.length).toBe(0)

    // Cleanup
    fs.rmSync(uniqueTempDir, { recursive: true, force: true })
  },
)

t.it(
  "auto-loads plugins from package.json when plugins key missing",
  async () => {
    // When no plugins specified, should auto-discover from package.json
    const config = {}
    const { plugins } = await Formatter.loadPlugins(config)

    // Should find the plugins from the project's package.json
    t.expect(plugins.length).toBeGreaterThan(0)
  },
)

t.it("returns typescript formatter for .ts files", async () => {
  const config = {
    plugins: ["@dprint/typescript", "@dprint/json", "@dprint/markdown"],
    typescript: {},
    json: {},
    markdown: {},
  }
  const { plugins: loadedPlugins } = await Formatter.loadPlugins(config)
  const formatter = Formatter.getFormatterForFile("test.ts", loadedPlugins)
  t.expect(formatter).toBeDefined()
})

t.it("returns typescript formatter for .js files", async () => {
  const config = {
    plugins: ["@dprint/typescript", "@dprint/json", "@dprint/markdown"],
    typescript: {},
    json: {},
    markdown: {},
  }
  const { plugins: loadedPlugins } = await Formatter.loadPlugins(config)
  const formatter = Formatter.getFormatterForFile("test.js", loadedPlugins)
  t.expect(formatter).toBeDefined()
})

t.it("returns typescript formatter for .tsx files", async () => {
  const config = {
    plugins: ["@dprint/typescript", "@dprint/json", "@dprint/markdown"],
    typescript: {},
    json: {},
    markdown: {},
  }
  const { plugins: loadedPlugins } = await Formatter.loadPlugins(config)
  const formatter = Formatter.getFormatterForFile("test.tsx", loadedPlugins)
  t.expect(formatter).toBeDefined()
})

t.it("returns json formatter for .json files", async () => {
  const config = {
    plugins: ["@dprint/typescript", "@dprint/json", "@dprint/markdown"],
    typescript: {},
    json: {},
    markdown: {},
  }
  const { plugins: loadedPlugins } = await Formatter.loadPlugins(config)
  const formatter = Formatter.getFormatterForFile("test.json", loadedPlugins)
  t.expect(formatter).toBeDefined()
})

t.it("returns markdown formatter for .md files", async () => {
  const config = {
    plugins: ["@dprint/typescript", "@dprint/json", "@dprint/markdown"],
    typescript: {},
    json: {},
    markdown: {},
  }
  const { plugins: loadedPlugins } = await Formatter.loadPlugins(config)
  const formatter = Formatter.getFormatterForFile("test.md", loadedPlugins)
  t.expect(formatter).toBeDefined()
})

t.it("returns markdown formatter for .markdown files", async () => {
  const config = {
    plugins: ["@dprint/typescript", "@dprint/json", "@dprint/markdown"],
    typescript: {},
    json: {},
    markdown: {},
  }
  const { plugins: loadedPlugins } = await Formatter.loadPlugins(config)
  const formatter = Formatter.getFormatterForFile(
    "test.markdown",
    loadedPlugins,
  )
  t.expect(formatter).toBeDefined()
})

t.it("returns null for unsupported file types", async () => {
  const config = {
    plugins: ["@dprint/typescript", "@dprint/json", "@dprint/markdown"],
    typescript: {},
    json: {},
    markdown: {},
  }
  const { plugins: loadedPlugins } = await Formatter.loadPlugins(config)
  const formatter = Formatter.getFormatterForFile("test.txt", loadedPlugins)
  t.expect(formatter).toBeNull()
})

t.it("returns null for files without extension", async () => {
  const config = {
    plugins: ["@dprint/typescript", "@dprint/json", "@dprint/markdown"],
    typescript: {},
    json: {},
    markdown: {},
  }
  const { plugins: loadedPlugins } = await Formatter.loadPlugins(config)
  const formatter = Formatter.getFormatterForFile("README", loadedPlugins)
  t.expect(formatter).toBeNull()
})

t.it("formats TypeScript code correctly", async () => {
  const config = {
    plugins: ["@dprint/typescript", "@dprint/json"],
    typescript: {},
    json: {},
  }
  const { plugins: loadedPlugins } = await Formatter.loadPlugins(config)
  const formatter = Formatter.getFormatterForFile("test.ts", loadedPlugins)
  const input = "const   x=1"
  const output = Formatter.formatText("test.ts", input, formatter!)

  t.expect(output).toBe("const x = 1;\n")
})

t.it("formats JSON correctly", async () => {
  const config = {
    plugins: ["@dprint/typescript", "@dprint/json"],
    typescript: {},
    json: {},
  }
  const { plugins: loadedPlugins } = await Formatter.loadPlugins(config)
  const formatter = Formatter.getFormatterForFile("test.json", loadedPlugins)
  const input = "{\"a\":1,\"b\":2}"
  const output = Formatter.formatText("test.json", input, formatter!)

  t.expect(output).toContain("\"a\"")
  t.expect(output).toContain("\"b\"")
  // JSON should be formatted with proper spacing
  t.expect(output.length).toBeGreaterThan(input.length)
})

t.it("returns same text if already formatted", async () => {
  const config = {
    plugins: ["@dprint/typescript", "@dprint/json"],
    typescript: {},
    json: {},
  }
  const { plugins: loadedPlugins } = await Formatter.loadPlugins(config)
  const formatter = Formatter.getFormatterForFile("test.ts", loadedPlugins)
  const input = "const x = 1;\n"
  const output = Formatter.formatText("test.ts", input, formatter!)

  t.expect(output).toBe(input)
})

const projectRoot = process.cwd()
const dataDir = path.join(projectRoot, "test/fixtures")

let testDir: string
let loadedPlugins: any[]
const config = {
  plugins: ["@dprint/typescript", "@dprint/json", "@dprint/markdown"],
  typescript: {},
  json: {},
  markdown: {},
}

t.beforeAll(async () => {
  // Create unique test directory in /tmp
  testDir = fs.mkdtempSync(path.join(os.tmpdir(), "dprint-test-formatter-"))
  const { plugins } = await Formatter.loadPlugins(config)
  loadedPlugins = plugins
})

t.afterAll(() => {
  // Clean up test directory
  if (testDir && fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true })
  }
})

t.it("formats Async.ts to match expected output", async () => {
  const actualPath = path.join(dataDir, "Async.actual.ts")
  const expectedPath = path.join(dataDir, "Async.expected.ts")
  const tempPath = path.join(testDir, "Async.ts")

  // Copy actual to temp
  fs.copyFileSync(actualPath, tempPath)

  // Format the file
  const result = await Formatter.formatFile(
    tempPath,
    loadedPlugins,
    config,
    false,
  )

  t.expect(result.formatted).toBe(true)
  t.expect(result.error).toBeNull()

  // Compare with expected
  const formatted = fs.readFileSync(tempPath, "utf-8")
  const expected = fs.readFileSync(expectedPath, "utf-8")
  t.expect(formatted).toBe(expected)
})

t.it("formats Classes.ts to match expected output", async () => {
  const actualPath = path.join(dataDir, "Classes.actual.ts")
  const expectedPath = path.join(dataDir, "Classes.expected.ts")
  const tempPath = path.join(testDir, "Classes.ts")

  fs.copyFileSync(actualPath, tempPath)
  const result = await Formatter.formatFile(
    tempPath,
    loadedPlugins,
    config,
    false,
  )

  t.expect(result.formatted).toBe(true)
  const formatted = fs.readFileSync(tempPath, "utf-8")
  const expected = fs.readFileSync(expectedPath, "utf-8")
  t.expect(formatted).toBe(expected)
})

t.it("formats Sample.ts to match expected output", async () => {
  const actualPath = path.join(dataDir, "Sample.actual.ts")
  const expectedPath = path.join(dataDir, "Sample.expected.ts")
  const tempPath = path.join(testDir, "Sample.ts")

  fs.copyFileSync(actualPath, tempPath)
  const result = await Formatter.formatFile(
    tempPath,
    loadedPlugins,
    config,
    false,
  )

  t.expect(result.formatted).toBe(true)
  const formatted = fs.readFileSync(tempPath, "utf-8")
  const expected = fs.readFileSync(expectedPath, "utf-8")
  t.expect(formatted).toBe(expected)
})

t.it("formats Config.json to match expected output", async () => {
  const actualPath = path.join(dataDir, "Config.actual.json")
  const expectedPath = path.join(dataDir, "Config.expected.json")
  const tempPath = path.join(testDir, "Config.json")

  fs.copyFileSync(actualPath, tempPath)
  const result = await Formatter.formatFile(
    tempPath,
    loadedPlugins,
    config,
    false,
  )

  t.expect(result.formatted).toBe(true)
  const formatted = fs.readFileSync(tempPath, "utf-8")
  const expected = fs.readFileSync(expectedPath, "utf-8")
  t.expect(formatted).toBe(expected)
})

t.it("formats Users.json to match expected output", async () => {
  const actualPath = path.join(dataDir, "Users.actual.json")
  const expectedPath = path.join(dataDir, "Users.expected.json")
  const tempPath = path.join(testDir, "Users.json")

  fs.copyFileSync(actualPath, tempPath)
  const result = await Formatter.formatFile(
    tempPath,
    loadedPlugins,
    config,
    false,
  )

  t.expect(result.formatted).toBe(true)
  const formatted = fs.readFileSync(tempPath, "utf-8")
  const expected = fs.readFileSync(expectedPath, "utf-8")
  t.expect(formatted).toBe(expected)
})

t.it("formats Sample.json to match expected output", async () => {
  const actualPath = path.join(dataDir, "Sample.actual.json")
  const expectedPath = path.join(dataDir, "Sample.expected.json")
  const tempPath = path.join(testDir, "Sample.json")

  fs.copyFileSync(actualPath, tempPath)
  const result = await Formatter.formatFile(
    tempPath,
    loadedPlugins,
    config,
    false,
  )

  t.expect(result.formatted).toBe(true)
  const formatted = fs.readFileSync(tempPath, "utf-8")
  const expected = fs.readFileSync(expectedPath, "utf-8")
  t.expect(formatted).toBe(expected)
})

t.it("formats Api.md to match expected output", async () => {
  const actualPath = path.join(dataDir, "Api.actual.md")
  const expectedPath = path.join(dataDir, "Api.expected.md")
  const tempPath = path.join(testDir, "Api.md")

  fs.copyFileSync(actualPath, tempPath)
  const result = await Formatter.formatFile(
    tempPath,
    loadedPlugins,
    config,
    false,
  )

  t.expect(result.formatted).toBe(true)
  const formatted = fs.readFileSync(tempPath, "utf-8")
  const expected = fs.readFileSync(expectedPath, "utf-8")
  t.expect(formatted).toBe(expected)
})

t.it("formats Guide.md to match expected output", async () => {
  const actualPath = path.join(dataDir, "Guide.actual.md")
  const expectedPath = path.join(dataDir, "Guide.expected.md")
  const tempPath = path.join(testDir, "Guide.md")

  fs.copyFileSync(actualPath, tempPath)
  const result = await Formatter.formatFile(
    tempPath,
    loadedPlugins,
    config,
    false,
  )

  t.expect(result.formatted).toBe(true)
  const formatted = fs.readFileSync(tempPath, "utf-8")
  const expected = fs.readFileSync(expectedPath, "utf-8")
  t.expect(formatted).toBe(expected)
})

t.it("formats Sample.md to match expected output", async () => {
  const actualPath = path.join(dataDir, "Sample.actual.md")
  const expectedPath = path.join(dataDir, "Sample.expected.md")
  const tempPath = path.join(testDir, "Sample.md")

  fs.copyFileSync(actualPath, tempPath)
  const result = await Formatter.formatFile(
    tempPath,
    loadedPlugins,
    config,
    false,
  )

  t.expect(result.formatted).toBe(true)
  const formatted = fs.readFileSync(tempPath, "utf-8")
  const expected = fs.readFileSync(expectedPath, "utf-8")
  t.expect(formatted).toBe(expected)
})
