import * as t from "bun:test"
import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"
import * as FmtCommand from "../src/commands/FmtCommand.ts"

let testDir

t.beforeEach(() => {
  // Create unique test directory in /tmp
  testDir = fs.mkdtempSync(path.join(os.tmpdir(), "dprint-test-glob-patterns-"))
})

t.afterEach(() => {
  // Clean up test directory
  if (testDir && fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true })
  }
})

t.describe("exclude patterns", () => {
  t.it("directory with trailing slash excludes all contents", async () => {
    // Create directory structure
    fs.mkdirSync(path.join(testDir, "tree", "nested"), { recursive: true })
    fs.mkdirSync(path.join(testDir, "other"), { recursive: true })

    // Create files
    fs.writeFileSync(path.join(testDir, "file1.ts"), "const x = 1;")
    fs.writeFileSync(path.join(testDir, "tree", "file2.ts"), "const x = 2;")
    fs.writeFileSync(
      path.join(testDir, "tree", "nested", "file3.ts"),
      "const x = 3;",
    )
    fs.writeFileSync(path.join(testDir, "other", "file4.ts"), "const x = 4;")

    const config = {
      includes: ["**/*.ts"],
      excludes: ["tree/"], // Should exclude tree directory and all contents
      plugins: ["@dprint/typescript"],
      typescript: {},
      incremental: false,
    }
    fs.writeFileSync(
      path.join(testDir, "dprint.json"),
      JSON.stringify(config, null, 2),
    )

    const exitCode = await FmtCommand.run({ logLevel: "silent", cwd: testDir })

    const file1 = fs.readFileSync(path.join(testDir, "file1.ts"), "utf-8")
    const file4 = fs.readFileSync(
      path.join(testDir, "other", "file4.ts"),
      "utf-8",
    )
    const file2 = fs.readFileSync(
      path.join(testDir, "tree", "file2.ts"),
      "utf-8",
    )
    const file3 = fs.readFileSync(
      path.join(testDir, "tree", "nested", "file3.ts"),
      "utf-8",
    )

    // Files outside tree/ should be formatted
    t.expect(file1).toBe("const x = 1;\n")
    t.expect(file4).toBe("const x = 4;\n")

    // Files inside tree/ should NOT be formatted
    t.expect(file2).toBe("const x = 2;")
    t.expect(file3).toBe("const x = 3;")

    t.expect(exitCode).toBe(0)
  })

  t.it("bare directory name excludes all contents", async () => {
    fs.mkdirSync(path.join(testDir, "build", "dist"), { recursive: true })

    fs.writeFileSync(path.join(testDir, "src.ts"), "const x = 1;")
    fs.writeFileSync(path.join(testDir, "build", "out.ts"), "const x = 2;")
    fs.writeFileSync(
      path.join(testDir, "build", "dist", "bundle.ts"),
      "const x = 3;",
    )

    const config = {
      includes: ["**/*.ts"],
      excludes: ["build"], // Should exclude build directory and all contents
      plugins: ["@dprint/typescript"],
      typescript: {},
      incremental: false,
    }
    fs.writeFileSync(
      path.join(testDir, "dprint.json"),
      JSON.stringify(config, null, 2),
    )

    const exitCode = await FmtCommand.run({ logLevel: "silent", cwd: testDir })

    const src = fs.readFileSync(path.join(testDir, "src.ts"), "utf-8")
    const out = fs.readFileSync(path.join(testDir, "build", "out.ts"), "utf-8")
    const bundle = fs.readFileSync(
      path.join(testDir, "build", "dist", "bundle.ts"),
      "utf-8",
    )

    // src.ts should be formatted
    t.expect(src).toBe("const x = 1;\n")

    // Files in build/ should NOT be formatted
    t.expect(out).toBe("const x = 2;")
    t.expect(bundle).toBe("const x = 3;")

    t.expect(exitCode).toBe(0)
  })

  t.it("wildcard patterns work correctly", async () => {
    fs.writeFileSync(path.join(testDir, "file1.ts"), "const x = 1;")
    fs.writeFileSync(path.join(testDir, "file2.test.ts"), "const x = 2;")
    fs.writeFileSync(path.join(testDir, "file3.spec.ts"), "const x = 3;")

    const config = {
      includes: ["**/*.ts"],
      excludes: ["*.test.ts", "*.spec.ts"],
      plugins: ["@dprint/typescript"],
      typescript: {},
      incremental: false,
    }
    fs.writeFileSync(
      path.join(testDir, "dprint.json"),
      JSON.stringify(config, null, 2),
    )

    const exitCode = await FmtCommand.run({ logLevel: "silent", cwd: testDir })

    const file1 = fs.readFileSync(path.join(testDir, "file1.ts"), "utf-8")
    const file2 = fs.readFileSync(path.join(testDir, "file2.test.ts"), "utf-8")
    const file3 = fs.readFileSync(path.join(testDir, "file3.spec.ts"), "utf-8")

    // file1.ts should be formatted
    t.expect(file1).toBe("const x = 1;\n")

    // Test and spec files should NOT be formatted
    t.expect(file2).toBe("const x = 2;")
    t.expect(file3).toBe("const x = 3;")

    t.expect(exitCode).toBe(0)
  })

  t.it("nested directory exclusions work", async () => {
    fs.mkdirSync(path.join(testDir, "src", "vendor", "lib"), {
      recursive: true,
    })

    fs.writeFileSync(path.join(testDir, "src", "app.ts"), "const x = 1;")
    fs.writeFileSync(
      path.join(testDir, "src", "vendor", "external.ts"),
      "const x = 2;",
    )
    fs.writeFileSync(
      path.join(testDir, "src", "vendor", "lib", "deep.ts"),
      "const x = 3;",
    )

    const config = {
      includes: ["**/*.ts"],
      excludes: ["src/vendor/"],
      plugins: ["@dprint/typescript"],
      typescript: {},
      incremental: false,
    }
    fs.writeFileSync(
      path.join(testDir, "dprint.json"),
      JSON.stringify(config, null, 2),
    )

    const exitCode = await FmtCommand.run({ logLevel: "silent", cwd: testDir })

    const app = fs.readFileSync(path.join(testDir, "src", "app.ts"), "utf-8")
    const external = fs.readFileSync(
      path.join(testDir, "src", "vendor", "external.ts"),
      "utf-8",
    )
    const deep = fs.readFileSync(
      path.join(testDir, "src", "vendor", "lib", "deep.ts"),
      "utf-8",
    )

    // app.ts should be formatted
    t.expect(app).toBe("const x = 1;\n")

    // vendor files should NOT be formatted
    t.expect(external).toBe("const x = 2;")
    t.expect(deep).toBe("const x = 3;")

    t.expect(exitCode).toBe(0)
  })

  t.it("glob patterns with ** work correctly", async () => {
    fs.mkdirSync(path.join(testDir, "src", "test"), { recursive: true })
    fs.mkdirSync(path.join(testDir, "lib", "test"), { recursive: true })

    fs.writeFileSync(path.join(testDir, "src", "app.ts"), "const x = 1;")
    fs.writeFileSync(
      path.join(testDir, "src", "test", "app.test.ts"),
      "const x = 2;",
    )
    fs.writeFileSync(path.join(testDir, "lib", "util.ts"), "const x = 3;")
    fs.writeFileSync(
      path.join(testDir, "lib", "test", "util.test.ts"),
      "const x = 4;",
    )

    const config = {
      includes: ["**/*.ts"],
      excludes: ["**/test/**"],
      plugins: ["@dprint/typescript"],
      typescript: {},
      incremental: false,
    }
    fs.writeFileSync(
      path.join(testDir, "dprint.json"),
      JSON.stringify(config, null, 2),
    )

    const exitCode = await FmtCommand.run({ logLevel: "silent", cwd: testDir })

    const app = fs.readFileSync(path.join(testDir, "src", "app.ts"), "utf-8")
    const appTest = fs.readFileSync(
      path.join(testDir, "src", "test", "app.test.ts"),
      "utf-8",
    )
    const util = fs.readFileSync(path.join(testDir, "lib", "util.ts"), "utf-8")
    const utilTest = fs.readFileSync(
      path.join(testDir, "lib", "test", "util.test.ts"),
      "utf-8",
    )

    // Non-test files should be formatted
    t.expect(app).toBe("const x = 1;\n")
    t.expect(util).toBe("const x = 3;\n")

    // Test files should NOT be formatted
    t.expect(appTest).toBe("const x = 2;")
    t.expect(utilTest).toBe("const x = 4;")

    t.expect(exitCode).toBe(0)
  })
})

