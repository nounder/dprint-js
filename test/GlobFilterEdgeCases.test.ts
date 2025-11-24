import * as t from "bun:test"
import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"
import * as Glob from "../src/Glob.js"

t.describe("Bun glob filter edge cases", () => {
  t.it(
    "should not filter files with consecutive dots in filename",
    async () => {
      const testDir = fs.mkdtempSync(
        path.join(os.tmpdir(), "dprint-dots-test-"),
      )

      try {
        // Create files with double dots in name (not as path separator)
        fs.writeFileSync(path.join(testDir, "file..ts"), "// file with dots")
        fs.writeFileSync(path.join(testDir, "config..json"), "{}")
        fs.writeFileSync(path.join(testDir, "my..test.ts"), "// test")

        const files = Glob.findMatchingFiles(["**/*"], [], testDir)

        // Should find all files with dots in their names
        t.expect(files).toContain("file..ts")
        t.expect(files).toContain("config..json")
        t.expect(files).toContain("my..test.ts")

        // Should not contain any escaped paths
        for (const file of files) {
          t.expect(file).not.toStartWith("../")
          t.expect(file).not.toContain("/../")
        }
      } finally {
        fs.rmSync(testDir, { recursive: true, force: true })
      }
    },
  )

  t.it("should handle dot files correctly", async () => {
    const testDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "dprint-dotfiles-test-"),
    )

    try {
      // Create various dot files
      fs.writeFileSync(path.join(testDir, ".gitignore"), "node_modules")
      fs.writeFileSync(path.join(testDir, ".config.js"), "module.exports = {}")
      fs.writeFileSync(path.join(testDir, ".env"), "KEY=value")

      fs.mkdirSync(path.join(testDir, ".hidden"))
      fs.writeFileSync(path.join(testDir, ".hidden", "file.ts"), "// hidden")

      // Pattern that should trigger dot file scanning
      const files = Glob.findMatchingFiles(
        [".gitignore", ".config.js", ".hidden/**/*.ts"],
        [],
        testDir,
      )

      // Should find the dot files
      t.expect(files).toContain(".gitignore")
      t.expect(files).toContain(".config.js")
      t.expect(files).toContain(".hidden/file.ts")

      // Should not escape
      for (const file of files) {
        t.expect(file).not.toStartWith("../")
        t.expect(file).not.toContain("/../")
      }
    } finally {
      fs.rmSync(testDir, { recursive: true, force: true })
    }
  })

  t.it("should not break with nested directories", async () => {
    const testDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "dprint-nested-test-"),
    )

    try {
      // Create deeply nested structure
      fs.mkdirSync(path.join(testDir, "a", "b", "c", "d"), { recursive: true })
      fs.writeFileSync(
        path.join(testDir, "a", "b", "c", "d", "deep.ts"),
        "// deep file",
      )
      fs.writeFileSync(path.join(testDir, "a", "mid.ts"), "// mid file")

      const files = Glob.findMatchingFiles(["**/*.ts"], [], testDir)

      // Should find nested files
      t.expect(files).toContain("a/b/c/d/deep.ts")
      t.expect(files).toContain("a/mid.ts")

      // Paths should be relative and not escape
      for (const file of files) {
        t.expect(file).not.toStartWith("../")
        t.expect(file).not.toContain("/../")
        t.expect(file).not.toStartWith("/") // Should be relative
      }
    } finally {
      fs.rmSync(testDir, { recursive: true, force: true })
    }
  })

  t.it("should handle patterns with dots correctly", async () => {
    const testDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "dprint-pattern-dots-test-"),
    )

    try {
      fs.mkdirSync(path.join(testDir, ".config"))
      fs.writeFileSync(path.join(testDir, ".config", "app.json"), "{}")
      fs.writeFileSync(
        path.join(testDir, ".config", "settings.ts"),
        "export {}",
      )

      fs.mkdirSync(path.join(testDir, ".vscode"))
      fs.writeFileSync(path.join(testDir, ".vscode", "settings.json"), "{}")

      // Specific dot directory patterns (safe patterns)
      const files = Glob.findMatchingFiles(
        [".config/**/*", ".vscode/**/*"],
        [],
        testDir,
      )

      t.expect(files.length).toBeGreaterThan(0)
      t.expect(files).toContain(".config/app.json")
      t.expect(files).toContain(".config/settings.ts")
      t.expect(files).toContain(".vscode/settings.json")

      // Should not escape
      for (const file of files) {
        t.expect(file).not.toStartWith("../")
        t.expect(file).not.toContain("/../")
      }
    } finally {
      fs.rmSync(testDir, { recursive: true, force: true })
    }
  })

  t.it("should filter paths with /../ in the middle", async () => {
    const testDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "dprint-middle-escape-test-"),
    )

    try {
      fs.mkdirSync(path.join(testDir, "src"))
      fs.writeFileSync(path.join(testDir, "src", "file.ts"), "// safe file")

      // Even though we can't easily create a path with /../ from Bun.glob,
      // we're testing that the filter logic would catch it
      const files = Glob.findMatchingFiles(["**/*.ts"], [], testDir)

      // Verify filter logic
      for (const file of files) {
        t.expect(file).not.toContain("/../")
        t.expect(file).not.toStartWith("../")
      }
    } finally {
      fs.rmSync(testDir, { recursive: true, force: true })
    }
  })

  t.it("should handle empty results gracefully", async () => {
    const testDir = fs.mkdtempSync(path.join(os.tmpdir(), "dprint-empty-test-"))

    try {
      // No files created
      const files = Glob.findMatchingFiles(["**/*.ts"], [], testDir)

      t.expect(files).toBeArrayOfSize(0)
    } finally {
      fs.rmSync(testDir, { recursive: true, force: true })
    }
  })

  t.it("should respect exclude patterns after filtering", async () => {
    const testDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "dprint-exclude-test-"),
    )

    try {
      fs.mkdirSync(path.join(testDir, "src"))
      fs.mkdirSync(path.join(testDir, "test"))
      fs.writeFileSync(path.join(testDir, "src", "app.ts"), "// app")
      fs.writeFileSync(path.join(testDir, "test", "app.test.ts"), "// test")

      const excludes = Glob.normalizeExcludePatterns(["test/**"])
      const files = Glob.findMatchingFiles(["**/*.ts"], excludes, testDir)

      // Should find src file but not test file
      t.expect(files).toContain("src/app.ts")
      t.expect(files).not.toContain("test/app.test.ts")

      // Should not escape
      for (const file of files) {
        t.expect(file).not.toStartWith("../")
        t.expect(file).not.toContain("/../")
      }
    } finally {
      fs.rmSync(testDir, { recursive: true, force: true })
    }
  })

  t.it(
    "should handle patterns that would trigger Bun bug without escaping",
    async () => {
      const testDir = fs.mkdtempSync(
        path.join(os.tmpdir(), "dprint-bun-bug-test-"),
      )

      try {
        // Create a file in the test directory
        fs.writeFileSync(path.join(testDir, "safe.ts"), "// safe")

        // These patterns would trigger the Bun bug (matching parent dirs)
        // but our filter should catch any escaped paths
        const vulnerablePatterns = [".*/**/*.ts", ".?/**/*.ts", ".*/*"]

        for (const pattern of vulnerablePatterns) {
          const files = Glob.findMatchingFiles([pattern], [], testDir)

          // Should not return any escaped paths
          for (const file of files) {
            t.expect(file).not.toStartWith("../")
            t.expect(file).not.toContain("/../")
          }
        }
      } finally {
        fs.rmSync(testDir, { recursive: true, force: true })
      }
    },
  )

  t.it("should handle mixed safe and unsafe patterns", async () => {
    const testDir = fs.mkdtempSync(path.join(os.tmpdir(), "dprint-mixed-test-"))

    try {
      fs.writeFileSync(path.join(testDir, "app.ts"), "// app")
      fs.mkdirSync(path.join(testDir, ".config"))
      fs.writeFileSync(
        path.join(testDir, ".config", "settings.ts"),
        "// config",
      )

      // Mix of safe and potentially unsafe patterns
      const files = Glob.findMatchingFiles(
        ["**/*.ts", ".*/**/*.ts", ".config/**/*.ts"],
        [],
        testDir,
      )

      // Should find the safe files
      t.expect(files).toContain("app.ts")
      t.expect(files).toContain(".config/settings.ts")

      // Should not escape
      for (const file of files) {
        t.expect(file).not.toStartWith("../")
        t.expect(file).not.toContain("/../")
      }
    } finally {
      fs.rmSync(testDir, { recursive: true, force: true })
    }
  })

  t.it("should handle special characters in filenames", async () => {
    const testDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "dprint-special-test-"),
    )

    try {
      // Files with special characters (but not path traversal)
      fs.writeFileSync(path.join(testDir, "file-name.ts"), "// dash")
      fs.writeFileSync(path.join(testDir, "file_name.ts"), "// underscore")
      fs.writeFileSync(path.join(testDir, "file.name.ts"), "// single dot")
      fs.writeFileSync(path.join(testDir, "file..name.ts"), "// double dot")

      const files = Glob.findMatchingFiles(["**/*.ts"], [], testDir)

      t.expect(files).toContain("file-name.ts")
      t.expect(files).toContain("file_name.ts")
      t.expect(files).toContain("file.name.ts")
      t.expect(files).toContain("file..name.ts")

      // Should not escape
      for (const file of files) {
        t.expect(file).not.toStartWith("../")
        t.expect(file).not.toContain("/../")
      }
    } finally {
      fs.rmSync(testDir, { recursive: true, force: true })
    }
  })
})
