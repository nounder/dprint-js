import { $ } from "bun";
import * as t from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as OutputFilePathsCommand from "../../src/commands/OutputFilePathsCommand.js";
import * as Testing from "../Testing.js";

const projectRoot = process.cwd();

// Get binary paths
const THEIR_BIN = Testing.THEIR_BIN;
const OURS_BIN = Testing.OURS_BIN;

// Get local plugin URL for rust dprint
const typescriptPluginUrl = Testing.getLocalPluginUrl("typescript", projectRoot);

let testDir;
let oursDir;
let theirsDir;

// Sample code
const sampleTS = `const x = 1;\n`;
const sampleJS = `const y = 2;\n`;

t.beforeEach(() => {
  // Create unique test directory in /tmp
  testDir = fs.mkdtempSync(path.join(os.tmpdir(), "dprint-test-comparison-output-file-paths-"));
  oursDir = path.join(testDir, "ours");
  theirsDir = path.join(testDir, "theirs");

  // Create test directories
  fs.mkdirSync(oursDir, { recursive: true });
  fs.mkdirSync(theirsDir, { recursive: true });

  // Create config for our implementation (npm-based)
  const ourConfig = {
    lineWidth: 80,
    indentWidth: 2,
    includes: ["**/*.{ts,js}"],
    excludes: ["**/node_modules"],
    plugins: ["@dprint/typescript"],
    typescript: {},
  };
  fs.writeFileSync(path.join(oursDir, "dprint.json"), JSON.stringify(ourConfig, null, 2));

  // Create config for rust dprint (using local plugin)
  const theirConfig = {
    lineWidth: 80,
    indentWidth: 2,
    includes: ["**/*.{ts,js}"],
    excludes: ["**/node_modules"],
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

t.it("lists same file paths when files exist", async () => {
  // Create test files
  fs.writeFileSync(path.join(oursDir, "test.ts"), sampleTS);
  fs.writeFileSync(path.join(oursDir, "test.js"), sampleJS);

  fs.writeFileSync(path.join(theirsDir, "test.ts"), sampleTS);
  fs.writeFileSync(path.join(theirsDir, "test.js"), sampleJS);

  // Run our implementation
  const ourResult = await $`${OURS_BIN} output-file-paths`.cwd(oursDir).nothrow().quiet();

  // Run rust dprint
  const theirResult = await $`${THEIR_BIN} output-file-paths`.cwd(theirsDir).nothrow().quiet();

  // Both should return exit code 0
  t.expect(ourResult.exitCode).toBe(0);
  t.expect(theirResult.exitCode).toBe(0);
  t.expect(ourResult.exitCode).toBe(theirResult.exitCode);

  // Parse file paths
  const ourFiles = ourResult.stdout.toString().trim().split("\n")
    .map(line => path.basename(line))
    .filter(line => line) // Filter empty lines
    .sort();
  const theirFiles = theirResult.stdout.toString().trim().split("\n")
    .map(line => path.basename(line))
    .filter(line => line) // Filter empty lines
    .sort();

  // Both should list test.ts and test.js
  t.expect(ourFiles).toEqual(["test.js", "test.ts"]);
  t.expect(theirFiles).toEqual(["test.js", "test.ts"]);
  t.expect(ourFiles).toEqual(theirFiles);
});

t.it("returns exit code 0 when no files found", async () => {
  // No files created

  // Run our implementation
  const ourExitCode = await OutputFilePathsCommand.run({ logLevel: "silent", cwd: oursDir });

  // Run rust dprint
  const theirResult = await $`${THEIR_BIN} output-file-paths --log-level silent`.cwd(theirsDir).nothrow().quiet();

  // Both should return exit code 0 (no files is not an error for this command)
  t.expect(ourExitCode).toBe(0);
  t.expect(theirResult.exitCode).toBe(0);
  t.expect(ourExitCode).toBe(theirResult.exitCode);
});

t.it("returns same exit code when config is missing", async () => {
  // Remove config files
  fs.unlinkSync(path.join(oursDir, "dprint.json"));
  fs.unlinkSync(path.join(theirsDir, "dprint.json"));

  // Run our implementation
  const ourExitCode = await OutputFilePathsCommand.run({
    logLevel: "silent",
    configDiscovery: false,
    cwd: oursDir,
  });

  // Run rust dprint
  const theirResult = await $`${THEIR_BIN} output-file-paths --log-level silent --config dprint.json`.cwd(theirsDir)
    .nothrow().quiet();

  // Both should return exit code 11 (config error)
  t.expect(ourExitCode).toBe(11);
  t.expect(theirResult.exitCode).toBe(11);
  t.expect(ourExitCode).toBe(theirResult.exitCode);
});

t.it("respects file patterns from command line", async () => {
  // Create multiple files
  fs.writeFileSync(path.join(oursDir, "test.ts"), sampleTS);
  fs.writeFileSync(path.join(oursDir, "test.js"), sampleJS);
  fs.writeFileSync(path.join(oursDir, "other.ts"), sampleTS);

  fs.writeFileSync(path.join(theirsDir, "test.ts"), sampleTS);
  fs.writeFileSync(path.join(theirsDir, "test.js"), sampleJS);
  fs.writeFileSync(path.join(theirsDir, "other.ts"), sampleTS);

  // Run our implementation with specific pattern
  const ourResult = await $`${OURS_BIN} output-file-paths test.ts`.cwd(oursDir).nothrow().quiet();

  // Run rust dprint with specific pattern
  const theirResult = await $`${THEIR_BIN} output-file-paths test.ts`.cwd(theirsDir).nothrow().quiet();

  // Both should return exit code 0
  t.expect(ourResult.exitCode).toBe(0);
  t.expect(theirResult.exitCode).toBe(0);

  // Parse file paths
  const ourFiles = ourResult.stdout.toString().trim().split("\n")
    .map(line => path.basename(line))
    .filter(line => line) // Filter empty lines
    .sort();
  const theirFiles = theirResult.stdout.toString().trim().split("\n")
    .map(line => path.basename(line))
    .filter(line => line) // Filter empty lines
    .sort();

  // Both should only list test.ts
  t.expect(ourFiles).toEqual(["test.ts"]);
  t.expect(theirFiles).toEqual(["test.ts"]);
  t.expect(ourFiles).toEqual(theirFiles);
});
