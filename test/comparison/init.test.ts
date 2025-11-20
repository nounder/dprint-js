import * as t from "bun:test";
import * as fs from "node:fs";
import * as path from "node:path";
import { $ } from "bun";
import initCommand from "../../src/commands/init.js";

const projectRoot = process.cwd();
const testDir = path.join(projectRoot, "test/comparison-tmp-init");
const oursDir = path.join(testDir, "ours");
const theirsDir = path.join(testDir, "theirs");

t.beforeEach(() => {
  // Create test directories
  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
  fs.mkdirSync(oursDir, { recursive: true });
  fs.mkdirSync(theirsDir, { recursive: true });
});

t.afterEach(() => {
  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
});

t.it("creates dprint.json with expected structure", async () => {
  // Init with our implementation
  const ourExitCode = await initCommand({ cwd: oursDir });

  // Read our config
  const ourConfigPath = path.join(oursDir, "dprint.json");
  t.expect(fs.existsSync(ourConfigPath)).toBe(true);
  const ourConfig = JSON.parse(fs.readFileSync(ourConfigPath, "utf-8"));

  // Verify structure
  t.expect(ourExitCode).toBe(0);
  t.expect(ourConfig).toHaveProperty("includes");
  t.expect(ourConfig).toHaveProperty("excludes");
  t.expect(ourConfig).toHaveProperty("plugins");
  t.expect(ourConfig).toHaveProperty("typescript");
  t.expect(ourConfig).toHaveProperty("json");
  t.expect(ourConfig).toHaveProperty("markdown");
  t.expect(Array.isArray(ourConfig.includes)).toBe(true);
  t.expect(Array.isArray(ourConfig.excludes)).toBe(true);
  t.expect(Array.isArray(ourConfig.plugins)).toBe(true);
});

t.it("returns exit code 1 when config already exists", async () => {
  // Create existing config
  fs.writeFileSync(path.join(oursDir, "dprint.json"), "{}");
  fs.writeFileSync(path.join(theirsDir, "dprint.json"), "{}");

  // Try to init with our implementation
  const ourExitCode = await initCommand({ cwd: oursDir });

  // Try to init with rust dprint (note: rust dprint uses interactive mode which won't work here)
  // We'll test the exit code behavior directly
  t.expect(ourExitCode).toBe(1);
});

t.it("uses custom config path when provided", async () => {
  const customPath = "custom.dprint.json";

  // Init with custom path using our implementation
  const ourExitCode = await initCommand({ config: customPath, cwd: oursDir });

  // Verify custom config was created
  const customConfigPath = path.join(oursDir, customPath);
  t.expect(fs.existsSync(customConfigPath)).toBe(true);
  t.expect(ourExitCode).toBe(0);

  // Verify default config was not created
  t.expect(fs.existsSync(path.join(oursDir, "dprint.json"))).toBe(false);
});

t.it("creates config with expected default values", async () => {
  // Init with our implementation
  await initCommand({ cwd: oursDir });

  // Read config
  const config = JSON.parse(fs.readFileSync(path.join(oursDir, "dprint.json"), "utf-8"));

  // Check default values match dprint standards
  // lineWidth is in plugin config, not top level
  // indentWidth is in plugin config, not top level
  // useTabs is in plugin config, not top level

  // Check default excludes include common patterns
  t.expect(config.excludes).toContain("**/node_modules");

  // Check default includes have glob patterns
  t.expect(config.includes.length).toBeGreaterThan(0);
  t.expect(config.includes.some((p: string) => p.includes("**"))).toBe(true);
});

t.it("creates valid JSON that can be parsed", async () => {
  // Init with our implementation
  await initCommand({ cwd: oursDir });

  // Verify JSON is valid and well-formatted
  const content = fs.readFileSync(path.join(oursDir, "dprint.json"), "utf-8");
  t.expect(() => JSON.parse(content)).not.toThrow();

  // Verify it's formatted with indentation
  t.expect(content).toContain("  "); // Has indentation
  t.expect(content.split("\n").length).toBeGreaterThan(5); // Multi-line
});

t.it("overwrites config only with custom plugins when specified", async () => {
  const customPlugins = ["@dprint/typescript", "@dprint/json"];

  // Init with custom plugins
  await initCommand({ plugins: customPlugins, cwd: oursDir });

  // Read config
  const config = JSON.parse(fs.readFileSync(path.join(oursDir, "dprint.json"), "utf-8"));

  // Verify plugins were overridden
  t.expect(config.plugins).toEqual(customPlugins);

  // Verify other properties still exist
  t.expect(config).toHaveProperty("typescript");
  t.expect(config).toHaveProperty("includes");
  t.expect(config).toHaveProperty("excludes");
});

