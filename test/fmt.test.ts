import * as t from "bun:test";
import * as fs from "node:fs";
import * as path from "node:path";
import fmtCommand from "../src/commands/fmt.js";
import { cleanupDir, createTestDir, createTestFiles, malformattedTS } from "./helpers.js";

let testDir: string;
let configPath: string;

t.beforeEach(() => {
  const dirs = createTestDir("dprint-test-fmt-");
  testDir = dirs.testDir;
  configPath = dirs.configPath;
});

t.afterEach(() => {
  cleanupDir(testDir);
});

t.it("formats TypeScript files", async () => {
  createTestFiles(testDir, [{ name: "test.ts", content: malformattedTS }]);

  const exitCode = await fmtCommand([], { cwd: testDir });

  t.expect(exitCode).toBe(0);
  const formatted = fs.readFileSync(path.join(testDir, "test.ts"), "utf-8");
  t.expect(formatted).toBe("const x = 1;\nconst y = { a: 1, b: 2 };\nfunction foo() {\n  return x + y.a;\n}\n");
});

t.it("formats JSON files", async () => {
  const unformatted = "{\"a\":1,\"b\":2}";
  createTestFiles(testDir, [{ name: "test.json", content: unformatted }]);

  const exitCode = await fmtCommand([], { cwd: testDir });

  t.expect(exitCode).toBe(0);
  const formatted = fs.readFileSync(path.join(testDir, "test.json"), "utf-8");
  t.expect(formatted).not.toBe(unformatted);
  t.expect(formatted).toContain("\n");
});

t.it("formats markdown files", async () => {
  const unformatted = "#   Title\n\nSome   text   here";
  createTestFiles(testDir, [{ name: "test.md", content: unformatted }]);

  const exitCode = await fmtCommand([], { cwd: testDir });

  t.expect(exitCode).toBe(0);
  const formatted = fs.readFileSync(path.join(testDir, "test.md"), "utf-8");
  t.expect(formatted).toBeDefined();
});

t.it("formats multiple files", async () => {
  createTestFiles(testDir, [
    { name: "test1.ts", content: "const   a=1" },
    { name: "test2.ts", content: "const   b=2" },
    { name: "test3.ts", content: "const   c=3" },
  ]);

  const exitCode = await fmtCommand([], { cwd: testDir });

  t.expect(exitCode).toBe(0);
  t.expect(fs.readFileSync(path.join(testDir, "test1.ts"), "utf-8")).toBe("const a = 1;\n");
  t.expect(fs.readFileSync(path.join(testDir, "test2.ts"), "utf-8")).toBe("const b = 2;\n");
  t.expect(fs.readFileSync(path.join(testDir, "test3.ts"), "utf-8")).toBe("const c = 3;\n");
});

t.it("skips already formatted files", async () => {
  const formatted = "const x = 1;\n";
  createTestFiles(testDir, [{ name: "test.ts", content: formatted }]);

  const exitCode = await fmtCommand([], { cwd: testDir });

  t.expect(exitCode).toBe(0);
  t.expect(fs.readFileSync(path.join(testDir, "test.ts"), "utf-8")).toBe(formatted);
});

t.it("formats only specified file patterns", async () => {
  createTestFiles(testDir, [
    { name: "test.ts", content: "const   a=1" },
    { name: "test.json", content: "{\"x\":1}" },
  ]);

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
  cleanupDir(testDir);
  testDir = fs.mkdtempSync(path.join("/tmp", "dprint-test-noconfig-"));

  const exitCode = await fmtCommand([], { cwd: testDir });
  t.expect(exitCode).toBe(11); // Config error exit code
});

t.it("handles nested directories", async () => {
  createTestFiles(testDir, [{ name: "src/utils/helper.ts", content: "const   x=1" }]);

  const exitCode = await fmtCommand([], { cwd: testDir });

  t.expect(exitCode).toBe(0);
  t.expect(fs.readFileSync(path.join(testDir, "src/utils/helper.ts"), "utf-8")).toBe("const x = 1;\n");
});

t.it("respects exclude patterns", async () => {
  createTestFiles(testDir, [
    { name: "node_modules/lib.ts", content: "const   x=1" },
    { name: "src.ts", content: "const   y=2" },
  ]);

  const exitCode = await fmtCommand([], { cwd: testDir });

  t.expect(exitCode).toBe(0);
  // File in node_modules should not be formatted
  t.expect(fs.readFileSync(path.join(testDir, "node_modules/lib.ts"), "utf-8")).toBe("const   x=1");
  // File in root should be formatted
  t.expect(fs.readFileSync(path.join(testDir, "src.ts"), "utf-8")).toBe("const y = 2;\n");
});

t.it("stdin mode outputs only formatted content to stdout", async () => {
  // Capture console.log and console.error
  const originalLog = console.log;
  const originalError = console.error;
  let consoleLogOutput: string[] = [];
  let consoleErrorOutput: string[] = [];

  console.log = function (...args) {
    consoleLogOutput.push(args.join(" "));
  };
  console.error = function (...args) {
    consoleErrorOutput.push(args.join(" "));
  };

  // Capture stdout
  const originalWrite = process.stdout.write;
  let stdoutData = "";
  process.stdout.write = function (chunk) {
    stdoutData += chunk;
    return true;
  };

  // Mock stdin
  const originalStdin = process.stdin;
  const { Readable } = await import("stream");
  const mockStdin = new Readable();
  mockStdin.push("const   x=1");
  mockStdin.push(null); // End of stream
  mockStdin.setEncoding = () => {};
  process.stdin = mockStdin;

  try {
    const exitCode = await fmtCommand([], {
      cwd: testDir,
      stdin: "ts",
    });

    t.expect(exitCode).toBe(0);

    // stdout should contain ONLY the formatted content, no diagnostic messages
    t.expect(stdoutData).toBe("const x = 1;\n");

    // No diagnostic messages should appear in console.log
    t.expect(consoleLogOutput.join("\n")).not.toContain("Using configuration from");
    t.expect(consoleLogOutput.join("\n")).not.toContain("Loading plugins");
    t.expect(consoleLogOutput.join("\n")).not.toContain("Loaded");
    t.expect(consoleLogOutput.join("\n")).not.toContain("[INFO]");
  } finally {
    // Restore
    console.log = originalLog;
    console.error = originalError;
    process.stdout.write = originalWrite;
    process.stdin = originalStdin;
  }
});
