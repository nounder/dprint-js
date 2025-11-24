import * as t from "bun:test"
import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"
import * as Files from "../src/Files.js"

t.it("security: vulnerable glob patterns are silently filtered", async () => {
  const testDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "dprint-security-test-"),
  )

  try {
    // Create test structure
    fs.mkdirSync(path.join(testDir, "project"))
    fs.writeFileSync(path.join(testDir, "project", "safe.ts"), "// safe file")
    fs.writeFileSync(path.join(testDir, "outside.ts"), "// outside file")

    // Test 1: Vulnerable pattern .*/**/*.ts should not escape
    const config1 = {
      includes: [".*/**/*.ts"],
      excludes: [],
    }

    const files1 = await Files.findFiles(
      config1,
      [],
      path.join(testDir, "project"),
    )

    // Should NOT include files outside the project directory
    for (const file of files1) {
      t.expect(file).not.toStartWith("../")
      t.expect(file).not.toContain("/../")
    }

    // Test 2: Safe pattern should work normally
    fs.writeFileSync(path.join(testDir, "project", ".config.ts"), "// config")

    const config2 = {
      includes: [".config.ts"],
      excludes: [],
    }

    const files2 = await Files.findFiles(
      config2,
      [],
      path.join(testDir, "project"),
    )

    // Should find the .config.ts file
    t.expect(files2).toContain(".config.ts")

    // Test 3: Other vulnerable patterns should be filtered
    const vulnerablePatterns = [".?/**/*.ts", ".+/**/*.ts", ".*/*"]

    for (const pattern of vulnerablePatterns) {
      const config = { includes: [pattern], excludes: [] }
      const files = await Files.findFiles(
        config,
        [],
        path.join(testDir, "project"),
      )

      // Should not escape
      for (const file of files) {
        t.expect(file).not.toStartWith("../")
        t.expect(file).not.toContain("/../")
      }
    }
  } finally {
    // Cleanup
    fs.rmSync(testDir, { recursive: true, force: true })
  }
})

t.it("security: normal patterns work correctly", async () => {
  const testDir = fs.mkdtempSync(path.join(os.tmpdir(), "dprint-normal-test-"))

  try {
    fs.mkdirSync(path.join(testDir, ".git"))
    fs.writeFileSync(path.join(testDir, ".git", "config"), "")
    fs.writeFileSync(path.join(testDir, "file.ts"), "")

    const safePatterns = [
      "**/*.ts",
      ".git/**/*",
      "./**/*.ts",
      "src/**/*.ts",
    ]

    for (const pattern of safePatterns) {
      const config = { includes: [pattern], excludes: [] }
      const files = await Files.findFiles(config, [], testDir)

      // Should not include escaped paths
      for (const file of files) {
        t.expect(file).not.toStartWith("../")
        t.expect(file).not.toContain("/../")
      }
    }
  } finally {
    fs.rmSync(testDir, { recursive: true, force: true })
  }
})