t.describe("include patterns", () => {
  t.it("directory with trailing slash finds NO files", async () => {
    fs.mkdirSync(path.join(testDir, "src"), { recursive: true })

    fs.writeFileSync(path.join(testDir, "src", "app.ts"), "const x = 1;")
    fs.writeFileSync(path.join(testDir, "src", "util.ts"), "const x = 2;")
    fs.writeFileSync(path.join(testDir, "other.ts"), "const x = 3;")

    const config = {
      includes: ["src/"], // Trailing slash - should find NO files
      plugins: ["@dprint/typescript"],
      typescript: {},
      incremental: false,
    }
    fs.writeFileSync(
      path.join(testDir, "dprint.json"),
      JSON.stringify(config, null, 2),
    )

    const exitCode = await FmtCommand.run({ logLevel: "silent", cwd: testDir })

    const app = fs.readFileSync(path.join(testDir, "src", "app.ts"), "utf-8")
    const util = fs.readFileSync(path.join(testDir, "src", "util.ts"), "utf-8")
    const other = fs.readFileSync(path.join(testDir, "other.ts"), "utf-8")

    // NO files should be formatted with "src/" pattern
    t.expect(app).toBe("const x = 1;")
    t.expect(util).toBe("const x = 2;")
    t.expect(other).toBe("const x = 3;")

    // Exit code 14 when no files found
    t.expect(exitCode).toBe(14)
  })

  t.it("bare directory name finds NO files", async () => {
    fs.mkdirSync(path.join(testDir, "lib"), { recursive: true })

    fs.writeFileSync(path.join(testDir, "lib", "index.ts"), "const x = 1;")
    fs.writeFileSync(path.join(testDir, "lib", "helper.ts"), "const x = 2;")
    fs.writeFileSync(path.join(testDir, "main.ts"), "const x = 3;")

    const config = {
      includes: ["lib"], // Bare directory - should find NO files
      plugins: ["@dprint/typescript"],
      typescript: {},
      incremental: false,
    }
    fs.writeFileSync(
      path.join(testDir, "dprint.json"),
      JSON.stringify(config, null, 2),
    )

    const exitCode = await FmtCommand.run({ logLevel: "silent", cwd: testDir })

    const index = fs.readFileSync(
      path.join(testDir, "lib", "index.ts"),
      "utf-8",
    )
    const helper = fs.readFileSync(
      path.join(testDir, "lib", "helper.ts"),
      "utf-8",
    )
    const main = fs.readFileSync(path.join(testDir, "main.ts"), "utf-8")

    // NO files should be formatted with bare "lib" pattern
    t.expect(index).toBe("const x = 1;")
    t.expect(helper).toBe("const x = 2;")
    t.expect(main).toBe("const x = 3;")

    // Exit code 14 when no files found
    t.expect(exitCode).toBe(14)
  })

  t.it("explicit glob patterns work correctly", async () => {
    fs.mkdirSync(path.join(testDir, "src"), { recursive: true })

    fs.writeFileSync(path.join(testDir, "src", "app.ts"), "const x = 1;")
    fs.writeFileSync(path.join(testDir, "src", "util.ts"), "const x = 2;")
    fs.writeFileSync(path.join(testDir, "other.ts"), "const x = 3;")

    const config = {
      includes: ["src/**"], // Explicit glob - SHOULD work
      plugins: ["@dprint/typescript"],
      typescript: {},
      incremental: false,
    }
    fs.writeFileSync(
      path.join(testDir, "dprint.json"),
      JSON.stringify(config, null, 2),
    )

    const exitCode = await FmtCommand.run({ logLevel: "silent", cwd: testDir })

    const app = fs.readFileSync(path.join(testDir, "src", "app.ts"), "utf-8")
    const util = fs.readFileSync(path.join(testDir, "src", "util.ts"), "utf-8")
    const other = fs.readFileSync(path.join(testDir, "other.ts"), "utf-8")

    // src files should be formatted
    t.expect(app).toBe("const x = 1;\n")
    t.expect(util).toBe("const x = 2;\n")

    // other.ts should NOT be formatted
    t.expect(other).toBe("const x = 3;")

    t.expect(exitCode).toBe(0)
  })

  t.it("specific file patterns work correctly", async () => {
    fs.mkdirSync(path.join(testDir, "src"), { recursive: true })

    fs.writeFileSync(path.join(testDir, "src", "app.ts"), "const x = 1;")
    fs.writeFileSync(path.join(testDir, "src", "util.js"), "const x = 2;")
    fs.writeFileSync(path.join(testDir, "main.ts"), "const x = 3;")

    const config = {
      includes: ["src/*.ts"], // Only .ts files in src/
      plugins: ["@dprint/typescript"],
      typescript: {},
      incremental: false,
    }
    fs.writeFileSync(
      path.join(testDir, "dprint.json"),
      JSON.stringify(config, null, 2),
    )

    const exitCode = await FmtCommand.run({ logLevel: "silent", cwd: testDir })

    const app = fs.readFileSync(path.join(testDir, "src", "app.ts"), "utf-8")
    const util = fs.readFileSync(path.join(testDir, "src", "util.js"), "utf-8")
    const main = fs.readFileSync(path.join(testDir, "main.ts"), "utf-8")

    // Only src/app.ts should be formatted
    t.expect(app).toBe("const x = 1;\n")

    // util.js and main.ts should NOT be formatted
    t.expect(util).toBe("const x = 2;")
    t.expect(main).toBe("const x = 3;")

    t.expect(exitCode).toBe(0)
  })

  t.it("multiple include patterns work correctly", async () => {
    fs.mkdirSync(path.join(testDir, "src"), { recursive: true })
    fs.mkdirSync(path.join(testDir, "lib"), { recursive: true })
    fs.mkdirSync(path.join(testDir, "test"), { recursive: true })

    fs.writeFileSync(path.join(testDir, "src", "app.ts"), "const x = 1;")
    fs.writeFileSync(path.join(testDir, "lib", "util.ts"), "const x = 2;")
    fs.writeFileSync(path.join(testDir, "test", "spec.ts"), "const x = 3;")

    const config = {
      includes: ["src/**", "lib/**"], // Include src and lib, but not test
      plugins: ["@dprint/typescript"],
      typescript: {},
      incremental: false,
    }
    fs.writeFileSync(
      path.join(testDir, "dprint.json"),
      JSON.stringify(config, null, 2),
    )

    const exitCode = await FmtCommand.run({ logLevel: "silent", cwd: testDir })

    const app = fs.readFileSync(path.join(testDir, "src", "app.ts"), "utf-8")
    const util = fs.readFileSync(path.join(testDir, "lib", "util.ts"), "utf-8")
    const spec = fs.readFileSync(path.join(testDir, "test", "spec.ts"), "utf-8")

    // src and lib files should be formatted
    t.expect(app).toBe("const x = 1;\n")
    t.expect(util).toBe("const x = 2;\n")

    // test file should NOT be formatted
    t.expect(spec).toBe("const x = 3;")

    t.expect(exitCode).toBe(0)
  })
})

