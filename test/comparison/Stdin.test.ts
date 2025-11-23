import { $ } from "bun";
import * as t from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as FmtCommand from "../../src/commands/FmtCommand.js";
import * as Testing from "../Testing.js";

let testDir;
let oursDir;
let theirsDir;

// Get path to our dprint binary
const projectRoot = path.resolve(import.meta.dir, "../..");

// Get binary paths
const THEIR_BIN = Testing.THEIR_BIN;
const OURS_BIN = Testing.OURS_BIN;

// Get local plugin URL for rust dprint
const typescriptPluginUrl = Testing.getLocalPluginUrl("typescript", projectRoot);

// Sample malformatted code to test
const malformattedTS = `const   x=1;const    y={a:1,b:2};function    foo(){return    x+y.a;}`;

t.beforeEach(() => {
  // Create unique test directory in /tmp
  testDir = fs.mkdtempSync(path.join(os.tmpdir(), "dprint-test-comparison-stdin-"));
  oursDir = path.join(testDir, "ours");
  theirsDir = path.join(testDir, "theirs");

  // Create test directories
  fs.mkdirSync(oursDir, { recursive: true });
  fs.mkdirSync(theirsDir, { recursive: true });

  // Create config for our implementation (npm-based)
  const ourConfig = {
    lineWidth: 80,
    indentWidth: 2,
    useTabs: false,
    incremental: false,
    includes: ["**/*.{ts,js}"],
    excludes: ["**/node_modules", "dprint.json"],
    plugins: ["@dprint/typescript"],
    typescript: {},
  };
  fs.writeFileSync(path.join(oursDir, "dprint.json"), JSON.stringify(ourConfig, null, 2));

  // Create config for rust dprint (using local plugin)
  const theirConfig = {
    lineWidth: 80,
    indentWidth: 2,
    useTabs: false,
    incremental: false,
    includes: ["**/*.{ts,js}"],
    excludes: ["**/node_modules", "dprint.json"],
    plugins: [
      typescriptPluginUrl,
    ],
    typescript: {},
  };
  fs.writeFileSync(path.join(theirsDir, "dprint.json"), JSON.stringify(theirConfig, null, 2));
});

t.afterEach(() => {
  // Clean up test directory
  if (testDir && fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
});

t.it("formats stdin with extension identically to rust dprint", async () => {
  // Write input to a temporary file
  const inputFile = path.join(testDir, "input.txt");
  fs.writeFileSync(inputFile, malformattedTS);

  // Format with our implementation using stdin
  const ourResult = await $`${OURS_BIN} fmt --stdin ts --log-level silent < ${inputFile}`.cwd(oursDir).text();

  // Format with rust dprint using stdin
  const theirResult = await $`${THEIR_BIN} fmt --stdin ts --log-level silent < ${inputFile}`.cwd(theirsDir).text();

  // Compare results
  t.expect(ourResult).toBe(theirResult);
});

t.it("formats stdin with filename identically to rust dprint", async () => {
  // Write input to a temporary file
  const inputFile = path.join(testDir, "input.txt");
  fs.writeFileSync(inputFile, malformattedTS);

  // Format with our implementation using stdin
  const ourResult = await $`${OURS_BIN} fmt --stdin test.ts --log-level silent < ${inputFile}`.cwd(oursDir)
    .text();

  // Format with rust dprint using stdin
  const theirResult = await $`${THEIR_BIN} fmt --stdin test.ts --log-level silent < ${inputFile}`.cwd(theirsDir).text();

  // Compare results
  t.expect(ourResult).toBe(theirResult);
});

t.it("handles stdin with absolute file path", async () => {
  // Create a test file path
  const testFilePath = path.join(oursDir, "src", "test.ts");
  const inputFile = path.join(testDir, "input.txt");
  fs.writeFileSync(inputFile, malformattedTS);

  // Format with our implementation using stdin with absolute path
  const ourResult = await $`${OURS_BIN} fmt --stdin ${testFilePath} --log-level silent < ${inputFile}`.cwd(
    oursDir,
  ).text();

  // The file doesn't need to exist - dprint just uses the path to determine the formatter
  // So we just verify it formats correctly
  t.expect(ourResult).toContain("const x = 1;");
  t.expect(ourResult).toContain("const y = { a: 1, b: 2 };");
});

t.it("returns error code when no formatter found for stdin extension", async () => {
  // Try to format with an unsupported extension
  const inputFile = path.join(testDir, "input.txt");
  fs.writeFileSync(inputFile, "some content");

  try {
    await $`${OURS_BIN} fmt --stdin xyz --log-level silent < ${inputFile}`.cwd(oursDir).quiet();
    t.expect(true).toBe(false); // Should not reach here
  } catch (proc) {
    t.expect(proc.exitCode).toBe(13); // Plugin error exit code
  }
});

t.it("formats stdin with info log level includes diagnostic messages", async () => {
  // Write input to a temporary file
  const inputFile = path.join(testDir, "input.txt");
  fs.writeFileSync(inputFile, malformattedTS);

  // Format with info log level
  const stdout = await $`${OURS_BIN} fmt --stdin ts --log-level info < ${inputFile}`.cwd(oursDir).text();

  // The formatted code should be in stdout
  t.expect(stdout).toContain("const x = 1;");

  // Diagnostic messages should also appear in stdout
  t.expect(stdout).toContain("Using configuration from:");
  t.expect(stdout).toContain("Loading plugins...");
});
