import { $ } from "bun";
import * as t from "bun:test";
import * as fs from "node:fs";
import initCommand from "../../src/commands/init.js";
import {
  cleanupTestDirs,
  createTestDirs,
  runBothInParallel,
  type TestDirs,
} from "./test-helpers.js";

let dirs: TestDirs;

t.beforeEach(() => {
  dirs = createTestDirs("comparison-init");
  // Note: Don't create configs - init tests create them
});

t.afterEach(() => {
  cleanupTestDirs(dirs.testDir);
});

// Core test: Verify created config structure matches expectations
t.it("creates dprint.json with expected structure", async () => {
  const ourExitCode = await initCommand({ cwd: dirs.oursDir });

  const ourConfigPath = `${dirs.oursDir}/dprint.json`;
  t.expect(fs.existsSync(ourConfigPath)).toBe(true);
  t.expect(ourExitCode).toBe(0);

  const ourConfig = JSON.parse(fs.readFileSync(ourConfigPath, "utf-8"));

  // Verify structure
  t.expect(ourConfig).toHaveProperty("includes");
  t.expect(ourConfig).toHaveProperty("excludes");
  t.expect(ourConfig).toHaveProperty("plugins");
  t.expect(ourConfig).toHaveProperty("typescript");
  t.expect(ourConfig).toHaveProperty("json");
  t.expect(ourConfig).toHaveProperty("markdown");
  t.expect(Array.isArray(ourConfig.includes)).toBe(true);
  t.expect(Array.isArray(ourConfig.excludes)).toBe(true);
  t.expect(Array.isArray(ourConfig.plugins)).toBe(true);

  // Verify defaults
  t.expect(ourConfig.excludes).toContain("**/node_modules");
  t.expect(ourConfig.includes.length).toBeGreaterThan(0);
  t.expect(ourConfig.includes.some((p: string) => p.includes("**"))).toBe(true);
});

// Test: Config is compatible with rust dprint
t.it("creates config compatible with rust dprint", async () => {
  await initCommand({ cwd: dirs.oursDir });

  // Read our config and convert to URL-based plugins for rust dprint
  const ourConfig = JSON.parse(fs.readFileSync(`${dirs.oursDir}/dprint.json`, "utf-8"));
  ourConfig.plugins = [
    "https://plugins.dprint.dev/typescript-0.93.0.wasm",
    "https://plugins.dprint.dev/json-0.19.3.wasm",
    "https://plugins.dprint.dev/markdown-0.17.8.wasm",
  ];

  // Write to theirs directory
  fs.writeFileSync(`${dirs.theirsDir}/dprint.json`, JSON.stringify(ourConfig, null, 2));

  // Create a test file
  fs.writeFileSync(`${dirs.theirsDir}/test.ts`, "const   x=1;");

  // Verify rust dprint can use the config
  const result = await $`npx dprint fmt --log-level silent`.cwd(dirs.theirsDir).nothrow().quiet();

  t.expect(result.exitCode).toBe(0);

  // File should be formatted
  const formatted = fs.readFileSync(`${dirs.theirsDir}/test.ts`, "utf-8");
  t.expect(formatted).toContain("const x = 1");
});

// Test: Various init scenarios
t.describe("init scenarios", () => {
  t.it("returns exit code 1 when config already exists", async () => {
    // Create existing configs
    fs.writeFileSync(`${dirs.oursDir}/dprint.json`, "{}");
    fs.writeFileSync(`${dirs.theirsDir}/dprint.json`, "{}");

    const ourExitCode = await initCommand({ cwd: dirs.oursDir });

    // Both should fail
    t.expect(ourExitCode).toBe(1);
  });

  t.it("uses custom config path when provided", async () => {
    const customPath = "custom.dprint.json";

    const ourExitCode = await initCommand({ config: customPath, cwd: dirs.oursDir });

    // Verify custom config was created
    t.expect(fs.existsSync(`${dirs.oursDir}/${customPath}`)).toBe(true);
    t.expect(ourExitCode).toBe(0);

    // Verify default config was not created
    t.expect(fs.existsSync(`${dirs.oursDir}/dprint.json`)).toBe(false);
  });

  t.it("handles custom plugins option", async () => {
    const customPlugins = ["@dprint/typescript", "@dprint/json"];

    await initCommand({ plugins: customPlugins, cwd: dirs.oursDir });

    const config = JSON.parse(fs.readFileSync(`${dirs.oursDir}/dprint.json`, "utf-8"));

    // Verify plugins were set
    t.expect(config.plugins).toEqual(customPlugins);

    // Verify other properties still exist
    t.expect(config).toHaveProperty("typescript");
    t.expect(config).toHaveProperty("includes");
    t.expect(config).toHaveProperty("excludes");
  });

  t.it("handles invalid custom config path", async () => {
    const invalidPath = "non-existent-dir/dprint.json";

    const ourExitCode = await initCommand({ config: invalidPath, cwd: dirs.oursDir });

    // Should fail
    t.expect(ourExitCode).toBeGreaterThan(0);

    // Verify config was not created
    t.expect(fs.existsSync(`${dirs.oursDir}/${invalidPath}`)).toBe(false);
  });

  t.it("creates valid, well-formatted JSON", async () => {
    await initCommand({ cwd: dirs.oursDir });

    const content = fs.readFileSync(`${dirs.oursDir}/dprint.json`, "utf-8");

    // Verify JSON is valid
    t.expect(() => JSON.parse(content)).not.toThrow();

    // Verify it's formatted with indentation
    t.expect(content).toContain("  "); // Has indentation
    t.expect(content.split("\n").length).toBeGreaterThan(5); // Multi-line
  });
});
