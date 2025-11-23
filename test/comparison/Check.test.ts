import { $ } from "bun";
import * as t from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as CheckCommand from "../../src/commands/CheckCommand.js";
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

// Sample malformatted and formatted code
const malformattedTS = `const   x=1;const    y={a:1,b:2};`;
const formattedTS = `const x = 1;\nconst y = { a: 1, b: 2 };\n`;
const malformattedTS2 = `function    test(){const    z=3;return    z*2;}`;

t.beforeEach(() => {
  // Create unique test directory in /tmp
  testDir = fs.mkdtempSync(path.join(os.tmpdir(), "dprint-test-comparison-check-"));
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
    excludes: ["**/node_modules"],
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

t.it("returns same exit code for formatted files", async () => {
  // Create formatted files
  fs.writeFileSync(path.join(oursDir, "test.ts"), formattedTS);
  fs.writeFileSync(path.join(theirsDir, "test.ts"), formattedTS);

  // Check with our implementation
  const ourExitCode = await CheckCommand.run({ logLevel: "silent", cwd: oursDir });

  // Check with rust dprint
  const theirResult = await $`${THEIR_BIN} check --log-level silent`.cwd(theirsDir).nothrow().quiet();
  const theirExitCode = theirResult.exitCode;

  // Both should return 0 (success)
  t.expect(ourExitCode).toBe(0);
  t.expect(theirExitCode).toBe(0);
  t.expect(ourExitCode).toBe(theirExitCode);
});

t.it("returns same exit code for unformatted files", async () => {
  // Create unformatted files
  fs.writeFileSync(path.join(oursDir, "test.ts"), malformattedTS);
  fs.writeFileSync(path.join(theirsDir, "test.ts"), malformattedTS);

  // Check with our implementation
  const ourExitCode = await CheckCommand.run({ logLevel: "silent", cwd: oursDir });

  // Check with rust dprint
  const theirResult = await $`${THEIR_BIN} check --log-level silent`.cwd(theirsDir).nothrow().quiet();
  const theirExitCode = theirResult.exitCode;

  // Both should return 1 (failure)
  t.expect(ourExitCode).toBe(20);
  t.expect(theirExitCode).toBe(20);
  t.expect(ourExitCode).toBe(theirExitCode);
});

t.it("returns same exit code for no files found", async () => {
  // No files created

  // Check with our implementation
  const ourExitCode = await CheckCommand.run({ logLevel: "silent", cwd: oursDir });

  // Check with rust dprint
  const theirResult = await $`${THEIR_BIN} check --log-level silent`.cwd(theirsDir).nothrow().quiet();
  const theirExitCode = theirResult.exitCode;

  // Both should return 14 (no files found)
  t.expect(ourExitCode).toBe(14);
  t.expect(theirExitCode).toBe(14);
  t.expect(ourExitCode).toBe(theirExitCode);
});

t.it("returns same exit code with --allow-no-files", async () => {
  // No files created

  // Check with our implementation
  const ourExitCode = await CheckCommand.run({ allowNoFiles: true, logLevel: "silent", cwd: oursDir });

  // Check with rust dprint
  const theirResult = await $`${THEIR_BIN} check --log-level silent --allow-no-files`.cwd(theirsDir).nothrow().quiet();
  const theirExitCode = theirResult.exitCode;

  // Both should return 0 (success with --allow-no-files)
  t.expect(ourExitCode).toBe(0);
  t.expect(theirExitCode).toBe(0);
  t.expect(ourExitCode).toBe(theirExitCode);
});

t.it("handles mixed formatted/unformatted files identically", async () => {
  // Create mix of formatted and unformatted files
  fs.writeFileSync(path.join(oursDir, "formatted.ts"), formattedTS);
  fs.writeFileSync(path.join(oursDir, "unformatted.ts"), malformattedTS);

  fs.writeFileSync(path.join(theirsDir, "formatted.ts"), formattedTS);
  fs.writeFileSync(path.join(theirsDir, "unformatted.ts"), malformattedTS);

  // Check with our implementation
  const ourExitCode = await CheckCommand.run({ logLevel: "silent", cwd: oursDir });

  // Check with rust dprint
  const theirResult = await $`${THEIR_BIN} check --log-level silent`.cwd(theirsDir).nothrow().quiet();
  const theirExitCode = theirResult.exitCode;

  // Both should return 1 (failure due to unformatted file)
  t.expect(ourExitCode).toBe(20);
  t.expect(theirExitCode).toBe(20);
  t.expect(ourExitCode).toBe(theirExitCode);
});

t.it("respects file patterns identically", async () => {
  // Create files
  fs.writeFileSync(path.join(oursDir, "check.ts"), malformattedTS);
  fs.writeFileSync(path.join(oursDir, "test.ts"), malformattedTS2);

  fs.writeFileSync(path.join(theirsDir, "check.ts"), malformattedTS);
  fs.writeFileSync(path.join(theirsDir, "test.ts"), malformattedTS2);

  // Check only test.ts files with our implementation
  const ourExitCode = await CheckCommand.run({ filePatterns: ["test.ts"], logLevel: "silent", cwd: oursDir });

  // Check only test.ts files with rust dprint
  const theirResult = await $`${THEIR_BIN} check --log-level silent test.ts`.cwd(theirsDir).nothrow().quiet();
  const theirExitCode = theirResult.exitCode;

  // Both should fail because test.ts is malformatted
  t.expect(ourExitCode).toBe(20);
  t.expect(theirExitCode).toBe(20);
  t.expect(ourExitCode).toBe(theirExitCode);
});

t.it("list-different outputs same file paths", async () => {
  // Create unformatted files
  fs.writeFileSync(path.join(oursDir, "file1.ts"), malformattedTS);
  fs.writeFileSync(path.join(oursDir, "file2.ts"), malformattedTS2);

  fs.writeFileSync(path.join(theirsDir, "file1.ts"), malformattedTS);
  fs.writeFileSync(path.join(theirsDir, "file2.ts"), malformattedTS2);

  // Check with our implementation using --list-different
  const ourResult = await $`${OURS_BIN} check --list-different --log-level silent 2>&1`.cwd(oursDir).nothrow().quiet();

  // Check with rust dprint using --list-different (outputs to stderr, so capture with 2>&1)
  const theirResult = await $`${THEIR_BIN} check --list-different 2>&1`.cwd(theirsDir).nothrow().quiet();

  // Both should list the same files (order may differ)
  // Combine stdout and stderr, filter out non-file lines
  const ourOutput = ourResult.stdout.toString() + ourResult.stderr.toString();
  const theirOutput = theirResult.stdout.toString() + theirResult.stderr.toString();

  // Extract filenames from output (rust dprint uses full paths, we use relative)
  const ourFiles = ourOutput.trim().split("\n")
    .filter(line => line && (line.includes("file1.") || line.includes("file2.")))
    .map(line => path.basename(line))
    .sort();
  const theirFiles = theirOutput.trim().split("\n")
    .filter(line => line && (line.includes("file1.") || line.includes("file2.")))
    .map(line => path.basename(line))
    .sort();

  // Both should find file1.ts and file2.ts
  t.expect(ourFiles.length).toBe(2);
  t.expect(theirFiles.length).toBe(2);
  t.expect(ourFiles).toEqual(theirFiles);
  t.expect(ourResult.exitCode).toBe(theirResult.exitCode);
});

// Error tests
t.it("returns same exit code when config file is missing", async () => {
  // Remove config files
  fs.unlinkSync(path.join(oursDir, "dprint.json"));
  fs.unlinkSync(path.join(theirsDir, "dprint.json"));

  // Create a test file
  fs.writeFileSync(path.join(oursDir, "test.ts"), malformattedTS);
  fs.writeFileSync(path.join(theirsDir, "test.ts"), malformattedTS);

  // Check with our implementation (disable config discovery to avoid finding parent config)
  const ourExitCode = await CheckCommand.run({ logLevel: "silent", configDiscovery: false, cwd: oursDir });

  // Check with rust dprint (use --config to specify non-existent config)
  const theirResult = await $`${THEIR_BIN} check --log-level silent --config dprint.json`.cwd(theirsDir).nothrow()
    .quiet();
  const theirExitCode = theirResult.exitCode;

  // Both should return error exit code (11 for config error)
  t.expect(ourExitCode).toBe(11);
  t.expect(theirExitCode).toBe(11);
  t.expect(ourExitCode).toBe(theirExitCode);
});

t.it("returns same exit code when config has invalid JSON", async () => {
  // Write invalid JSON to config files
  fs.writeFileSync(path.join(oursDir, "dprint.json"), "{ invalid json");
  fs.writeFileSync(path.join(theirsDir, "dprint.json"), "{ invalid json");

  // Create a test file
  fs.writeFileSync(path.join(oursDir, "test.ts"), malformattedTS);
  fs.writeFileSync(path.join(theirsDir, "test.ts"), malformattedTS);

  // Check with our implementation
  const ourExitCode = await CheckCommand.run({ logLevel: "silent", cwd: oursDir });

  // Check with rust dprint
  const theirResult = await $`${THEIR_BIN} check --log-level silent`.cwd(theirsDir).nothrow().quiet();
  const theirExitCode = theirResult.exitCode;

  // Both should return error exit code
  t.expect(ourExitCode).toBeGreaterThan(0);
  t.expect(theirExitCode).toBeGreaterThan(0);
  t.expect(ourExitCode).toBe(theirExitCode);
});

t.it("returns same exit code when config is missing plugins", async () => {
  // Write config without plugins
  const invalidConfig = {
    lineWidth: 80,
    indentWidth: 2,
    useTabs: false,
  };
  fs.writeFileSync(path.join(oursDir, "dprint.json"), JSON.stringify(invalidConfig, null, 2));
  fs.writeFileSync(path.join(theirsDir, "dprint.json"), JSON.stringify(invalidConfig, null, 2));

  // Create a test file
  fs.writeFileSync(path.join(oursDir, "test.ts"), malformattedTS);
  fs.writeFileSync(path.join(theirsDir, "test.ts"), malformattedTS);

  // Check with our implementation
  const ourExitCode = await CheckCommand.run({ logLevel: "silent", cwd: oursDir });

  // Check with rust dprint
  const theirResult = await $`${THEIR_BIN} check --log-level silent`.cwd(theirsDir).nothrow().quiet();
  const theirExitCode = theirResult.exitCode;

  // Both should return error exit code
  t.expect(ourExitCode).toBeGreaterThan(0);
  t.expect(theirExitCode).toBeGreaterThan(0);
  t.expect(ourExitCode).toBe(theirExitCode);
});

t.it("returns same exit code for non-existent file argument", async () => {
  // Check with our implementation for a non-existent file
  const ourExitCode = await CheckCommand.run({ filePatterns: ["non-existent-file.ts"], logLevel: "silent", cwd: oursDir });

  // Check with rust dprint for a non-existent file
  const theirResult = await $`${THEIR_BIN} check --log-level silent non-existent-file.ts`.cwd(theirsDir).nothrow()
    .quiet();
  const theirExitCode = theirResult.exitCode;

  // Both should return error exit code (14 for no files found)
  t.expect(ourExitCode).toBe(14);
  t.expect(theirExitCode).toBe(14);
  t.expect(ourExitCode).toBe(theirExitCode);
});
