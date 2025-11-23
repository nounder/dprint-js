import * as t from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as FmtCommand from "../src/commands/FmtCommand.js";
import * as CheckCommand from "../src/commands/CheckCommand.js";

let testDir;

t.beforeEach(() => {
  // Create unique test directory in /tmp
  testDir = fs.mkdtempSync(path.join(os.tmpdir(), "dprint-test-symlinks-"));
});

t.afterEach(() => {
  // Clean up test directory
  if (testDir && fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
});

t.describe("circular symlink handling", () => {
  t.it("handles circular symlinks gracefully without crashing", async () => {
    // Create directory structure
    fs.mkdirSync(path.join(testDir, "src"), { recursive: true });
    fs.mkdirSync(path.join(testDir, "examples"), { recursive: true });

    // Create regular files that should be formatted
    fs.writeFileSync(path.join(testDir, "src", "app.ts"), "const x = 1;");
    fs.writeFileSync(path.join(testDir, "examples", "demo.ts"), "const y = 2;");

    // Create a symlink that points back to the project root (circular reference)
    // This simulates the issue: examples/node_modules/project -> ../../
    try {
      fs.mkdirSync(path.join(testDir, "examples", "node_modules"), { recursive: true });
      fs.symlinkSync(testDir, path.join(testDir, "examples", "node_modules", "project"), "dir");
    } catch (error) {
      // Skip test if symlinks aren't supported (e.g., Windows without admin)
      if (error.code === 'EPERM' || error.code === 'EACCES') {
        console.log("Skipping circular symlink test - symlinks not supported");
        return;
      }
      throw error;
    }

    const config = {
      includes: ["**/*.ts"],
      excludes: [], // Deliberately don't exclude node_modules to test the symlink handling
      plugins: ["@dprint/typescript"],
      typescript: {},
      incremental: false,
    };
    fs.writeFileSync(path.join(testDir, "dprint.json"), JSON.stringify(config, null, 2));

    // This should NOT crash despite the circular symlink
    const exitCode = await FmtCommand.run({
      logLevel: "silent",
      cwd: testDir,
      allowNodeModules: true // Allow scanning node_modules to trigger the issue
    });

    // Regular files should still be formatted
    const app = fs.readFileSync(path.join(testDir, "src", "app.ts"), "utf-8");
    const demo = fs.readFileSync(path.join(testDir, "examples", "demo.ts"), "utf-8");

    t.expect(app).toBe("const x = 1;\n");
    t.expect(demo).toBe("const y = 2;\n");

    // Should succeed despite the circular symlink
    t.expect(exitCode).toBe(0);
  });

  t.it("check command handles circular symlinks gracefully", async () => {
    // Create directory structure
    fs.mkdirSync(path.join(testDir, "lib"), { recursive: true });

    // Create an unformatted file
    fs.writeFileSync(path.join(testDir, "lib", "util.ts"), "const x=1;");

    // Create a symlink that points back to the project root
    try {
      fs.mkdirSync(path.join(testDir, "lib", "node_modules"), { recursive: true });
      fs.symlinkSync(testDir, path.join(testDir, "lib", "node_modules", "self"), "dir");
    } catch (error) {
      // Skip test if symlinks aren't supported
      if (error.code === 'EPERM' || error.code === 'EACCES') {
        console.log("Skipping circular symlink test - symlinks not supported");
        return;
      }
      throw error;
    }

    const config = {
      includes: ["**/*.ts"],
      excludes: [],
      plugins: ["@dprint/typescript"],
      typescript: {},
      incremental: false,
    };
    fs.writeFileSync(path.join(testDir, "dprint.json"), JSON.stringify(config, null, 2));

    // This should NOT crash despite the circular symlink
    const exitCode = await CheckCommand.run({
      logLevel: "silent",
      cwd: testDir,
      allowNodeModules: true
    });

    // Should return exit code 20 because lib/util.ts is unformatted
    t.expect(exitCode).toBe(20);
  });

  t.it("node_modules exclusion prevents circular symlink issues", async () => {
    // Create directory structure
    fs.mkdirSync(path.join(testDir, "src"), { recursive: true });

    fs.writeFileSync(path.join(testDir, "src", "index.ts"), "const x = 1;");

    // Create a circular symlink inside node_modules
    try {
      fs.mkdirSync(path.join(testDir, "node_modules", "pkg"), { recursive: true });
      fs.symlinkSync(testDir, path.join(testDir, "node_modules", "pkg", "circular"), "dir");
    } catch (error) {
      if (error.code === 'EPERM' || error.code === 'EACCES') {
        console.log("Skipping circular symlink test - symlinks not supported");
        return;
      }
      throw error;
    }

    const config = {
      includes: ["**/*.ts"],
      // No explicit excludes, but node_modules should be auto-excluded by default
      plugins: ["@dprint/typescript"],
      typescript: {},
      incremental: false,
    };
    fs.writeFileSync(path.join(testDir, "dprint.json"), JSON.stringify(config, null, 2));

    // Should work fine because node_modules is excluded by default
    const exitCode = await FmtCommand.run({
      logLevel: "silent",
      cwd: testDir
      // allowNodeModules is NOT set, so node_modules should be excluded
    });

    const index = fs.readFileSync(path.join(testDir, "src", "index.ts"), "utf-8");
    t.expect(index).toBe("const x = 1;\n");
    t.expect(exitCode).toBe(0);
  });

  t.it("deep nested symlink structures are handled", async () => {
    // Create a more complex nested structure
    fs.mkdirSync(path.join(testDir, "packages", "app", "src"), { recursive: true });
    fs.writeFileSync(path.join(testDir, "packages", "app", "src", "main.ts"), "const x = 1;");

    // Create nested symlink that could cause very long paths
    try {
      fs.mkdirSync(path.join(testDir, "packages", "app", "node_modules"), { recursive: true });
      fs.symlinkSync(
        path.join(testDir, "packages"),
        path.join(testDir, "packages", "app", "node_modules", "packages"),
        "dir"
      );
    } catch (error) {
      if (error.code === 'EPERM' || error.code === 'EACCES') {
        console.log("Skipping circular symlink test - symlinks not supported");
        return;
      }
      throw error;
    }

    const config = {
      includes: ["**/*.ts"],
      excludes: [],
      plugins: ["@dprint/typescript"],
      typescript: {},
      incremental: false,
    };
    fs.writeFileSync(path.join(testDir, "dprint.json"), JSON.stringify(config, null, 2));

    // Should handle the nested symlink without ENAMETOOLONG error
    const exitCode = await FmtCommand.run({
      logLevel: "silent",
      cwd: testDir,
      allowNodeModules: true
    });

    const main = fs.readFileSync(path.join(testDir, "packages", "app", "src", "main.ts"), "utf-8");
    t.expect(main).toBe("const x = 1;\n");
    t.expect(exitCode).toBe(0);
  });
});
