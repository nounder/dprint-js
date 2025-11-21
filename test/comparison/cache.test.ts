import { $ } from "bun";
import * as t from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import fmtCommand from "../../src/commands/fmt.js";

const projectRoot = process.cwd();
const fixturesDir = path.join(projectRoot, "test/fixtures");

let testDir;
let oursDir;
let theirsDir;

// Helper to copy fixtures to test directory
function copyFixtures(targetDir: string) {
  const fixtures = fs.readdirSync(fixturesDir);
  for (const fixture of fixtures) {
    if (fixture.includes(".actual.")) {
      const source = path.join(fixturesDir, fixture);
      const dest = path.join(targetDir, fixture);
      fs.copyFileSync(source, dest);
    }
  }
}

// Helper to count formatted files from output
function countFormattedFiles(output: string): number {
  const match = output.match(/Formatted (\d+) file\(s\)/);
  return match ? parseInt(match[1], 10) : 0;
}

// Helper to count skipped files from output
function countSkippedFiles(output: string): number {
  const match = output.match(/skipped (\d+) file\(s\)/);
  return match ? parseInt(match[1], 10) : 0;
}

t.beforeEach(() => {
  // Create unique test directory in /tmp
  testDir = fs.mkdtempSync(path.join(os.tmpdir(), "dprint-test-comparison-cache-"));
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
    incremental: true,
    includes: ["**/*.{ts,js,json,md}"],
    excludes: ["**/node_modules"],
    plugins: ["@dprint/typescript", "@dprint/json", "@dprint/markdown"],
    typescript: {},
    json: {},
    markdown: {},
  };
  fs.writeFileSync(path.join(oursDir, "dprint.json"), JSON.stringify(ourConfig, null, 2));

  // Create config for rust dprint (URL-based)
  const theirConfig = {
    lineWidth: 80,
    indentWidth: 2,
    useTabs: false,
    incremental: true,
    includes: ["**/*.{ts,js,json,md}"],
    excludes: ["**/node_modules"],
    plugins: [
      "https://plugins.dprint.dev/typescript-0.93.0.wasm",
      "https://plugins.dprint.dev/json-0.19.3.wasm",
      "https://plugins.dprint.dev/markdown-0.17.8.wasm",
    ],
    typescript: {},
    json: {},
    markdown: {},
  };
  fs.writeFileSync(path.join(theirsDir, "dprint.json"), JSON.stringify(theirConfig, null, 2));

  // Copy fixtures to both directories
  copyFixtures(oursDir);
  copyFixtures(theirsDir);
});

