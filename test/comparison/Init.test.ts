import { $ } from "bun"
import * as t from "bun:test"
import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"
import * as InitCommand from "../../src/commands/InitCommand.ts"
import * as Testing from "../Testing.ts"

const projectRoot = process.cwd()

// Get binary paths
const THEIR_BIN = Testing.THEIR_BIN
const OURS_BIN = Testing.OURS_BIN

let testDir
let oursDir
let theirsDir

t.beforeEach(() => {
  // Create unique test directory in /tmp
  testDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "dprint-test-comparison-init-"),
  )
  oursDir = path.join(testDir, "ours")
  theirsDir = path.join(testDir, "theirs")

  // Create test directories
  fs.mkdirSync(oursDir, { recursive: true })
  fs.mkdirSync(theirsDir, { recursive: true })
})

t.afterEach(() => {
  // Clean up test directory
  if (testDir && fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true })
  }
})

t.it("creates dprint.json with expected structure", async () => {
  // Init with our implementation
  const ourExitCode = await InitCommand.run({ cwd: oursDir })

  // Read our config
  const ourConfigPath = path.join(oursDir, "dprint.json")
  t.expect(fs.existsSync(ourConfigPath)).toBe(true)
  const ourConfig = JSON.parse(fs.readFileSync(ourConfigPath, "utf-8"))

  // Verify structure
  t.expect(ourExitCode).toBe(0)
  t.expect(ourConfig).toHaveProperty("includes")
  t.expect(ourConfig).toHaveProperty("excludes")
  t.expect(ourConfig).toHaveProperty("plugins")
  t.expect(ourConfig).toHaveProperty("typescript")
  t.expect(Array.isArray(ourConfig.includes)).toBe(true)
  t.expect(Array.isArray(ourConfig.excludes)).toBe(true)
  t.expect(Array.isArray(ourConfig.plugins)).toBe(true)
  t.expect(ourConfig.plugins).toContain("@dprint/typescript")
})

t.it("returns exit code 1 when config already exists", async () => {
  // Create existing config
  fs.writeFileSync(path.join(oursDir, "dprint.json"), "{}")
  fs.writeFileSync(path.join(theirsDir, "dprint.json"), "{}")

  // Try to init with our implementation
  const ourExitCode = await InitCommand.run({ cwd: oursDir })

  // Try to init with rust dprint (note: rust dprint uses interactive mode which won't work here)
  // We'll test the exit code behavior directly
  t.expect(ourExitCode).toBe(1)
})

t.it("uses custom config path when provided", async () => {
  const customPath = "custom.dprint.json"

  // Init with custom path using our implementation
  const ourExitCode = await InitCommand.run({
    config: customPath,
    cwd: oursDir,
  })

  // Verify custom config was created
  const customConfigPath = path.join(oursDir, customPath)
  t.expect(fs.existsSync(customConfigPath)).toBe(true)
  t.expect(ourExitCode).toBe(0)

  // Verify default config was not created
  t.expect(fs.existsSync(path.join(oursDir, "dprint.json"))).toBe(false)
})

t.it("creates config with expected default values", async () => {
  // Init with our implementation
  await InitCommand.run({ cwd: oursDir })

  // Read config
  const config = JSON.parse(
    fs.readFileSync(path.join(oursDir, "dprint.json"), "utf-8"),
  )

  // Check default values match dprint standards
  // lineWidth is in plugin config, not top level
  // indentWidth is in plugin config, not top level
  // useTabs is in plugin config, not top level

  // Check default excludes include common patterns
  t.expect(config.excludes).toContain("**/node_modules")

  // Check default includes have glob patterns
  t.expect(config.includes.length).toBeGreaterThan(0)
  t.expect(config.includes.some((p: string) => p.includes("**"))).toBe(true)
})