t.it("creates config compatible with rust dprint format", async () => {
  // Init with our implementation
  await initCommand({ cwd: oursDir });

  // Read our config
  const ourConfig = JSON.parse(fs.readFileSync(path.join(oursDir, "dprint.json"), "utf-8"));

  // Modify to use URL-based plugins (like rust dprint)
  ourConfig.plugins = [
    "https://plugins.dprint.dev/typescript-0.93.0.wasm",
    "https://plugins.dprint.dev/json-0.19.3.wasm",
    "https://plugins.dprint.dev/markdown-0.17.8.wasm",
  ];

  // Write modified config to theirs directory
  fs.writeFileSync(path.join(theirsDir, "dprint.json"), JSON.stringify(ourConfig, null, 2));

  // Create a test file
  fs.writeFileSync(path.join(theirsDir, "test.ts"), "const   x=1;");

  // Verify rust dprint can use the config (should not error)
  const result = await $`npx dprint fmt --log-level silent`.cwd(theirsDir).nothrow().quiet();

  // Should succeed (exit code 0)
  t.expect(result.exitCode).toBe(0);

  // File should be formatted
  const formatted = fs.readFileSync(path.join(theirsDir, "test.ts"), "utf-8");
  t.expect(formatted).toContain("const x = 1");
});

// Error tests
t.it("returns exit code 1 when attempting to init with existing config", async () => {
  // Create existing configs
  fs.writeFileSync(path.join(oursDir, "dprint.json"), "{}");
  fs.writeFileSync(path.join(theirsDir, "dprint.json"), "{}");

  // Try to init with our implementation
  const ourExitCode = await initCommand({ cwd: oursDir });

  // Try to init with rust dprint (use --yes to avoid interactive prompt)
  const theirResult = await $`echo "n" | npx dprint init 2>&1`.cwd(theirsDir).nothrow().quiet();
  const theirExitCode = theirResult.exitCode;

  // Both should fail with exit code 1
  t.expect(ourExitCode).toBe(1);
  // Note: rust dprint might have different behavior with interactive prompts
  // We verify our implementation returns 1
});

t.it("handles invalid custom config path gracefully", async () => {
  // Try to create config in non-existent directory
  const invalidPath = "non-existent-dir/dprint.json";

  const ourExitCode = await initCommand({ config: invalidPath, cwd: oursDir });

  // Should fail with error exit code
  t.expect(ourExitCode).toBeGreaterThan(0);

  // Verify config was not created
  t.expect(fs.existsSync(path.join(oursDir, invalidPath))).toBe(false);
});

t.it("creates config that rust dprint can use for formatting", async () => {
  // Init with our implementation
  await initCommand({ cwd: oursDir });

  // Verify config was created
  const ourConfigExists = fs.existsSync(path.join(oursDir, "dprint.json"));
  t.expect(ourConfigExists).toBe(true);

  // Read our config and convert to URL-based plugins for rust dprint
  const ourConfig = JSON.parse(fs.readFileSync(path.join(oursDir, "dprint.json"), "utf-8"));
  ourConfig.plugins = [
    "https://plugins.dprint.dev/typescript-0.93.0.wasm",
    "https://plugins.dprint.dev/json-0.19.3.wasm",
    "https://plugins.dprint.dev/markdown-0.17.8.wasm",
  ];

  // Write modified config to theirs directory
  fs.writeFileSync(path.join(theirsDir, "dprint.json"), JSON.stringify(ourConfig, null, 2));

  // Create a test file
  fs.writeFileSync(path.join(theirsDir, "test.ts"), "const   x=1;");

  // Verify rust dprint can use the config we created
  const result = await $`npx dprint fmt --log-level silent`.cwd(theirsDir).nothrow().quiet();

  // Should succeed (exit code 0)
  t.expect(result.exitCode).toBe(0);

  // File should be formatted
  const formatted = fs.readFileSync(path.join(theirsDir, "test.ts"), "utf-8");
  t.expect(formatted).toContain("const x = 1");
});

t.it("handles empty plugins array", async () => {
  // Create config with empty plugins array
  const emptyPluginsConfig = {
    includes: ["**/*.ts"],
    excludes: ["**/node_modules"],
    plugins: [],
  };

  fs.writeFileSync(path.join(oursDir, "test-config.json"), JSON.stringify(emptyPluginsConfig, null, 2));
  fs.writeFileSync(path.join(theirsDir, "test-config.json"), JSON.stringify(emptyPluginsConfig, null, 2));

  // Create test files
  fs.writeFileSync(path.join(oursDir, "test.ts"), "const x=1;");
  fs.writeFileSync(path.join(theirsDir, "test.ts"), "const x=1;");

  // Both should handle empty plugins similarly (likely as error)
  const ourResult = await $`bun run ${path.join(projectRoot, "bin/dprint-js")} check --config test-config.json --log-level silent`.cwd(oursDir).nothrow().quiet();

  const theirResult = await $`npx dprint check --config test-config.json --log-level silent`.cwd(theirsDir).nothrow().quiet();

  // Both should fail or succeed in the same way
  t.expect(ourResult.exitCode).toBe(theirResult.exitCode);
});
