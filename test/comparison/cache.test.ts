import { $ } from "bun";
import * as t from "bun:test";
import * as fs from "node:fs";
import * as path from "path";
import fmtCommand from "../../src/commands/fmt.js";
import {
  cleanupTestDirs,
  copyFixtures,
  countFormattedFiles,
  countSkippedFiles,
  createTestDirs,
  projectRoot,
  runBothInParallel,
  setupConfigs,
  type TestDirs,
} from "./test-helpers.js";

const fixturesDir = path.join(projectRoot, "test/fixtures");

let dirs: TestDirs;

t.beforeEach(() => {
  dirs = createTestDirs("comparison-cache");
  setupConfigs(dirs, { incremental: true }, { incremental: true });

  // Copy fixtures to both directories
  copyFixtures(dirs.oursDir, fixturesDir);
  copyFixtures(dirs.theirsDir, fixturesDir);
});

t.afterEach(() => {
  cleanupTestDirs(dirs.testDir);
});

// Test: Both implementations format all files on first run
t.it("both implementations format all files on first run", async () => {
  // Run both in parallel
  const [ourExitCode, theirResult] = await runBothInParallel(
    () => fmtCommand([], { logLevel: "info", cwd: dirs.oursDir }),
    () => $`npx dprint fmt`.cwd(dirs.theirsDir).nothrow().quiet(),
  );

  // Both should succeed
  t.expect(ourExitCode).toBe(0);
  t.expect(theirResult.exitCode).toBe(0);

  // Should have formatted files (we have .actual. fixtures)
  const expectedFiles = fs.readdirSync(dirs.oursDir).filter((f) => f.includes(".actual.")).length;
  t.expect(expectedFiles).toBeGreaterThan(0);
});

