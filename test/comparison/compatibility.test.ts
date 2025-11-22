/**
 * Consolidated Compatibility Tests
 *
 * This file contains critical compatibility tests that verify our implementation
 * matches Rust dprint's behavior. These tests spawn external processes and are slow,
 * so we keep only the most important scenarios here.
 *
 * For detailed unit testing of specific features, see the unit test files.
 */
import { $ } from "bun";
import * as t from "bun:test";
import * as fs from "node:fs";
import fmtCommand from "../../src/commands/fmt.js";
import checkCommand from "../../src/commands/check.js";
import initCommand from "../../src/commands/init.js";
import {
  cleanupDir,
  createComparisonDirs,
  createTestFiles,
  malformattedJSON,
  malformattedMD,
  malformattedTS,
} from "../helpers.js";

const projectRoot = process.cwd();

let testDir: string;
let oursDir: string;
let theirsDir: string;

t.beforeEach(() => {
  const dirs = createComparisonDirs("dprint-test-compat-");
  testDir = dirs.testDir;
  oursDir = dirs.oursDir;
  theirsDir = dirs.theirsDir;
});

t.afterEach(() => {
  cleanupDir(testDir);
});

/**
 * GOLDEN PATH TESTS - Verify core functionality works identically
 */

t.it("formats all file types identically to rust dprint", async () => {
  // Create test files for all supported types
  createTestFiles(oursDir, [
    { name: "test.ts", content: malformattedTS },
    { name: "test.json", content: malformattedJSON },
    { name: "test.md", content: malformattedMD },
  ]);
  createTestFiles(theirsDir, [
    { name: "test.ts", content: malformattedTS },
    { name: "test.json", content: malformattedJSON },
    { name: "test.md", content: malformattedMD },
  ]);

  // Format with both implementations
  await fmtCommand([], { logLevel: "silent", cwd: oursDir });
  await $`npx dprint fmt --log-level silent`.cwd(theirsDir).quiet();

  // Compare results for all files
  for (const file of ["test.ts", "test.json", "test.md"]) {
    const ourResult = fs.readFileSync(`${oursDir}/${file}`, "utf-8");
    const theirResult = fs.readFileSync(`${theirsDir}/${file}`, "utf-8");
    t.expect(ourResult).toBe(theirResult);
  }
});

t.it("check command returns exit code 0 for formatted files", async () => {
  createTestFiles(oursDir, [{ name: "formatted.ts", content: "const x = 1;\n" }]);
  createTestFiles(theirsDir, [{ name: "formatted.ts", content: "const x = 1;\n" }]);

  const ourExitCode = await checkCommand([], { logLevel: "silent", cwd: oursDir });
  const theirResult = await $`npx dprint check --log-level silent`.cwd(theirsDir).nothrow().quiet();

  t.expect(ourExitCode).toBe(0);
  t.expect(theirResult.exitCode).toBe(0);
});

t.it("check command returns exit code 20 for unformatted files", async () => {
  createTestFiles(oursDir, [{ name: "unformatted.ts", content: malformattedTS }]);
  createTestFiles(theirsDir, [{ name: "unformatted.ts", content: malformattedTS }]);

  const ourExitCode = await checkCommand([], { logLevel: "silent", cwd: oursDir });
  const theirResult = await $`npx dprint check --log-level silent`.cwd(theirsDir).nothrow().quiet();

  t.expect(ourExitCode).toBe(20);
  t.expect(theirResult.exitCode).toBe(20);
});

t.it("respects file patterns and excludes identically", async () => {
  // Create nested directory structure
  createTestFiles(oursDir, [
    { name: "src/code.ts", content: malformattedTS },
    { name: "excluded/code.ts", content: malformattedTS },
  ]);
  createTestFiles(theirsDir, [
    { name: "src/code.ts", content: malformattedTS },
    { name: "excluded/code.ts", content: malformattedTS },
  ]);

  // Format with excludes
  await fmtCommand([], { excludes: ["**/excluded/**"], logLevel: "silent", cwd: oursDir });
  await $`npx dprint fmt --log-level silent --excludes "**/excluded/**"`.cwd(theirsDir).quiet();

  // src file should be formatted
  const ourSrc = fs.readFileSync(`${oursDir}/src/code.ts`, "utf-8");
  const theirSrc = fs.readFileSync(`${theirsDir}/src/code.ts`, "utf-8");
  t.expect(ourSrc).toBe(theirSrc);
  t.expect(ourSrc).not.toBe(malformattedTS);

  // excluded file should remain unformatted
  const ourExcluded = fs.readFileSync(`${oursDir}/excluded/code.ts`, "utf-8");
  const theirExcluded = fs.readFileSync(`${theirsDir}/excluded/code.ts`, "utf-8");
  t.expect(ourExcluded).toBe(malformattedTS);
  t.expect(theirExcluded).toBe(malformattedTS);
});

