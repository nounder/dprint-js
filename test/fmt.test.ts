import * as t from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import fmtCommand from "../src/commands/fmt.js";

let testDir;
let configPath;

t.beforeEach(() => {
  // Create unique test directory in /tmp
  testDir = fs.mkdtempSync(path.join(os.tmpdir(), "dprint-test-fmt-"));
  configPath = path.join(testDir, "dprint.json");

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
  // Clean up test directory
  if (testDir && fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
});

t.it("formats TypeScript files", async () => {
  const filePath = path.join(testDir, "test.ts");
  const unformatted = "const   x=1";
  fs.writeFileSync(filePath, unformatted);

  const exitCode = await fmtCommand([], { cwd: testDir });

  t.expect(exitCode).toBe(0);
  const formatted = fs.readFileSync(filePath, "utf-8");
  t.expect(formatted).not.toBe(unformatted);
  t.expect(formatted).toBe("const x = 1;\n");
});

t.it("formats JSON files", async () => {
  const filePath = path.join(testDir, "test.json");
  const unformatted = "{\"a\":1,\"b\":2}";
  fs.writeFileSync(filePath, unformatted);

  const exitCode = await fmtCommand([], { cwd: testDir });

  t.expect(exitCode).toBe(0);
  const formatted = fs.readFileSync(filePath, "utf-8");
  t.expect(formatted).not.toBe(unformatted);
  t.expect(formatted).toContain("\n");
});

t.it("formats markdown files", async () => {
  const filePath = path.join(testDir, "test.md");
  const unformatted = "#   Title\n\nSome   text   here";
  fs.writeFileSync(filePath, unformatted);

  const exitCode = await fmtCommand([], { cwd: testDir });

  t.expect(exitCode).toBe(0);
  const formatted = fs.readFileSync(filePath, "utf-8");
  t.expect(formatted).toBeDefined();
});

t.it("formats multiple files", async () => {
  fs.writeFileSync(path.join(testDir, "test1.ts"), "const   a=1");
  fs.writeFileSync(path.join(testDir, "test2.ts"), "const   b=2");
  fs.writeFileSync(path.join(testDir, "test3.ts"), "const   c=3");

  const exitCode = await fmtCommand([], { cwd: testDir });

  t.expect(exitCode).toBe(0);
  t.expect(fs.readFileSync(path.join(testDir, "test1.ts"), "utf-8")).toBe("const a = 1;\n");
  t.expect(fs.readFileSync(path.join(testDir, "test2.ts"), "utf-8")).toBe("const b = 2;\n");
  t.expect(fs.readFileSync(path.join(testDir, "test3.ts"), "utf-8")).toBe("const c = 3;\n");
});

t.it("skips already formatted files", async () => {
  const filePath = path.join(testDir, "test.ts");
  const formatted = "const x = 1;\n";
  fs.writeFileSync(filePath, formatted);

  const exitCode = await fmtCommand([], { cwd: testDir });

  t.expect(exitCode).toBe(0);
  t.expect(fs.readFileSync(filePath, "utf-8")).toBe(formatted);
});

t.it("formats only specified file patterns", async () => {
  fs.writeFileSync(path.join(testDir, "test.ts"), "const   a=1");
  fs.writeFileSync(path.join(testDir, "test.json"), "{\"x\":1}");

  const exitCode = await fmtCommand(["*.ts"], { cwd: testDir });

  t.expect(exitCode).toBe(0);
  // TypeScript file should be formatted
  t.expect(fs.readFileSync(path.join(testDir, "test.ts"), "utf-8")).toBe("const a = 1;\n");
  // JSON file should remain unformatted (not matched by pattern)
  t.expect(fs.readFileSync(path.join(testDir, "test.json"), "utf-8")).toBe("{\"x\":1}");
});

t.it("returns 14 when no files found", async () => {
  const exitCode = await fmtCommand([], { cwd: testDir });

  t.expect(exitCode).toBe(14);
});

t.it("returns 0 when no files found with --allow-no-files", async () => {
  const exitCode = await fmtCommand([], { allowNoFiles: true, cwd: testDir });

  t.expect(exitCode).toBe(0);
});

t.it("returns 11 when no config file found", async () => {
  // Use isolated directory without config
  const isolatedDir = fs.mkdtempSync(path.join(os.tmpdir(), "dprint-test-noconfig-"));

  try {
    const exitCode = await fmtCommand([], { cwd: isolatedDir });
    t.expect(exitCode).toBe(11); // Config error exit code
  } finally {
    if (fs.existsSync(isolatedDir)) {
      fs.rmSync(isolatedDir, { recursive: true, force: true });
    }
  }
});

t.it("handles nested directories", async () => {
  const nestedDir = path.join(testDir, "src", "utils");
  fs.mkdirSync(nestedDir, { recursive: true });
  fs.writeFileSync(path.join(nestedDir, "helper.ts"), "const   x=1");

  const exitCode = await fmtCommand([], { cwd: testDir });

  t.expect(exitCode).toBe(0);
  t.expect(fs.readFileSync(path.join(nestedDir, "helper.ts"), "utf-8")).toBe("const x = 1;\n");
});

t.it("respects exclude patterns", async () => {
  const nodeModulesDir = path.join(testDir, "node_modules");
  fs.mkdirSync(nodeModulesDir);
  fs.writeFileSync(path.join(nodeModulesDir, "lib.ts"), "const   x=1");
  fs.writeFileSync(path.join(testDir, "src.ts"), "const   y=2");

  const exitCode = await fmtCommand([], { cwd: testDir });

  t.expect(exitCode).toBe(0);
  // File in node_modules should not be formatted
  t.expect(fs.readFileSync(path.join(nodeModulesDir, "lib.ts"), "utf-8")).toBe("const   x=1");
  // File in root should be formatted
  t.expect(fs.readFileSync(path.join(testDir, "src.ts"), "utf-8")).toBe("const y = 2;\n");
});