// Test: Both skip all files on second run (cache hit)
t.it("both implementations skip all files on second run (cache hit)", async () => {
  // First run - format everything
  await runBothInParallel(
    () => fmtCommand([], { logLevel: "silent", cwd: dirs.oursDir }),
    () => $`npx dprint fmt --log-level silent`.cwd(dirs.theirsDir).nothrow().quiet(),
  );

  // Second run - should skip everything
  const [ourResult, theirResult] = await runBothInParallel(
    () => $`bun run ${path.join(projectRoot, "bin/dprint-js")} fmt`.cwd(dirs.oursDir).nothrow().quiet(),
    () => $`npx dprint fmt`.cwd(dirs.theirsDir).nothrow().quiet(),
  );

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

// Test: Only format changed files after modification
t.it("both implementations only format changed files after modification", async () => {
  // First run - format everything
  await runBothInParallel(
    () => fmtCommand([], { logLevel: "silent", cwd: dirs.oursDir }),
    () => $`npx dprint fmt --log-level silent`.cwd(dirs.theirsDir).nothrow().quiet(),
  );

  // Modify one file in both directories
  const testFile = path.join(dirs.oursDir, "Sample.actual.ts");
  const testFileTheirs = path.join(dirs.theirsDir, "Sample.actual.ts");

  fs.appendFileSync(testFile, "\nconst x={a:1,b:2,c:3};\n");
  fs.appendFileSync(testFileTheirs, "\nconst x={a:1,b:2,c:3};\n");

  // Second run - should only format the modified file
  const [ourResult, theirResult] = await runBothInParallel(
    () => $`bun run ${path.join(projectRoot, "bin/dprint-js")} fmt`.cwd(dirs.oursDir).nothrow().quiet(),
    () => $`npx dprint fmt`.cwd(dirs.theirsDir).nothrow().quiet(),
  );

  const ourOutput = ourResult.stdout.toString();

  // Our implementation should report some skipped files
  const ourSkipped = countSkippedFiles(ourOutput);
  t.expect(ourSkipped).toBeGreaterThan(0);

  // Both should succeed
  t.expect(ourResult.exitCode).toBe(0);
  t.expect(theirResult.exitCode).toBe(0);
});

// Test: Invalidate cache when config changes
t.it("both implementations invalidate cache when config changes", async () => {
  // First run
  await runBothInParallel(
    () => fmtCommand([], { logLevel: "silent", cwd: dirs.oursDir }),
    () => $`npx dprint fmt --log-level silent`.cwd(dirs.theirsDir).nothrow().quiet(),
  );

  // Verify second run with no changes skips files
  const checkResult = await $`bun run ${path.join(projectRoot, "bin/dprint-js")} fmt`
    .cwd(dirs.oursDir)
    .nothrow()
    .quiet();
  const checkSkipped = countSkippedFiles(checkResult.stdout.toString());
  t.expect(checkSkipped).toBeGreaterThan(0);

  // Modify config (change indentWidth)
  const ourConfigPath = path.join(dirs.oursDir, "dprint.json");
  const theirConfigPath = path.join(dirs.theirsDir, "dprint.json");

  const ourConfig = JSON.parse(fs.readFileSync(ourConfigPath, "utf-8"));
  const theirConfig = JSON.parse(fs.readFileSync(theirConfigPath, "utf-8"));

  ourConfig.indentWidth = 4;
  theirConfig.indentWidth = 4;

  fs.writeFileSync(ourConfigPath, JSON.stringify(ourConfig, null, 2));
  fs.writeFileSync(theirConfigPath, JSON.stringify(theirConfig, null, 2));

  // Third run - should reformat due to config change
  const [ourResult, theirResult] = await runBothInParallel(
    () => $`bun run ${path.join(projectRoot, "bin/dprint-js")} fmt`.cwd(dirs.oursDir).nothrow().quiet(),
    () => $`npx dprint fmt`.cwd(dirs.theirsDir).nothrow().quiet(),
  );

  const ourOutput = ourResult.stdout.toString();

  // Files should be reformatted
  const ourFormatted = countFormattedFiles(ourOutput);
  t.expect(ourFormatted).toBeGreaterThan(0);

  // Both should succeed
  t.expect(ourResult.exitCode).toBe(0);
  t.expect(theirResult.exitCode).toBe(0);
});

// Test: Respect incremental=false
t.it("both implementations respect incremental=false", async () => {
  // Modify config to disable incremental
  const ourConfigPath = path.join(dirs.oursDir, "dprint.json");
  const theirConfigPath = path.join(dirs.theirsDir, "dprint.json");

  const ourConfig = JSON.parse(fs.readFileSync(ourConfigPath, "utf-8"));
  const theirConfig = JSON.parse(fs.readFileSync(theirConfigPath, "utf-8"));

  ourConfig.incremental = false;
  theirConfig.incremental = false;

  fs.writeFileSync(ourConfigPath, JSON.stringify(ourConfig, null, 2));
  fs.writeFileSync(theirConfigPath, JSON.stringify(theirConfig, null, 2));

  // First run
  await runBothInParallel(
    () => fmtCommand([], { logLevel: "silent", cwd: dirs.oursDir }),
    () => $`npx dprint fmt --log-level silent`.cwd(dirs.theirsDir).nothrow().quiet(),
  );

  // Second run - should NOT skip files (no caching)
  const [ourResult, theirResult] = await runBothInParallel(
    () => $`bun run ${path.join(projectRoot, "bin/dprint-js")} fmt`.cwd(dirs.oursDir).nothrow().quiet(),
    () => $`npx dprint fmt`.cwd(dirs.theirsDir).nothrow().quiet(),
  );

  const ourOutput = ourResult.stdout.toString();

  // Should NOT report skipped files when incremental is off
  const ourSkipped = countSkippedFiles(ourOutput);
  t.expect(ourSkipped).toBe(0);

  // Both should succeed
  t.expect(ourResult.exitCode).toBe(0);
  t.expect(theirResult.exitCode).toBe(0);
});
