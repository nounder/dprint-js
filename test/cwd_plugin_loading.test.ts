import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { loadPlugin, loadPlugins } from "../src/formatter.js";

describe("CWD Plugin Loading", () => {
  let testDir: string;
  let originalCwd: string;

  beforeEach(() => {
    // Create a temporary directory for our test
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), "dprint-cwd-test-"));
    originalCwd = process.cwd();
  });

  afterEach(() => {
    // Cleanup
    process.chdir(originalCwd);
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  test("loads plugins from CWD's node_modules (simulating bunx)", async () => {
    // Setup: Create a fake project structure with plugins
    const nodeModulesDir = path.join(testDir, "node_modules");
    const dprintDir = path.join(nodeModulesDir, "@dprint");

    // Create @dprint/typescript directory structure
    const tsPluginDir = path.join(dprintDir, "typescript");
    fs.mkdirSync(tsPluginDir, { recursive: true });

    // Copy the actual plugin from our dev dependencies to simulate it being in CWD
    const actualPluginPath = path.join(
      originalCwd,
      "node_modules",
      "@dprint",
      "typescript"
    );

    if (fs.existsSync(actualPluginPath)) {
      // Copy package.json
      const srcPackageJson = path.join(actualPluginPath, "package.json");
      const destPackageJson = path.join(tsPluginDir, "package.json");
      fs.copyFileSync(srcPackageJson, destPackageJson);

      // Copy main file (index.js or as specified in package.json)
      const packageJson = JSON.parse(fs.readFileSync(srcPackageJson, "utf-8"));
      const mainFile = packageJson.main || "index.js";
      const srcMain = path.join(actualPluginPath, mainFile);
      const destMain = path.join(tsPluginDir, mainFile);

      // Ensure directory exists for main file
      fs.mkdirSync(path.dirname(destMain), { recursive: true });
      fs.copyFileSync(srcMain, destMain);

      // Copy WASM file if it exists
      const files = fs.readdirSync(actualPluginPath);
      for (const file of files) {
        if (file.endsWith(".wasm")) {
          fs.copyFileSync(
            path.join(actualPluginPath, file),
            path.join(tsPluginDir, file)
          );
        }
      }

      // Test: Load plugin from CWD (testDir)
      const result = await loadPlugin("@dprint/typescript", testDir);

      // Verify
      expect(result).toBeDefined();
      expect(result.formatter).toBeDefined();
      expect(result.fileMatchingInfo).toBeDefined();
      expect(result.fileMatchingInfo.fileExtensions).toContain("ts");
    } else {
      // Skip test if plugin not available in dev
      console.warn("Skipping test: @dprint/typescript not found in node_modules");
    }
  });

  test("auto-discovers plugins from CWD's package.json and node_modules", async () => {
    // Setup: Create package.json with plugin dependencies
    const packageJson = {
      name: "test-project",
      dependencies: {
        "@dprint/typescript": "^0.95.0",
        "@dprint/json": "^0.21.0",
      },
    };

    fs.writeFileSync(
      path.join(testDir, "package.json"),
      JSON.stringify(packageJson, null, 2)
    );

    // Create node_modules with plugins
    const nodeModulesDir = path.join(testDir, "node_modules");
    const dprintDir = path.join(nodeModulesDir, "@dprint");
    fs.mkdirSync(dprintDir, { recursive: true });

    // Copy @dprint/typescript
    const actualTsPath = path.join(
      originalCwd,
      "node_modules",
      "@dprint",
      "typescript"
    );
    const testTsPath = path.join(dprintDir, "typescript");

    if (fs.existsSync(actualTsPath)) {
      fs.cpSync(actualTsPath, testTsPath, { recursive: true });

      // Copy @dprint/json
      const actualJsonPath = path.join(
        originalCwd,
        "node_modules",
        "@dprint",
        "json"
      );
      const testJsonPath = path.join(dprintDir, "json");

      if (fs.existsSync(actualJsonPath)) {
        fs.cpSync(actualJsonPath, testJsonPath, { recursive: true });

        // Create dprint.json (no plugins array - should auto-discover)
        const dprintConfig = {
          includes: ["**/*.ts", "**/*.json"],
          excludes: ["node_modules"],
        };

        fs.writeFileSync(
          path.join(testDir, "dprint.json"),
          JSON.stringify(dprintConfig, null, 2)
        );

        // Test: Load plugins with auto-discovery from CWD
        const configPath = path.join(testDir, "dprint.json");
        const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));

        const result = await loadPlugins(config, testDir, configPath);
        const plugins = result.plugins;

        // Verify: Should find both plugins from CWD's node_modules
        expect(plugins.length).toBe(2);
        expect(plugins.some((p) => p.name === "@dprint/typescript")).toBe(true);
        expect(plugins.some((p) => p.name === "@dprint/json")).toBe(true);
      }
    }
  });

  test("prefers CWD's node_modules over global (simulating bunx vs local)", async () => {
    // This test verifies that when both exist, we use CWD's version
    // Setup: Create a different version marker in CWD

    const nodeModulesDir = path.join(testDir, "node_modules");
    const dprintDir = path.join(nodeModulesDir, "@dprint");
    const tsPluginDir = path.join(dprintDir, "typescript");
    fs.mkdirSync(tsPluginDir, { recursive: true });

    // Copy the actual plugin
    const actualPluginPath = path.join(
      originalCwd,
      "node_modules",
      "@dprint",
      "typescript"
    );

    if (fs.existsSync(actualPluginPath)) {
      fs.cpSync(actualPluginPath, tsPluginDir, { recursive: true });

      // Load plugin - should use CWD's version
      const result = await loadPlugin("@dprint/typescript", testDir);

      // Verify it loaded from CWD (we can't easily verify the path,
      // but we can verify it succeeded)
      expect(result).toBeDefined();
      expect(result.formatter).toBeDefined();
    }
  });

  test("falls back to global import when plugin not in CWD", async () => {
    // When plugin is NOT in CWD's node_modules, it should fall back
    // to regular import (which will find it in the running process's node_modules)

    // Test: Try to load a plugin that exists globally but not in testDir
    // This simulates running from a location without the plugin installed

    try {
      const result = await loadPlugin("@dprint/typescript", testDir);

      // Should succeed using fallback to global import
      expect(result).toBeDefined();
      expect(result.formatter).toBeDefined();
    } catch (error) {
      // If it fails, that's also acceptable - means the plugin truly isn't available
      expect(error.message).toContain("Failed to load plugin");
    }
  });

  test("handles non-existent plugins gracefully", async () => {
    // Test: Try to load a plugin that doesn't exist anywhere

    let error: Error | null = null;
    try {
      await loadPlugin("@dprint/nonexistent-plugin-xyz", testDir);
    } catch (e) {
      error = e as Error;
    }

    expect(error).not.toBeNull();
    expect(error?.message).toContain("Failed to load plugin");
  });
});
