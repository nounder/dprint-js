import { expect, test, beforeEach, afterEach } from "bun:test";
import checkCommand from "../src/commands/check.js";
import * as fs from "node:fs";
import * as path from "node:path";

const testDir = path.join(process.cwd(), "test-tmp-check");
const configPath = path.join(testDir, "dprint.json");
  beforeEach(() => {
    // Create test directory
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
    // Change to test directory
    process.chdir(testDir);

    // Create a valid dprint.json
    const config = {
      $schema: "https://dprint.dev/schemas/v0.json",
      includes: ["**/*.{ts,js,json,md}"],
      excludes: ["**/node_modules", "dprint.json"],
      plugins: ["@dprint/typescript", "@dprint/json", "@dprint/markdown"],
      typescript: {},
      json: {},
      markdown: {},
    };
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  });

  afterEach(() => {
    // Change back to project root
    process.chdir(path.join(testDir, ".."));
    // Clean up test directory
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  test("passes for correctly formatted TypeScript files", async () => {
    const filePath = path.join(testDir, "test.ts");
    fs.writeFileSync(filePath, "const x = 1;\n");

    const exitCode = await checkCommand();

    expect(exitCode).toBe(0);
  });

  test("fails for unformatted TypeScript files", async () => {
    const filePath = path.join(testDir, "test.ts");
    fs.writeFileSync(filePath, "const   x=1");

    const exitCode = await checkCommand();

    expect(exitCode).toBe(1);
  });

  test("fails for unformatted JSON files", async () => {
    const filePath = path.join(testDir, "test.json");
    fs.writeFileSync(filePath, '{"a":1,"b":2}');

    const exitCode = await checkCommand();

    expect(exitCode).toBe(1);
  });

  test("passes when all files are formatted", async () => {
    fs.writeFileSync(path.join(testDir, "test1.ts"), "const a = 1;\n");
    fs.writeFileSync(path.join(testDir, "test2.ts"), "const b = 2;\n");
    fs.writeFileSync(path.join(testDir, "test3.ts"), "const c = 3;\n");

    const exitCode = await checkCommand();

    expect(exitCode).toBe(0);
  });

  test("fails when any file is unformatted", async () => {
    fs.writeFileSync(path.join(testDir, "test1.ts"), "const a = 1;\n");
    fs.writeFileSync(path.join(testDir, "test2.ts"), "const   b=2"); // Unformatted
    fs.writeFileSync(path.join(testDir, "test3.ts"), "const c = 3;\n");

    const exitCode = await checkCommand();

    expect(exitCode).toBe(1);
  });

  test("does not modify files during check", async () => {
    const filePath = path.join(testDir, "test.ts");
    const unformatted = "const   x=1";
    fs.writeFileSync(filePath, unformatted);

    await checkCommand();

    // File should remain unchanged
    expect(fs.readFileSync(filePath, "utf-8")).toBe(unformatted);
  });

  test("checks only specified file patterns", async () => {
    fs.writeFileSync(path.join(testDir, "test.ts"), "const   a=1"); // Unformatted
    fs.writeFileSync(path.join(testDir, "test.json"), '{"x":1}'); // Would fail if checked

    const exitCode = await checkCommand(["*.json"]);

    // Should fail because JSON file is not formatted
    expect(exitCode).toBe(1);
  });

  test("passes when no files found", async () => {
    const exitCode = await checkCommand();

    expect(exitCode).toBe(0);
  });

  test("returns 1 when no config file found", async () => {
    // Move to a completely isolated directory with no parent config
    const isolatedDir = path.join(testDir, "isolated");
    fs.mkdirSync(isolatedDir);
    // Delete the config first
    fs.unlinkSync(configPath);
    process.chdir(isolatedDir);

    const exitCode = await checkCommand();

    expect(exitCode).toBe(1);
    process.chdir(testDir);
  });

  test("respects exclude patterns", async () => {
    const nodeModulesDir = path.join(testDir, "node_modules");
    fs.mkdirSync(nodeModulesDir);
    fs.writeFileSync(path.join(nodeModulesDir, "lib.ts"), "const   x=1"); // Unformatted but excluded
    fs.writeFileSync(path.join(testDir, "src.ts"), "const y = 2;\n"); // Formatted

    const exitCode = await checkCommand();

    // Should pass because unformatted file is in node_modules (excluded)
    expect(exitCode).toBe(0);
  });

  test("handles nested directories", async () => {
    const nestedDir = path.join(testDir, "src", "utils");
    fs.mkdirSync(nestedDir, { recursive: true });
    fs.writeFileSync(path.join(nestedDir, "helper.ts"), "const x = 1;\n");

    const exitCode = await checkCommand();

    expect(exitCode).toBe(0);
  });

  test("fails for multiple unformatted files", async () => {
    fs.writeFileSync(path.join(testDir, "test1.ts"), "const   a=1");
    fs.writeFileSync(path.join(testDir, "test2.ts"), "const   b=2");
    fs.writeFileSync(path.join(testDir, "test3.ts"), "const   c=3");

    const exitCode = await checkCommand();

    expect(exitCode).toBe(1);
  });
});
