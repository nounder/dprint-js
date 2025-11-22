import * as t from "bun:test";
import * as fs from "node:fs";
import * as path from "node:path";
import checkCommand from "../src/commands/check.js";
import { cleanupDir, createTestDir, createTestFiles, malformattedTS } from "./helpers.js";

let testDir: string;
let configPath: string;

t.beforeEach(() => {
  const dirs = createTestDir("dprint-test-check-");
  testDir = dirs.testDir;
  configPath = dirs.configPath;
});

t.afterEach(() => {
  cleanupDir(testDir);
});

t.it("passes for correctly formatted TypeScript files", async () => {
  createTestFiles(testDir, [{ name: "test.ts", content: "const x = 1;\n" }]);

  const exitCode = await checkCommand([], { cwd: testDir });

  t.expect(exitCode).toBe(0);
});

t.it("fails for unformatted TypeScript files", async () => {
  createTestFiles(testDir, [{ name: "test.ts", content: "const   x=1" }]);

  const exitCode = await checkCommand([], { cwd: testDir });

  t.expect(exitCode).toBe(20);
});

t.it("fails for unformatted JSON files", async () => {
  createTestFiles(testDir, [{ name: "test.json", content: "{\"a\":1,\"b\":2}" }]);

  const exitCode = await checkCommand([], { cwd: testDir });

  t.expect(exitCode).toBe(20);
});

t.it("passes when all files are formatted", async () => {
  createTestFiles(testDir, [
    { name: "test1.ts", content: "const a = 1;\n" },
    { name: "test2.ts", content: "const b = 2;\n" },
    { name: "test3.ts", content: "const c = 3;\n" },
  ]);

  const exitCode = await checkCommand([], { cwd: testDir });

  t.expect(exitCode).toBe(0);
});

t.it("fails when any file is unformatted", async () => {
  createTestFiles(testDir, [
    { name: "test1.ts", content: "const a = 1;\n" },
    { name: "test2.ts", content: "const   b=2" },
    { name: "test3.ts", content: "const c = 3;\n" },
  ]);

  const exitCode = await checkCommand([], { cwd: testDir });

  t.expect(exitCode).toBe(20);
});

t.it("does not modify files during check", async () => {
  const unformatted = "const   x=1";
  createTestFiles(testDir, [{ name: "test.ts", content: unformatted }]);

  await checkCommand([], { cwd: testDir });

  // File should remain unchanged
  t.expect(fs.readFileSync(path.join(testDir, "test.ts"), "utf-8")).toBe(unformatted);
});

t.it("checks only specified file patterns", async () => {
  createTestFiles(testDir, [
    { name: "test.ts", content: "const   a=1" },
    { name: "test.json", content: "{\"x\":1}" },
  ]);

  const exitCode = await checkCommand(["*.json"], { cwd: testDir });

  // Should fail because JSON file is not formatted
  t.expect(exitCode).toBe(20);
});

t.it("returns 14 when no files found", async () => {
  const exitCode = await checkCommand([], { cwd: testDir });

  t.expect(exitCode).toBe(14);
});

t.it("returns 0 when no files found with --allow-no-files", async () => {
  const exitCode = await checkCommand([], { allowNoFiles: true, cwd: testDir });

  t.expect(exitCode).toBe(0);
});

t.it("returns 11 when no config file found", async () => {
  // Use isolated directory without config
  cleanupDir(testDir);
  testDir = fs.mkdtempSync(path.join("/tmp", "dprint-test-noconfig-"));

  const exitCode = await checkCommand([], { cwd: testDir });
  t.expect(exitCode).toBe(11); // Config error exit code
});

t.it("respects exclude patterns", async () => {
  createTestFiles(testDir, [
    { name: "node_modules/lib.ts", content: "const   x=1" },
    { name: "src.ts", content: "const y = 2;\n" },
  ]);

  const exitCode = await checkCommand([], { cwd: testDir });

  // Should pass because unformatted file is in node_modules (excluded)
  t.expect(exitCode).toBe(0);
});

t.it("handles nested directories", async () => {
  createTestFiles(testDir, [{ name: "src/utils/helper.ts", content: "const x = 1;\n" }]);

  const exitCode = await checkCommand([], { cwd: testDir });

  t.expect(exitCode).toBe(0);
});

t.it("fails for multiple unformatted files", async () => {
  createTestFiles(testDir, [
    { name: "test1.ts", content: "const   a=1" },
    { name: "test2.ts", content: "const   b=2" },
    { name: "test3.ts", content: "const   c=3" },
  ]);

  const exitCode = await checkCommand([], { cwd: testDir });

  t.expect(exitCode).toBe(20);
});
