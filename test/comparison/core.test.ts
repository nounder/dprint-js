/**
 * Core Comparison Tests
 *
 * Critical compatibility tests that verify our implementation matches Rust dprint's
 * behavior. These tests run locally for fast feedback.
 *
 * For comprehensive comparison tests, run `bun test:full` which includes tests
 * in test/comparison-extended/
 */
import { $ } from "bun";
import * as t from "bun:test";
import * as fs from "node:fs";
import * as path from "node:path";
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
  const dirs = createComparisonDirs("dprint-test-comparison-core-");
  testDir = dirs.testDir;
  oursDir = dirs.oursDir;
  theirsDir = dirs.theirsDir;
});

t.afterEach(() => {
  cleanupDir(testDir);
});

/**
 * FORMATTING TESTS - Verify output matches
 */

t.it("formats all file types identically to rust dprint", async () => {
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

  await fmtCommand([], { logLevel: "silent", cwd: oursDir });
  await $`npx dprint fmt --log-level silent`.cwd(theirsDir).quiet();

  for (const file of ["test.ts", "test.json", "test.md"]) {
    const ourResult = fs.readFileSync(path.join(oursDir, file), "utf-8");
    const theirResult = fs.readFileSync(path.join(theirsDir, file), "utf-8");
    t.expect(ourResult).toBe(theirResult);
  }
});

t.it("respects file patterns and excludes identically", async () => {
  createTestFiles(oursDir, [
    { name: "src/code.ts", content: malformattedTS },
    { name: "excluded/code.ts", content: malformattedTS },
  ]);
  createTestFiles(theirsDir, [
    { name: "src/code.ts", content: malformattedTS },
    { name: "excluded/code.ts", content: malformattedTS },
  ]);

  await fmtCommand([], { excludes: ["**/excluded/**"], logLevel: "silent", cwd: oursDir });
  await $`npx dprint fmt --log-level silent --excludes "**/excluded/**"`.cwd(theirsDir).quiet();

  const ourSrc = fs.readFileSync(path.join(oursDir, "src/code.ts"), "utf-8");
  const theirSrc = fs.readFileSync(path.join(theirsDir, "src/code.ts"), "utf-8");
  t.expect(ourSrc).toBe(theirSrc);

  const ourExcluded = fs.readFileSync(path.join(oursDir, "excluded/code.ts"), "utf-8");
  const theirExcluded = fs.readFileSync(path.join(theirsDir, "excluded/code.ts"), "utf-8");
  t.expect(ourExcluded).toBe(malformattedTS);
  t.expect(theirExcluded).toBe(malformattedTS);
});

/**
 * CHECK COMMAND TESTS - Verify exit codes match
 */

t.it("check returns exit code 0 for formatted files", async () => {
  createTestFiles(oursDir, [{ name: "formatted.ts", content: "const x = 1;\n" }]);
  createTestFiles(theirsDir, [{ name: "formatted.ts", content: "const x = 1;\n" }]);

  const ourExitCode = await checkCommand([], { logLevel: "silent", cwd: oursDir });
  const theirResult = await $`npx dprint check --log-level silent`.cwd(theirsDir).nothrow().quiet();

  t.expect(ourExitCode).toBe(0);
  t.expect(theirResult.exitCode).toBe(0);
});

t.it("check returns exit code 20 for unformatted files", async () => {
  createTestFiles(oursDir, [{ name: "unformatted.ts", content: malformattedTS }]);
  createTestFiles(theirsDir, [{ name: "unformatted.ts", content: malformattedTS }]);

  const ourExitCode = await checkCommand([], { logLevel: "silent", cwd: oursDir });
  const theirResult = await $`npx dprint check --log-level silent`.cwd(theirsDir).nothrow().quiet();

  t.expect(ourExitCode).toBe(20);
  t.expect(theirResult.exitCode).toBe(20);
});

/**
 * ERROR HANDLING TESTS - Verify error codes match
 */

t.it("returns exit code 11 when config is missing", async () => {
  fs.unlinkSync(path.join(oursDir, "dprint.json"));
  fs.unlinkSync(path.join(theirsDir, "dprint.json"));

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
 * STDIN TEST - Verify stdin formatting works
 */

t.it("formats stdin identically to rust dprint", async () => {
  const dprintBin = `${projectRoot}/bin/dprint`;
  const inputFile = `${testDir}/input.txt`;
  fs.writeFileSync(inputFile, malformattedTS);

  const ourResult = await $`bun run ${dprintBin} fmt --stdin ts --log-level silent < ${inputFile}`.cwd(oursDir).text();
  const theirResult = await $`npx dprint fmt --stdin ts --log-level silent < ${inputFile}`.cwd(theirsDir).text();

  t.expect(ourResult).toBe(theirResult);
  t.expect(ourResult).toContain("const x = 1;");
});

/**
 * INIT COMMAND TEST - Verify init creates compatible config
 */

t.it("init creates config that rust dprint can use", async () => {
  await initCommand({ cwd: oursDir });

  const ourConfig = JSON.parse(fs.readFileSync(`${oursDir}/dprint.json`, "utf-8"));
  ourConfig.plugins = [
    "https://plugins.dprint.dev/typescript-0.93.0.wasm",
    "https://plugins.dprint.dev/json-0.19.3.wasm",
    "https://plugins.dprint.dev/markdown-0.17.8.wasm",
  ];
  fs.writeFileSync(`${theirsDir}/dprint.json`, JSON.stringify(ourConfig, null, 2));

  createTestFiles(theirsDir, [{ name: "test.ts", content: malformattedTS }]);
  const result = await $`npx dprint fmt --log-level silent`.cwd(theirsDir).nothrow().quiet();

  t.expect(result.exitCode).toBe(0);

  const formatted = fs.readFileSync(`${theirsDir}/test.ts`, "utf-8");
  t.expect(formatted).toContain("const x = 1");
});
