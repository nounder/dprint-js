import { $ } from "bun";
import * as t from "bun:test";
import * as fs from "node:fs";
import * as path from "path";
import {
  cleanupTestDirs,
  createTestDirs,
  projectRoot,
  runBothInParallel,
  setupConfigs,
  testData,
  type TestDirs,
} from "./test-helpers.js";

const dprintBin = path.join(projectRoot, "bin/dprint");

let dirs: TestDirs;

t.beforeEach(() => {
  dirs = createTestDirs("comparison-stdin");
  setupConfigs(dirs);
});

t.afterEach(() => {
  cleanupTestDirs(dirs.testDir);
});

// Consolidated: Test stdin formatting for different file types
t.describe("stdin formatting", () => {
  const stdinCases = [
    {
      name: "TypeScript with extension",
      input: testData.malformattedTS,
      arg: "ts",
    },
    {
      name: "TypeScript with filename",
      input: testData.malformattedTS,
      arg: "test.ts",
    },
    {
      name: "JSON with extension",
      input: testData.malformattedJSON,
      arg: "json",
    },
    {
      name: "Markdown with extension",
      input: testData.malformattedMD,
      arg: "md",
    },
  ];

  stdinCases.forEach(({ name, input, arg }) => {
    t.it(`formats ${name} identically to rust dprint`, async () => {
      // Write input to a temporary file for shell redirection
      const inputFile = path.join(dirs.testDir, "input.txt");
      fs.writeFileSync(inputFile, input);

      // Run both in parallel
      const [ourResult, theirResult] = await runBothInParallel(
        () => $`bun run ${dprintBin} fmt --stdin ${arg} --log-level silent < ${inputFile}`.cwd(dirs.oursDir).text(),
        () => $`npx dprint fmt --stdin ${arg} --log-level silent < ${inputFile}`.cwd(dirs.theirsDir).text(),
      );

      // Compare results
      t.expect(ourResult).toBe(theirResult);
    });
  });
});

// Test: Absolute file path
t.it("handles stdin with absolute file path", async () => {
  const testFilePath = path.join(dirs.oursDir, "src", "test.ts");
  const inputFile = path.join(dirs.testDir, "input.txt");
  fs.writeFileSync(inputFile, testData.malformattedTS);

  // Format with absolute path
  const ourResult = await $`bun run ${dprintBin} fmt --stdin ${testFilePath} --log-level silent < ${inputFile}`
    .cwd(dirs.oursDir)
    .text();

  // Verify it formats correctly
  t.expect(ourResult).toContain("const x = 1;");
  t.expect(ourResult).toContain("const y = { a: 1, b: 2 };");
});

// Test: Error for unsupported extension
t.it("returns error code when no formatter found for stdin extension", async () => {
  const inputFile = path.join(dirs.testDir, "input.txt");
  fs.writeFileSync(inputFile, "some content");

  try {
    await $`bun run ${dprintBin} fmt --stdin xyz --log-level silent < ${inputFile}`.cwd(dirs.oursDir).quiet();
    t.expect(true).toBe(false); // Should not reach here
  } catch (proc) {
    t.expect(proc.exitCode).toBe(13); // Plugin error exit code
  }
});

// Test: Info log level includes diagnostic messages
t.it("formats stdin with info log level includes diagnostic messages", async () => {
  const inputFile = path.join(dirs.testDir, "input.txt");
  fs.writeFileSync(inputFile, testData.malformattedTS);

  const stdout = await $`bun run ${dprintBin} fmt --stdin ts --log-level info < ${inputFile}`.cwd(dirs.oursDir).text();

  // The formatted code should be in stdout
  t.expect(stdout).toContain("const x = 1;");

  // Diagnostic messages should also appear
  t.expect(stdout).toContain("Using configuration from:");
  t.expect(stdout).toContain("Loading plugins...");
});
