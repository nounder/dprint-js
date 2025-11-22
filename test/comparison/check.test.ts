import { $ } from "bun";
import * as t from "bun:test";
import * as fs from "node:fs";
import * as path from "path";
import checkCommand from "../../src/commands/check.js";
import {
  cleanupTestDirs,
  createTestDirs,
  createTestFiles,
  projectRoot,
  runBothInParallel,
  setupConfigs,
  testData,
  type TestDirs,
} from "./test-helpers.js";

let dirs: TestDirs;

t.beforeEach(() => {
  dirs = createTestDirs("comparison-check");
  setupConfigs(dirs);
});

t.afterEach(() => {
  cleanupTestDirs(dirs.testDir);
});

// Consolidated: Test check exit codes for various scenarios
t.describe("check exit codes", () => {
  const checkCases = [
    {
      name: "formatted files",
      files: { "test.ts": testData.formattedTS },
      expectedCode: 0,
    },
    {
      name: "unformatted files",
      files: { "test.ts": testData.malformattedTS },
      expectedCode: 20,
    },
    {
      name: "no files found",
      files: {},
      expectedCode: 14,
    },
    {
      name: "no files with --allow-no-files",
      files: {},
      ourOptions: { allowNoFiles: true },
      theirArgs: "check --log-level silent --allow-no-files",
      expectedCode: 0,
    },
    {
      name: "mixed formatted and unformatted",
      files: {
        "formatted.ts": testData.formattedTS,
        "unformatted.ts": testData.malformattedTS,
      },
      expectedCode: 20,
    },
  ];

  checkCases.forEach(({ name, files, ourOptions = {}, theirArgs, expectedCode }) => {
    t.it(`returns ${expectedCode} for ${name}`, async () => {
      createTestFiles(dirs, files);

      const defaultTheirArgs = theirArgs || "check --log-level silent";
      const [ourExitCode, theirResult] = await runBothInParallel(
        () => checkCommand([], { logLevel: "silent", ...ourOptions, cwd: dirs.oursDir }),
        () => $`npx dprint ${defaultTheirArgs}`.cwd(dirs.theirsDir).nothrow().quiet(),
      );

      t.expect(ourExitCode).toBe(expectedCode);
      t.expect(theirResult.exitCode).toBe(expectedCode);
      t.expect(ourExitCode).toBe(theirResult.exitCode);
    });
  });
});

// Test file pattern matching
t.it("respects file patterns identically", async () => {
  createTestFiles(dirs, {
    "check.ts": testData.malformattedTS,
    "test.json": testData.malformattedJSON,
  });

  // Check only test.json files
  const [ourExitCode, theirResult] = await runBothInParallel(
    () => checkCommand(["test.json"], { logLevel: "silent", cwd: dirs.oursDir }),
    () => $`npx dprint check --log-level silent test.json`.cwd(dirs.theirsDir).nothrow().quiet(),
  );

  // Both should fail because JSON is malformatted
  t.expect(ourExitCode).toBe(20);
  t.expect(theirResult.exitCode).toBe(20);
  t.expect(ourExitCode).toBe(theirResult.exitCode);
});

// Test --list-different output
t.it("list-different outputs same file paths", async () => {
  createTestFiles(dirs, {
    "file1.ts": testData.malformattedTS,
    "file2.json": testData.malformattedJSON,
  });

  // Run both with --list-different in parallel
  const [ourResult, theirResult] = await runBothInParallel(
    () =>
      $`bun run ${path.join(projectRoot, "bin/dprint-js")} check --list-different --log-level silent 2>&1`
        .cwd(dirs.oursDir)
        .nothrow()
        .quiet(),
    () => $`npx dprint check --list-different 2>&1`.cwd(dirs.theirsDir).nothrow().quiet(),
  );

  // Extract filenames from output
  const ourOutput = ourResult.stdout.toString() + ourResult.stderr.toString();
  const theirOutput = theirResult.stdout.toString() + theirResult.stderr.toString();

  const ourFiles = ourOutput
    .trim()
    .split("\n")
    .filter((line) => line && (line.includes("file1.") || line.includes("file2.")))
    .map((line) => path.basename(line))
    .sort();

  const theirFiles = theirOutput
    .trim()
    .split("\n")
    .filter((line) => line && (line.includes("file1.") || line.includes("file2.")))
    .map((line) => path.basename(line))
    .sort();

  // Both should find file1.ts and file2.json
  t.expect(ourFiles.length).toBe(2);
  t.expect(theirFiles.length).toBe(2);
  t.expect(ourFiles).toEqual(theirFiles);
  t.expect(ourResult.exitCode).toBe(theirResult.exitCode);
});

// Consolidated error cases
t.describe("error handling", () => {
  const errorCases = [
    {
      name: "missing config file",
      setup: (d: TestDirs) => {
        fs.unlinkSync(`${d.oursDir}/dprint.json`);
        fs.unlinkSync(`${d.theirsDir}/dprint.json`);
        createTestFiles(d, { "test.ts": testData.malformattedTS });
      },
      ourOptions: { logLevel: "silent", configDiscovery: false },
      theirArgs: "check --log-level silent --config dprint.json",
      expectedCode: 11,
    },
    {
      name: "invalid JSON config",
      setup: (d: TestDirs) => {
        fs.writeFileSync(`${d.oursDir}/dprint.json`, "{ invalid json");
        fs.writeFileSync(`${d.theirsDir}/dprint.json`, "{ invalid json");
        createTestFiles(d, { "test.ts": testData.malformattedTS });
      },
      ourOptions: { logLevel: "silent" },
      theirArgs: "check --log-level silent",
      expectedCode: null,
    },
    {
      name: "missing plugins",
      setup: (d: TestDirs) => {
        const invalidConfig = { lineWidth: 80, indentWidth: 2, useTabs: false };
        fs.writeFileSync(`${d.oursDir}/dprint.json`, JSON.stringify(invalidConfig, null, 2));
        fs.writeFileSync(`${d.theirsDir}/dprint.json`, JSON.stringify(invalidConfig, null, 2));
        createTestFiles(d, { "test.ts": testData.malformattedTS });
      },
      ourOptions: { logLevel: "silent" },
      theirArgs: "check --log-level silent",
      expectedCode: null,
    },
    {
      name: "non-existent file",
      setup: () => {},
      ourOptions: { logLevel: "silent" },
      theirArgs: "check --log-level silent non-existent-file.ts",
      fileArgs: ["non-existent-file.ts"],
      expectedCode: 14,
    },
  ];

  errorCases.forEach(({ name, setup, ourOptions, theirArgs, fileArgs = [], expectedCode }) => {
    t.it(`returns same exit code for ${name}`, async () => {
      setup(dirs);

      const [ourExitCode, theirResult] = await runBothInParallel(
        () => checkCommand(fileArgs, { ...ourOptions, cwd: dirs.oursDir }),
        () => $`npx dprint ${theirArgs}`.cwd(dirs.theirsDir).nothrow().quiet(),
      );

      if (expectedCode !== null) {
        t.expect(ourExitCode).toBe(expectedCode);
        t.expect(theirResult.exitCode).toBe(expectedCode);
      }
      t.expect(ourExitCode).toBe(theirResult.exitCode);
    });
  });
});