/**
 * ERROR HANDLING TESTS - Verify error codes match
 */

t.it("returns exit code 11 when config is missing", async () => {
  // Missing config
  fs.unlinkSync(`${oursDir}/dprint.json`);
  fs.unlinkSync(`${theirsDir}/dprint.json`);
  createTestFiles(oursDir, [{ name: "test.ts", content: malformattedTS }]);
  createTestFiles(theirsDir, [{ name: "test.ts", content: malformattedTS }]);

  const ourExitCode = await fmtCommand([], { logLevel: "silent", configDiscovery: false, cwd: oursDir });
  const theirResult = await $`npx dprint fmt --log-level silent --config dprint.json`.cwd(theirsDir).nothrow().quiet();

  t.expect(ourExitCode).toBe(11);
  t.expect(theirResult.exitCode).toBe(11);
});

t.it("returns exit code 14 when no files found", async () => {
  const ourExitCode = await fmtCommand(["non-existent-file.ts"], { logLevel: "silent", cwd: oursDir });
  const theirResult = await $`npx dprint fmt --log-level silent non-existent-file.ts`.cwd(theirsDir).nothrow().quiet();

  t.expect(ourExitCode).toBe(14);
  t.expect(theirResult.exitCode).toBe(14);
});

t.it("returns exit code 0 with --allow-no-files when no files found", async () => {
  const ourExitCode = await fmtCommand(["non-existent.ts"], {
    allowNoFiles: true,
    logLevel: "silent",
    cwd: oursDir,
  });
  const theirResult = await $`npx dprint fmt --log-level silent --allow-no-files non-existent.ts`.cwd(theirsDir)
    .nothrow().quiet();

  t.expect(ourExitCode).toBe(0);
  t.expect(theirResult.exitCode).toBe(0);
});

/**
 * STDIN TESTS - Verify stdin formatting works identically
 */

t.it("formats stdin identically to rust dprint", async () => {
  const dprintBin = `${projectRoot}/bin/dprint`;
  const inputFile = `${testDir}/input.txt`;
  fs.writeFileSync(inputFile, malformattedTS);

  // Format with our implementation
  const ourResult = await $`bun run ${dprintBin} fmt --stdin ts --log-level silent < ${inputFile}`.cwd(oursDir).text();

  // Format with rust dprint
  const theirResult = await $`npx dprint fmt --stdin ts --log-level silent < ${inputFile}`.cwd(theirsDir).text();

  // Results should be identical
  t.expect(ourResult).toBe(theirResult);
  t.expect(ourResult).toContain("const x = 1;");
});

/**
 * INIT COMMAND TEST - Verify init creates compatible config
 */

t.it("init creates config that rust dprint can use", async () => {
  // Init with our implementation
  await initCommand({ cwd: oursDir });

  // Read our config and convert plugins to URL-based for rust dprint
  const ourConfig = JSON.parse(fs.readFileSync(`${oursDir}/dprint.json`, "utf-8"));
  ourConfig.plugins = [
    "https://plugins.dprint.dev/typescript-0.93.0.wasm",
    "https://plugins.dprint.dev/json-0.19.3.wasm",
    "https://plugins.dprint.dev/markdown-0.17.8.wasm",
  ];
  fs.writeFileSync(`${theirsDir}/dprint.json`, JSON.stringify(ourConfig, null, 2));

  // Create test file and format with rust dprint
  createTestFiles(theirsDir, [{ name: "test.ts", content: malformattedTS }]);
  const result = await $`npx dprint fmt --log-level silent`.cwd(theirsDir).nothrow().quiet();

  // Should succeed
  t.expect(result.exitCode).toBe(0);

  // File should be formatted
  const formatted = fs.readFileSync(`${theirsDir}/test.ts`, "utf-8");
  t.expect(formatted).toContain("const x = 1");
});