t.it("creates valid JSON that can be parsed", async () => {
  // Init with our implementation
  await InitCommand.run({ cwd: oursDir })

  // Verify JSON is valid and well-formatted
  const content = fs.readFileSync(path.join(oursDir, "dprint.json"), "utf-8")
  t.expect(() => JSON.parse(content)).not.toThrow()

  // Verify it's formatted with indentation
  t.expect(content).toContain("  ") // Has indentation
  t.expect(content.split("\n").length).toBeGreaterThan(5) // Multi-line
})

t.it("overwrites config only with custom plugins when specified", async () => {
  const customPlugins = ["@dprint/typescript"]

  // Init with custom plugins
  await InitCommand.run({ plugins: customPlugins, cwd: oursDir })

  // Read config
  const config = JSON.parse(
    fs.readFileSync(path.join(oursDir, "dprint.json"), "utf-8"),
  )

  // Verify plugins were overridden
  t.expect(config.plugins).toEqual(customPlugins)

  // Verify other properties still exist
  t.expect(config).toHaveProperty("typescript")
  t.expect(config).toHaveProperty("includes")
  t.expect(config).toHaveProperty("excludes")
})

t.it("creates config compatible with rust dprint format", async () => {
  // Init with our implementation
  await InitCommand.run({ cwd: oursDir })

  // Read our config
  const ourConfig = JSON.parse(
    fs.readFileSync(path.join(oursDir, "dprint.json"), "utf-8"),
  )

  // Modify to use URL-based plugins (like rust dprint) - only TypeScript for comparison
  ourConfig.plugins = [
    "https://plugins.dprint.dev/typescript-0.93.0.wasm",
  ]
  // Remove plugin config sections for plugins we're not using
  delete ourConfig.json
  delete ourConfig.markdown

  // Write modified config to theirs directory
  fs.writeFileSync(
    path.join(theirsDir, "dprint.json"),
    JSON.stringify(ourConfig, null, 2),
  )

  // Create a test file
  fs.writeFileSync(path.join(theirsDir, "test.ts"), "const   x=1;")

  // Verify rust dprint can use the config (should not error)
  const result = await $`${THEIR_BIN} fmt --log-level silent`
    .cwd(theirsDir)
    .nothrow()
    .quiet()

  // Should succeed (exit code 0)
  t.expect(result.exitCode).toBe(0)

  // File should be formatted
  const formatted = fs.readFileSync(path.join(theirsDir, "test.ts"), "utf-8")
  t.expect(formatted).toContain("const x = 1")
})

// Error tests
t.it("handles invalid custom config path gracefully", async () => {
  // Try to create config in non-existent directory
  const invalidPath = "non-existent-dir/dprint.json"

  const ourExitCode = await InitCommand.run({
    config: invalidPath,
    cwd: oursDir,
    logLevel: "silent",
  })

  // Should fail with error exit code
  t.expect(ourExitCode).toBeGreaterThan(0)

  // Verify config was not created
  t.expect(fs.existsSync(path.join(oursDir, invalidPath))).toBe(false)
})

t.it("handles empty plugins array", async () => {
  // Create config with empty plugins array
  const emptyPluginsConfig = {
    includes: ["**/*.ts"],
    excludes: ["**/node_modules"],
    plugins: [],
  }

  fs.writeFileSync(
    path.join(oursDir, "test-config.json"),
    JSON.stringify(emptyPluginsConfig, null, 2),
  )
  fs.writeFileSync(
    path.join(theirsDir, "test-config.json"),
    JSON.stringify(emptyPluginsConfig, null, 2),
  )

  // Create test files
  fs.writeFileSync(path.join(oursDir, "test.ts"), "const x=1;")
  fs.writeFileSync(path.join(theirsDir, "test.ts"), "const x=1;")

  // Both should handle empty plugins similarly (likely as error)
  const ourResult =
    await $`${OURS_BIN} check --config test-config.json --log-level silent`
      .cwd(oursDir)
      .nothrow()
      .quiet()

  const theirResult =
    await $`${THEIR_BIN} check --config test-config.json --log-level silent`
      .cwd(theirsDir)
      .nothrow()
      .quiet()

  // Both should fail or succeed in the same way
  t.expect(ourResult.exitCode).toBe(theirResult.exitCode)
})