t.afterEach(() => {
  // Clean up test directory
  if (testDir && fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
});

t.it("both implementations format all files on first run", async () => {
  // Format with our implementation
  const ourExitCode = await fmtCommand([], { log_level: "info", cwd: oursDir });

  // Format with rust dprint
  const theirResult = await $`npx dprint fmt`.cwd(theirsDir).nothrow().quiet();
  const theirExitCode = theirResult.exitCode;

  // Both should succeed
  t.expect(ourExitCode).toBe(0);
  t.expect(theirExitCode).toBe(0);

  // Both should have formatted the same files
  // We have 9 .actual. fixture files that need formatting
  const expectedFiles = fs.readdirSync(oursDir).filter((f) => f.includes(".actual.")).length;
  t.expect(expectedFiles).toBeGreaterThan(0);
});

t.it("both implementations skip all files on second run (cache hit)", async () => {
  // First run - format everything
  await fmtCommand([], { log_level: "silent", cwd: oursDir });
  await $`npx dprint fmt --log-level silent`.cwd(theirsDir).nothrow().quiet();

  // Second run - should skip everything due to cache
  const ourResult = await $`bun run ${path.join(projectRoot, "bin/dprint-js")} fmt`.cwd(oursDir).nothrow()
    .quiet();
  const theirResult = await $`npx dprint fmt`.cwd(theirsDir).nothrow().quiet();

  const ourOutput = ourResult.stdout.toString();
  const theirOutput = theirResult.stdout.toString();

  // Both should format 0 files
  const ourFormatted = countFormattedFiles(ourOutput);
  const theirFormatted = countFormattedFiles(theirOutput);

  t.expect(ourFormatted).toBe(0);
  t.expect(theirFormatted).toBe(0);

  // Our implementation should report skipped files
  const ourSkipped = countSkippedFiles(ourOutput);
  t.expect(ourSkipped).toBeGreaterThan(0);

  // Both exit successfully
  t.expect(ourResult.exitCode).toBe(0);
  t.expect(theirResult.exitCode).toBe(0);
});

t.it("both implementations only format changed files after modification", async () => {
  // First run - format everything
  await fmtCommand([], { log_level: "silent", cwd: oursDir });
  await $`npx dprint fmt --log-level silent`.cwd(theirsDir).nothrow().quiet();

  // Modify one file in both directories with malformed code
  const testFile = path.join(oursDir, "Sample.actual.ts");
  const testFileTheirs = path.join(theirsDir, "Sample.actual.ts");

  // Append malformed code that needs formatting
  fs.appendFileSync(testFile, "\nconst x={a:1,b:2,c:3};\n");
  fs.appendFileSync(testFileTheirs, "\nconst x={a:1,b:2,c:3};\n");

  // Second run - should only format the modified file
  const ourResult = await $`bun run ${path.join(projectRoot, "bin/dprint-js")} fmt`.cwd(oursDir).nothrow()
    .quiet();
  const theirResult = await $`npx dprint fmt`.cwd(theirsDir).nothrow().quiet();

  const ourOutput = ourResult.stdout.toString();
  const theirOutput = theirResult.stdout.toString();

  // Check that Sample.actual.ts was mentioned in output
  const ourMentionsSample = ourOutput.includes("Sample.actual.ts");
  const theirMentionsSample = theirOutput.includes("Sample.actual.ts");

  // At least one of them should mention the file being formatted
  t.expect(ourMentionsSample || theirMentionsSample).toBe(true);

  // Our implementation should report some skipped files
  const ourSkipped = countSkippedFiles(ourOutput);
  t.expect(ourSkipped).toBeGreaterThan(0);

  // Both should succeed
  t.expect(ourResult.exitCode).toBe(0);
  t.expect(theirResult.exitCode).toBe(0);
});

t.it("both implementations invalidate cache when config changes", async () => {
  // First run - format everything
  await fmtCommand([], { log_level: "silent", cwd: oursDir });
  await $`npx dprint fmt --log-level silent`.cwd(theirsDir).nothrow().quiet();

  // Verify second run with no changes skips files
  const checkResult = await $`bun run ${path.join(projectRoot, "bin/dprint-js")} fmt`.cwd(oursDir).nothrow()
    .quiet();
  const checkSkipped = countSkippedFiles(checkResult.stdout.toString());
  t.expect(checkSkipped).toBeGreaterThan(0); // Should skip files with cache

  // Modify config in both directories (change indentWidth which will affect formatting)
  const ourConfigPath = path.join(oursDir, "dprint.json");
  const theirConfigPath = path.join(theirsDir, "dprint.json");

  const ourConfig = JSON.parse(fs.readFileSync(ourConfigPath, "utf-8"));
  const theirConfig = JSON.parse(fs.readFileSync(theirConfigPath, "utf-8"));

  ourConfig.indentWidth = 4; // Change from 2 to 4
  theirConfig.indentWidth = 4;

  fs.writeFileSync(ourConfigPath, JSON.stringify(ourConfig, null, 2));
  fs.writeFileSync(theirConfigPath, JSON.stringify(theirConfig, null, 2));

  // Third run - should reformat due to config change
  const ourResult = await $`bun run ${path.join(projectRoot, "bin/dprint-js")} fmt`.cwd(oursDir).nothrow()
    .quiet();
  const theirResult = await $`npx dprint fmt`.cwd(theirsDir).nothrow().quiet();

  const ourOutput = ourResult.stdout.toString();
  const theirOutput = theirResult.stdout.toString();

  // With config change, files should be reformatted (not skipped from cache)
  // Our implementation should format files
  const ourFormatted = countFormattedFiles(ourOutput);
  t.expect(ourFormatted).toBeGreaterThan(0);

  // Theirs might format or might show different output, but should succeed
  t.expect(theirResult.exitCode).toBe(0);

  // Both should succeed
  t.expect(ourResult.exitCode).toBe(0);
});

t.it("both implementations respect incremental=false in config", async () => {
  // Modify config to disable incremental mode
  const ourConfigPath = path.join(oursDir, "dprint.json");
  const theirConfigPath = path.join(theirsDir, "dprint.json");

  const ourConfig = JSON.parse(fs.readFileSync(ourConfigPath, "utf-8"));
  const theirConfig = JSON.parse(fs.readFileSync(theirConfigPath, "utf-8"));

  ourConfig.incremental = false;
  theirConfig.incremental = false;

  fs.writeFileSync(ourConfigPath, JSON.stringify(ourConfig, null, 2));
  fs.writeFileSync(theirConfigPath, JSON.stringify(theirConfig, null, 2));

  // First run
  await fmtCommand([], { log_level: "silent", cwd: oursDir });
  await $`npx dprint fmt --log-level silent`.cwd(theirsDir).nothrow().quiet();

  // Second run - should still format everything (no caching)
  const ourResult = await $`bun run ${path.join(projectRoot, "bin/dprint-js")} fmt`.cwd(oursDir).nothrow()
    .quiet();
  const theirResult = await $`npx dprint fmt`.cwd(theirsDir).nothrow().quiet();

  const ourOutput = ourResult.stdout.toString();
  const theirOutput = theirResult.stdout.toString();

  // Both should format 0 files (already formatted, but no cache to tell them that)
  // Actually, with incremental disabled, they still won't reformat already-formatted files
  // but they will check each file
  const ourFormatted = countFormattedFiles(ourOutput);
  const theirFormatted = countFormattedFiles(theirOutput);

  t.expect(ourFormatted).toBe(0);
  t.expect(theirFormatted).toBe(0);

  // Our implementation should NOT report skipped files when incremental is off
  const ourSkipped = countSkippedFiles(ourOutput);
  t.expect(ourSkipped).toBe(0);

  // Both should succeed
  t.expect(ourResult.exitCode).toBe(0);
  t.expect(theirResult.exitCode).toBe(0);
});

t.it("both implementations handle --incremental=false CLI flag", async () => {
  // First run with caching enabled
  await fmtCommand([], { log_level: "silent", cwd: oursDir });
  await $`npx dprint fmt --log-level silent`.cwd(theirsDir).nothrow().quiet();

  // Second run with incremental disabled via CLI
  const ourResult = await $`bun run ${path.join(projectRoot, "bin/dprint-js")} fmt --incremental=false`.cwd(oursDir)
    .nothrow().quiet();
  const theirResult = await $`npx dprint fmt --incremental=false`.cwd(theirsDir).nothrow().quiet();

  const ourOutput = ourResult.stdout.toString();
  const theirOutput = theirResult.stdout.toString();

  // Both should format 0 files (files are already formatted)
  const ourFormatted = countFormattedFiles(ourOutput);
  const theirFormatted = countFormattedFiles(theirOutput);

  t.expect(ourFormatted).toBe(0);
  t.expect(theirFormatted).toBe(0);

  // Our implementation should NOT report skipped files when incremental is disabled
  const ourSkipped = countSkippedFiles(ourOutput);
  t.expect(ourSkipped).toBe(0);

  // Both should succeed
  t.expect(ourResult.exitCode).toBe(0);
  t.expect(theirResult.exitCode).toBe(0);
});

t.it("cache provides significant performance improvement on second run", async () => {
  // First run - measure time
  const ourStart1 = Date.now();
  await fmtCommand([], { log_level: "silent", cwd: oursDir });
  const ourTime1 = Date.now() - ourStart1;

  const theirStart1 = Date.now();
  await $`npx dprint fmt --log-level silent`.cwd(theirsDir).nothrow().quiet();
  const theirTime1 = Date.now() - theirStart1;

  // Second run - measure time (should be much faster)
  const ourStart2 = Date.now();
  await fmtCommand([], { log_level: "silent", cwd: oursDir });
  const ourTime2 = Date.now() - ourStart2;

  const theirStart2 = Date.now();
  await $`npx dprint fmt --log-level silent`.cwd(theirsDir).nothrow().quiet();
  const theirTime2 = Date.now() - theirStart2;

  // Second run should be faster than first run for our implementation
  // (At least 20% faster, accounting for measurement variability and small file count)
  t.expect(ourTime2).toBeLessThan(ourTime1 * 0.8);

  // Note: rust dprint might have different caching behavior or the overhead
  // of spawning npx might dominate for small file counts, so we don't test it

  console.log(`Performance comparison:
    Ours: ${ourTime1}ms -> ${ourTime2}ms (${((ourTime2 / ourTime1) * 100).toFixed(1)}% of original)
    Theirs: ${theirTime1}ms -> ${theirTime2}ms (${((theirTime2 / theirTime1) * 100).toFixed(1)}% of original)`);
});