t.describe("combined include and exclude patterns", () => {
  t.it("excludes take precedence over includes", async () => {
    fs.mkdirSync(path.join(testDir, "src", "vendor"), { recursive: true })

    fs.writeFileSync(path.join(testDir, "src", "app.ts"), "const x = 1;")
    fs.writeFileSync(
      path.join(testDir, "src", "vendor", "lib.ts"),
      "const x = 2;",
    )

    const config = {
      includes: ["src/**"],
      excludes: ["src/vendor"], // Exclude vendor even though src/** is included
      plugins: ["@dprint/typescript"],
      typescript: {},
      incremental: false,
    }
    fs.writeFileSync(
      path.join(testDir, "dprint.json"),
      JSON.stringify(config, null, 2),
    )

    const exitCode = await FmtCommand.run({ logLevel: "silent", cwd: testDir })

    const app = fs.readFileSync(path.join(testDir, "src", "app.ts"), "utf-8")
    const lib = fs.readFileSync(
      path.join(testDir, "src", "vendor", "lib.ts"),
      "utf-8",
    )

    // app.ts should be formatted
    t.expect(app).toBe("const x = 1;\n")

    // vendor/lib.ts should NOT be formatted (excluded)
    t.expect(lib).toBe("const x = 2;")

    t.expect(exitCode).toBe(0)
  })

  t.it("complex pattern combinations work correctly", async () => {
    fs.mkdirSync(path.join(testDir, "src", "components"), { recursive: true })
    fs.mkdirSync(path.join(testDir, "src", "utils"), { recursive: true })
    fs.mkdirSync(path.join(testDir, "lib"), { recursive: true })
    fs.mkdirSync(path.join(testDir, "dist"), { recursive: true })

    fs.writeFileSync(
      path.join(testDir, "src", "components", "Button.tsx"),
      "const x = 1;",
    )
    fs.writeFileSync(
      path.join(testDir, "src", "utils", "helper.ts"),
      "const x = 2;",
    )
    fs.writeFileSync(path.join(testDir, "lib", "legacy.js"), "const x = 3;")
    fs.writeFileSync(path.join(testDir, "dist", "bundle.js"), "const x = 4;")

    const config = {
      includes: ["src/**/*.{ts,tsx}", "lib/**/*.js"],
      excludes: ["dist/", "**/*.test.*"],
      plugins: ["@dprint/typescript"],
      typescript: {},
      incremental: false,
    }
    fs.writeFileSync(
      path.join(testDir, "dprint.json"),
      JSON.stringify(config, null, 2),
    )

    const exitCode = await FmtCommand.run({ logLevel: "silent", cwd: testDir })

    const button = fs.readFileSync(
      path.join(testDir, "src", "components", "Button.tsx"),
      "utf-8",
    )
    const helper = fs.readFileSync(
      path.join(testDir, "src", "utils", "helper.ts"),
      "utf-8",
    )
    const legacy = fs.readFileSync(
      path.join(testDir, "lib", "legacy.js"),
      "utf-8",
    )
    const bundle = fs.readFileSync(
      path.join(testDir, "dist", "bundle.js"),
      "utf-8",
    )

    // src files should be formatted
    t.expect(button).toBe("const x = 1;\n")
    t.expect(helper).toBe("const x = 2;\n")

    // lib file should be formatted
    t.expect(legacy).toBe("const x = 3;\n")

    // dist should be excluded
    t.expect(bundle).toBe("const x = 4;")

    t.expect(exitCode).toBe(0)
  })
})
