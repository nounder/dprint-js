import * as t from "bun:test"
import * as fs from "node:fs"
import * as path from "node:path"
import * as CheckCommand from "../src/commands/CheckCommand.ts"
import * as FmtCommand from "../src/commands/FmtCommand.ts"

const projectRoot = process.cwd()
const testDir = path.join(projectRoot, "test-tmp-auto-load")
const configPath = path.join(testDir, "dprint.json")
const packagePath = path.join(testDir, "package.json")

t.beforeEach(() => {
  // Create test directory
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true })
  }
})

t.afterEach(() => {
  // Clean up test directory
  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true })
  }
})

t.it(
  "auto-loads plugins from package.json when config has no plugins property",
  async () => {
    // Create a config without plugins property
    const config = {
      $schema: "https://dprint.dev/schemas/v0.json",
      includes: ["**/*.{ts,js,json,md}"],
      excludes: ["**/node_modules", "dprint.json"],
      typescript: {},
      json: {},
      markdown: {},
    }
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2))

    // Create a package.json with dprint plugins
    const packageJson = {
      name: "test-project",
      version: "1.0.0",
      devDependencies: {
        "@dprint/typescript": "^0.93.0",
        "@dprint/json": "^0.19.3",
        "@dprint/markdown": "^0.17.8",
        "@dprint/formatter": "^0.4.1",
      },
    }
    fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2))

    // Create test files
    const tsFile = path.join(testDir, "test.ts")
    fs.writeFileSync(tsFile, "const   x=1")

    const jsonFile = path.join(testDir, "test.json")
    fs.writeFileSync(jsonFile, "{\"a\":1,\"b\":2}")

    // Run format command - should auto-discover plugins
    const exitCode = await FmtCommand.run({
      cwd: testDir,
      allowGitignored: true,
    })

    t.expect(exitCode).toBe(0)

    // Verify files were formatted
    const formattedTs = fs.readFileSync(tsFile, "utf-8")
    t.expect(formattedTs).toBe("const x = 1;\n")

    const formattedJson = fs.readFileSync(jsonFile, "utf-8")
    t.expect(formattedJson).toContain("\"a\": 1")
  },
)

t.it(
  "auto-loads plugins from package.json when config has empty plugins array",
  async () => {
    // Create a config with empty plugins array
    const config = {
      $schema: "https://dprint.dev/schemas/v0.json",
      includes: ["**/*.{ts,js,json}"],
      excludes: ["**/node_modules", "dprint.json"],
      plugins: [],
      typescript: {},
      json: {},
    }
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2))

    // Create a package.json with dprint plugins
    const packageJson = {
      name: "test-project",
      version: "1.0.0",
      dependencies: {
        "@dprint/typescript": "^0.93.0",
      },
      devDependencies: {
        "@dprint/json": "^0.19.3",
        "@dprint/formatter": "^0.4.1",
      },
    }
    fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2))

    // Create test file
    const tsFile = path.join(testDir, "test.ts")
    fs.writeFileSync(tsFile, "const   y=2")

    // Run check command - should auto-discover plugins
    const exitCode = await CheckCommand.run({
      cwd: testDir,
      allowGitignored: true,
    })

    // Should exit with 20 because file needs formatting
    t.expect(exitCode).toBe(20)
  },
)

t.it("does not auto-load @dprint/formatter package", async () => {
  // Create a config without plugins
  const config = {
    $schema: "https://dprint.dev/schemas/v0.json",
    includes: ["**/*.ts"],
    excludes: ["**/node_modules"],
  }
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2))

  // Create a package.json with only @dprint/formatter (not a plugin)
  const packageJson = {
    name: "test-project",
    version: "1.0.0",
    devDependencies: {
      "@dprint/formatter": "^0.4.1",
    },
  }
  fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2))

  // Create test file
  const tsFile = path.join(testDir, "test.ts")
  fs.writeFileSync(tsFile, "const x = 1;")

  // Run format command - should not find any plugins
  const exitCode = await FmtCommand.run({ cwd: testDir, allowGitignored: true })

  // Should exit with 13 (no formatters loaded)
  t.expect(exitCode).toBe(13)
})

t.it("prefers explicit plugins config over auto-discovery", async () => {
  // Create a config with explicit plugins
  const config = {
    $schema: "https://dprint.dev/schemas/v0.json",
    includes: ["**/*.json"],
    excludes: ["**/node_modules", "dprint.json", "package.json"],
    plugins: ["@dprint/json"],
    json: {},
  }
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2))

  // Create a package.json with multiple dprint plugins
  const packageJson = {
    name: "test-project",
    version: "1.0.0",
    devDependencies: {
      "@dprint/typescript": "^0.93.0",
      "@dprint/json": "^0.19.3",
      "@dprint/markdown": "^0.17.8",
    },
  }
  fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2))

  // Create a TypeScript file (which should NOT be formatted since only json plugin is specified)
  const tsFile = path.join(testDir, "test.ts")
  fs.writeFileSync(tsFile, "const   x=1")

  // Create a JSON file (which should be formatted)
  const jsonFile = path.join(testDir, "test.json")
  fs.writeFileSync(jsonFile, "{\"a\":1}")

  // Run format command - should use explicit config, not auto-discover
  const exitCode = await FmtCommand.run({ cwd: testDir, allowGitignored: true })

  t.expect(exitCode).toBe(0)

  // TypeScript file should remain unformatted (no files to format)
  const tsContent = fs.readFileSync(tsFile, "utf-8")
  t.expect(tsContent).toBe("const   x=1")

  // JSON file should be formatted
  const jsonContent = fs.readFileSync(jsonFile, "utf-8")
  t.expect(jsonContent).toContain("\"a\": 1")
})
