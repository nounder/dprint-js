import { $ } from "bun";
import * as t from "bun:test";
import * as fs from "node:fs";
import fmtCommand from "../../src/commands/fmt.js";
import {
  cleanupTestDirs,
  createTestDirs,
  createTestFiles,
  runBothInParallel,
  setupConfigs,
  testData,
  type TestDirs,
} from "./test-helpers.js";

let dirs: TestDirs;

t.beforeEach(() => {
  dirs = createTestDirs("comparison-fmt");
  setupConfigs(dirs);
});

t.afterEach(() => {
  cleanupTestDirs(dirs.testDir);
});

// Consolidated: Test formatting for multiple file types
t.it("formats all file types identically to rust dprint", async () => {
  // Create test files for all supported types
  createTestFiles(dirs, {
    "test.ts": testData.malformattedTS,
    "test.json": testData.malformattedJSON,
    "test.md": testData.malformattedMD,
  });

  // Run both formatters in parallel
  await runBothInParallel(
    () => fmtCommand([], { logLevel: "silent", cwd: dirs.oursDir }),
    () => $`npx dprint fmt --log-level silent`.cwd(dirs.theirsDir).quiet(),
  );

  // Compare results for all files
  for (const file of ["test.ts", "test.json", "test.md"]) {
    const ourResult = fs.readFileSync(`${dirs.oursDir}/${file}`, "utf-8");
    const theirResult = fs.readFileSync(`${dirs.theirsDir}/${file}`, "utf-8");
    t.expect(ourResult).toBe(theirResult);
  }
});

// Consolidated: Test pattern matching and excludes
t.it("respects file patterns and excludes identically to rust dprint", async () => {
  // Create directory structure
  fs.mkdirSync(`${dirs.oursDir}/src`, { recursive: true });
  fs.mkdirSync(`${dirs.oursDir}/excluded`, { recursive: true });
  fs.mkdirSync(`${dirs.theirsDir}/src`, { recursive: true });
  fs.mkdirSync(`${dirs.theirsDir}/excluded`, { recursive: true });

  createTestFiles(dirs, {
    "format.ts": testData.malformattedTS,
    "skip.json": testData.malformattedJSON,
    "src/code.ts": testData.malformattedTS,
    "excluded/code.ts": testData.malformattedTS,
  });

  // Test 1: Format only .ts files
  await runBothInParallel(
    () => fmtCommand(["*.ts"], { logLevel: "silent", cwd: dirs.oursDir }),
    () => $`npx dprint fmt --log-level silent *.ts`.cwd(dirs.theirsDir).quiet(),
  );

  // TS file should be formatted, JSON should not
  t.expect(fs.readFileSync(`${dirs.oursDir}/format.ts`, "utf-8"))
    .toBe(fs.readFileSync(`${dirs.theirsDir}/format.ts`, "utf-8"));
  t.expect(fs.readFileSync(`${dirs.oursDir}/skip.json`, "utf-8")).toBe(testData.malformattedJSON);
  t.expect(fs.readFileSync(`${dirs.theirsDir}/skip.json`, "utf-8")).toBe(testData.malformattedJSON);

  // Test 2: Format with excludes
  await runBothInParallel(
    () => fmtCommand([], { excludes: ["**/excluded/**"], logLevel: "silent", cwd: dirs.oursDir }),
    () => $`npx dprint fmt --log-level silent --excludes "**/excluded/**"`.cwd(dirs.theirsDir).quiet(),
  );

  // src file should be formatted, excluded should not
  const ourSrc = fs.readFileSync(`${dirs.oursDir}/src/code.ts`, "utf-8");
  const theirSrc = fs.readFileSync(`${dirs.theirsDir}/src/code.ts`, "utf-8");
  t.expect(ourSrc).toBe(theirSrc);

  const ourExcluded = fs.readFileSync(`${dirs.oursDir}/excluded/code.ts`, "utf-8");
  const theirExcluded = fs.readFileSync(`${dirs.theirsDir}/excluded/code.ts`, "utf-8");
  t.expect(ourExcluded).toBe(testData.malformattedTS);
  t.expect(theirExcluded).toBe(testData.malformattedTS);
});

// Consolidated: Error exit codes using test.each
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
      theirArgs: "fmt --log-level silent --config dprint.json",
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
      theirArgs: "fmt --log-level silent",
      expectedCode: null, // Just check they match, don't enforce specific code
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
      theirArgs: "fmt --log-level silent",
      expectedCode: null,
    },
    {
      name: "non-existent file",
      setup: () => {},
      ourOptions: { logLevel: "silent" },
      theirArgs: "fmt --log-level silent non-existent-file.ts",
      fileArgs: ["non-existent-file.ts"],
      expectedCode: 14,
    },
    {
      name: "non-existent file with --allow-no-files",
      setup: () => {},
      ourOptions: { allowNoFiles: true, logLevel: "silent" },
      theirArgs: "fmt --log-level silent --allow-no-files non-existent-file.ts",
      fileArgs: ["non-existent-file.ts"],
      expectedCode: 0,
    },
  ];

  errorCases.forEach(({ name, setup, ourOptions, theirArgs, fileArgs = [], expectedCode }) => {
    t.it(`returns same exit code for ${name}`, async () => {
      setup(dirs);

      // Run both in parallel
      const [ourExitCode, theirResult] = await runBothInParallel(
        () => fmtCommand(fileArgs, { ...ourOptions, cwd: dirs.oursDir }),
        () => $`npx dprint ${theirArgs}`.cwd(dirs.theirsDir).nothrow().quiet(),
      );

      const theirExitCode = theirResult.exitCode;

      if (expectedCode !== null) {
        t.expect(ourExitCode).toBe(expectedCode);
        t.expect(theirExitCode).toBe(expectedCode);
      }
      t.expect(ourExitCode).toBe(theirExitCode);
    });
  });
});
