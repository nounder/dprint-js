import * as t from "bun:test"
import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"
import * as CheckCommand from "../src/commands/CheckCommand.ts"

let testDir
let configPath

t.beforeEach(() => {
  // Create unique test directory in /tmp
  testDir = fs.mkdtempSync(path.join(os.tmpdir(), "dprint-test-check-"))
  configPath = path.join(testDir, "dprint.json")

  // Create a valid dprint.json
  const config = {
    $schema: "https://dprint.dev/schemas/v0.json",
    includes: ["**/*.{ts,js,json,md}"],
    excludes: ["**/node_modules", "dprint.json"],
    plugins: ["@dprint/typescript", "@dprint/json", "@dprint/markdown"],
    typescript: {},
    json: {},
    markdown: {},
  }
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2))
})

t.afterEach(() => {
  // Clean up test directory
  if (testDir && fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true })
  }
})

t.it("passes for correctly formatted TypeScript files", async () => {
  const filePath = path.join(testDir, "test.ts")
  fs.writeFileSync(filePath, "const x = 1;\n")

  const exitCode = await CheckCommand.run({ cwd: testDir })

  t.expect(exitCode).toBe(0)
})

t.it("fails for unformatted TypeScript files", async () => {
  const filePath = path.join(testDir, "test.ts")
  fs.writeFileSync(filePath, "const   x=1")

  const exitCode = await CheckCommand.run({ cwd: testDir })

  t.expect(exitCode).toBe(20)
})

t.it("fails for unformatted JSON files", async () => {
  const filePath = path.join(testDir, "test.json")
  fs.writeFileSync(filePath, "{\"a\":1,\"b\":2}")

  const exitCode = await CheckCommand.run({ cwd: testDir })

  t.expect(exitCode).toBe(20)
})

t.it("passes when all files are formatted", async () => {
  fs.writeFileSync(path.join(testDir, "test1.ts"), "const a = 1;\n")
  fs.writeFileSync(path.join(testDir, "test2.ts"), "const b = 2;\n")
  fs.writeFileSync(path.join(testDir, "test3.ts"), "const c = 3;\n")

  const exitCode = await CheckCommand.run({ cwd: testDir })

  t.expect(exitCode).toBe(0)
})

t.it("fails when any file is unformatted", async () => {
  fs.writeFileSync(path.join(testDir, "test1.ts"), "const a = 1;\n")
  fs.writeFileSync(path.join(testDir, "test2.ts"), "const   b=2") // Unformatted
  fs.writeFileSync(path.join(testDir, "test3.ts"), "const c = 3;\n")

  const exitCode = await CheckCommand.run({ cwd: testDir })

  t.expect(exitCode).toBe(20)
})

t.it("does not modify files during check", async () => {
  const filePath = path.join(testDir, "test.ts")
  const unformatted = "const   x=1"
  fs.writeFileSync(filePath, unformatted)

  await CheckCommand.run({ cwd: testDir })

  // File should remain unchanged
  t.expect(fs.readFileSync(filePath, "utf-8")).toBe(unformatted)
})

t.it("checks only specified file patterns", async () => {
  fs.writeFileSync(path.join(testDir, "test.ts"), "const   a=1") // Unformatted
  fs.writeFileSync(path.join(testDir, "test.json"), "{\"x\":1}") // Would fail if checked

  const exitCode = await CheckCommand.run({
    filePatterns: ["*.json"],
    cwd: testDir,
  })

  // Should fail because JSON file is not formatted
  t.expect(exitCode).toBe(20)
})

t.it("returns 14 when no files found", async () => {
  const exitCode = await CheckCommand.run({ cwd: testDir })

  t.expect(exitCode).toBe(14)
})

t.it("returns 0 when no files found with --allow-no-files", async () => {
  const exitCode = await CheckCommand.run({ allowNoFiles: true, cwd: testDir })

  t.expect(exitCode).toBe(0)
})

t.it("returns 11 when no config file found", async () => {
  // Use isolated directory without config
  const isolatedDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "dprint-test-noconfig-"),
  )

  try {
    const exitCode = await CheckCommand.run({ cwd: isolatedDir })
    t.expect(exitCode).toBe(11) // Config error exit code
  } finally {
    if (fs.existsSync(isolatedDir)) {
      fs.rmSync(isolatedDir, { recursive: true, force: true })
    }
  }
})

t.it("respects exclude patterns", async () => {
  const nodeModulesDir = path.join(testDir, "node_modules")
  fs.mkdirSync(nodeModulesDir)
  fs.writeFileSync(path.join(nodeModulesDir, "lib.ts"), "const   x=1") // Unformatted but excluded
  fs.writeFileSync(path.join(testDir, "src.ts"), "const y = 2;\n") // Formatted

  const exitCode = await CheckCommand.run({ cwd: testDir })

  // Should pass because unformatted file is in node_modules (excluded)
  t.expect(exitCode).toBe(0)
})

t.it("handles nested directories", async () => {
  const nestedDir = path.join(testDir, "src", "utils")
  fs.mkdirSync(nestedDir, { recursive: true })
  fs.writeFileSync(path.join(nestedDir, "helper.ts"), "const x = 1;\n")

  const exitCode = await CheckCommand.run({ cwd: testDir })

  t.expect(exitCode).toBe(0)
})

t.it("fails for multiple unformatted files", async () => {
  fs.writeFileSync(path.join(testDir, "test1.ts"), "const   a=1")
  fs.writeFileSync(path.join(testDir, "test2.ts"), "const   b=2")
  fs.writeFileSync(path.join(testDir, "test3.ts"), "const   c=3")

  const exitCode = await CheckCommand.run({ cwd: testDir })

  t.expect(exitCode).toBe(20)
})
