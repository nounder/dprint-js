import * as t from "bun:test";
import checkCommand from "../src/commands/check.js";
import * as fs from "node:fs";
import * as path from "node:path";

const projectRoot = process.cwd();
const testDir = path.join(projectRoot, "test-tmp-check");
const configPath = path.join(testDir, "dprint.json");
t.beforeEach(() => {
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

t.afterEach(() => {
  // Change back to project root
  process.chdir(projectRoot);
  // Clean up test directory
  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
});

t.it("passes for correctly formatted TypeScript files", async () => {
  const filePath = path.join(testDir, "test.ts");
  fs.writeFileSync(filePath, "const x = 1;\n");

  const exitCode = await checkCommand();

  t.expect(exitCode).toBe(0);
});

t.it("fails for unformatted TypeScript files", async () => {
  const filePath = path.join(testDir, "test.ts");
  fs.writeFileSync(filePath, "const   x=1");

  const exitCode = await checkCommand();

  t.expect(exitCode).toBe(1);
});

t.it("fails for unformatted JSON files", async () => {
  const filePath = path.join(testDir, "test.json");
  fs.writeFileSync(filePath, '{"a":1,"b":2}');

  const exitCode = await checkCommand();

  t.expect(exitCode).toBe(1);
});

t.it("passes when all files are formatted", async () => {
  fs.writeFileSync(path.join(testDir, "test1.ts"), "const a = 1;\n");
  fs.writeFileSync(path.join(testDir, "test2.ts"), "const b = 2;\n");
  fs.writeFileSync(path.join(testDir, "test3.ts"), "const c = 3;\n");

  const exitCode = await checkCommand();

  t.expect(exitCode).toBe(0);
});

t.it("fails when any file is unformatted", async () => {
  fs.writeFileSync(path.join(testDir, "test1.ts"), "const a = 1;\n");
  fs.writeFileSync(path.join(testDir, "test2.ts"), "const   b=2"); // Unformatted
  fs.writeFileSync(path.join(testDir, "test3.ts"), "const c = 3;\n");

  const exitCode = await checkCommand();

  t.expect(exitCode).toBe(1);
});

t.it("does not modify files during check", async () => {
  const filePath = path.join(testDir, "test.ts");
  const unformatted = "const   x=1";
  fs.writeFileSync(filePath, unformatted);

  await checkCommand();

  // File should remain unchanged
  t.expect(fs.readFileSync(filePath, "utf-8")).toBe(unformatted);
});

t.it("checks only specified file patterns", async () => {
  fs.writeFileSync(path.join(testDir, "test.ts"), "const   a=1"); // Unformatted
  fs.writeFileSync(path.join(testDir, "test.json"), '{"x":1}'); // Would fail if checked

  const exitCode = await checkCommand(["*.json"]);

  // Should fail because JSON file is not formatted
  t.expect(exitCode).toBe(1);
});

t.it("passes when no files found", async () => {
  const exitCode = await checkCommand();

  t.expect(exitCode).toBe(0);
});

t.it("returns 1 when no config file found", async () => {
  // Use /tmp for truly isolated testing outside project root
  const isolatedDir = path.join("/tmp", "dprint-test-isolated-" + Date.now());
  fs.mkdirSync(isolatedDir, { recursive: true });
  process.chdir(isolatedDir);

  try {
    const exitCode = await checkCommand();
    t.expect(exitCode).toBe(1);
  } finally {
    process.chdir(projectRoot);
    if (fs.existsSync(isolatedDir)) {
      fs.rmSync(isolatedDir, { recursive: true, force: true });
    }
  }
});

t.it("respects exclude patterns", async () => {
  const nodeModulesDir = path.join(testDir, "node_modules");
  fs.mkdirSync(nodeModulesDir);
  fs.writeFileSync(path.join(nodeModulesDir, "lib.ts"), "const   x=1"); // Unformatted but excluded
  fs.writeFileSync(path.join(testDir, "src.ts"), "const y = 2;\n"); // Formatted

  const exitCode = await checkCommand();

  // Should pass because unformatted file is in node_modules (excluded)
  t.expect(exitCode).toBe(0);
});

t.it("handles nested directories", async () => {
  const nestedDir = path.join(testDir, "src", "utils");
  fs.mkdirSync(nestedDir, { recursive: true });
  fs.writeFileSync(path.join(nestedDir, "helper.ts"), "const x = 1;\n");

  const exitCode = await checkCommand();

  t.expect(exitCode).toBe(0);
});

t.it("fails for multiple unformatted files", async () => {
  fs.writeFileSync(path.join(testDir, "test1.ts"), "const   a=1");
  fs.writeFileSync(path.join(testDir, "test2.ts"), "const   b=2");
  fs.writeFileSync(path.join(testDir, "test3.ts"), "const   c=3");

  const exitCode = await checkCommand();

  t.expect(exitCode).toBe(1);
});
