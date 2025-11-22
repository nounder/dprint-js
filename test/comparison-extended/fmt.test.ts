import { $ } from "bun";
import * as t from "bun:test";
import * as fs from "node:fs";
import * as path from "node:path";
import fmtCommand from "../../src/commands/fmt.js";
import {
  cleanupDir,
  createComparisonDirs,
  createTestFiles,
  malformattedJSON,
  malformattedMD,
  malformattedTS,
} from "../helpers.js";

let testDir: string;
let oursDir: string;
let theirsDir: string;

t.beforeEach(() => {
  const dirs = createComparisonDirs("dprint-test-comparison-fmt-");
  testDir = dirs.testDir;
  oursDir = dirs.oursDir;
  theirsDir = dirs.theirsDir;
});

t.afterEach(() => {
  cleanupDir(testDir);
});

t.it("formats TypeScript identically to rust dprint", async () => {
  createTestFiles(oursDir, [{ name: "test.ts", content: malformattedTS }]);
  createTestFiles(theirsDir, [{ name: "test.ts", content: malformattedTS }]);

  await fmtCommand([], { logLevel: "silent", cwd: oursDir });
  await $`npx dprint fmt --log-level silent`.cwd(theirsDir).quiet();

  const ourResult = fs.readFileSync(path.join(oursDir, "test.ts"), "utf-8");
  const theirResult = fs.readFileSync(path.join(theirsDir, "test.ts"), "utf-8");

  t.expect(ourResult).toBe(theirResult);
});

t.it("formats JSON identically to rust dprint", async () => {
  createTestFiles(oursDir, [{ name: "test.json", content: malformattedJSON }]);
  createTestFiles(theirsDir, [{ name: "test.json", content: malformattedJSON }]);

  await fmtCommand([], { logLevel: "silent", cwd: oursDir });
  await $`npx dprint fmt --log-level silent`.cwd(theirsDir).quiet();

  const ourResult = fs.readFileSync(path.join(oursDir, "test.json"), "utf-8");
  const theirResult = fs.readFileSync(path.join(theirsDir, "test.json"), "utf-8");

  t.expect(ourResult).toBe(theirResult);
});

t.it("formats Markdown identically to rust dprint", async () => {
  createTestFiles(oursDir, [{ name: "test.md", content: malformattedMD }]);
  createTestFiles(theirsDir, [{ name: "test.md", content: malformattedMD }]);

  await fmtCommand([], { logLevel: "silent", cwd: oursDir });
  await $`npx dprint fmt --log-level silent`.cwd(theirsDir).quiet();

  const ourResult = fs.readFileSync(path.join(oursDir, "test.md"), "utf-8");
  const theirResult = fs.readFileSync(path.join(theirsDir, "test.md"), "utf-8");

  t.expect(ourResult).toBe(theirResult);
});

t.it("handles multiple files identically to rust dprint", async () => {
  createTestFiles(oursDir, [
    { name: "file1.ts", content: malformattedTS },
    { name: "file2.json", content: malformattedJSON },
    { name: "file3.md", content: malformattedMD },
  ]);
  createTestFiles(theirsDir, [
    { name: "file1.ts", content: malformattedTS },
    { name: "file2.json", content: malformattedJSON },
    { name: "file3.md", content: malformattedMD },
  ]);

  await fmtCommand([], { logLevel: "silent", cwd: oursDir });
  await $`npx dprint fmt --log-level silent`.cwd(theirsDir).quiet();

  for (const file of ["file1.ts", "file2.json", "file3.md"]) {
    const ourResult = fs.readFileSync(path.join(oursDir, file), "utf-8");
    const theirResult = fs.readFileSync(path.join(theirsDir, file), "utf-8");
    t.expect(ourResult).toBe(theirResult);
  }
});

t.it("respects file patterns identically to rust dprint", async () => {
  createTestFiles(oursDir, [
    { name: "format.ts", content: malformattedTS },
    { name: "skip.json", content: malformattedJSON },
  ]);
  createTestFiles(theirsDir, [
    { name: "format.ts", content: malformattedTS },
    { name: "skip.json", content: malformattedJSON },
  ]);

  await fmtCommand(["*.ts"], { logLevel: "silent", cwd: oursDir });
  await $`npx dprint fmt --log-level silent *.ts`.cwd(theirsDir).quiet();

  const ourTS = fs.readFileSync(path.join(oursDir, "format.ts"), "utf-8");
  const theirTS = fs.readFileSync(path.join(theirsDir, "format.ts"), "utf-8");
  t.expect(ourTS).toBe(theirTS);

  const ourJSON = fs.readFileSync(path.join(oursDir, "skip.json"), "utf-8");
  const theirJSON = fs.readFileSync(path.join(theirsDir, "skip.json"), "utf-8");
  t.expect(ourJSON).toBe(malformattedJSON);
  t.expect(theirJSON).toBe(malformattedJSON);
});

t.it("respects excludes option identically to rust dprint", async () => {
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

// Error tests
t.it("returns same exit code when config file is missing", async () => {
  fs.unlinkSync(path.join(oursDir, "dprint.json"));
  fs.unlinkSync(path.join(theirsDir, "dprint.json"));

  createTestFiles(oursDir, [{ name: "test.ts", content: malformattedTS }]);
  createTestFiles(theirsDir, [{ name: "test.ts", content: malformattedTS }]);

  const ourExitCode = await fmtCommand([], { logLevel: "silent", configDiscovery: false, cwd: oursDir });
  const theirResult = await $`npx dprint fmt --log-level silent --config dprint.json`.cwd(theirsDir).nothrow().quiet();
  const theirExitCode = theirResult.exitCode;

  t.expect(ourExitCode).toBe(11);
  t.expect(theirExitCode).toBe(11);
  t.expect(ourExitCode).toBe(theirExitCode);
});

t.it("returns same exit code when config has invalid JSON", async () => {
  fs.writeFileSync(path.join(oursDir, "dprint.json"), "{ invalid json");
  fs.writeFileSync(path.join(theirsDir, "dprint.json"), "{ invalid json");

  createTestFiles(oursDir, [{ name: "test.ts", content: malformattedTS }]);
  createTestFiles(theirsDir, [{ name: "test.ts", content: malformattedTS }]);

  const ourExitCode = await fmtCommand([], { logLevel: "silent", cwd: oursDir });
  const theirResult = await $`npx dprint fmt --log-level silent`.cwd(theirsDir).nothrow().quiet();
  const theirExitCode = theirResult.exitCode;

  t.expect(ourExitCode).toBeGreaterThan(0);
  t.expect(theirExitCode).toBeGreaterThan(0);
  t.expect(ourExitCode).toBe(theirExitCode);
});

t.it("returns same exit code when config is missing plugins", async () => {
  const invalidConfig = {
    lineWidth: 80,
    indentWidth: 2,
    useTabs: false,
  };
  fs.writeFileSync(path.join(oursDir, "dprint.json"), JSON.stringify(invalidConfig, null, 2));
  fs.writeFileSync(path.join(theirsDir, "dprint.json"), JSON.stringify(invalidConfig, null, 2));

  createTestFiles(oursDir, [{ name: "test.ts", content: malformattedTS }]);
  createTestFiles(theirsDir, [{ name: "test.ts", content: malformattedTS }]);

  const ourExitCode = await fmtCommand([], { logLevel: "silent", cwd: oursDir });
  const theirResult = await $`npx dprint fmt --log-level silent`.cwd(theirsDir).nothrow().quiet();
  const theirExitCode = theirResult.exitCode;

  t.expect(ourExitCode).toBeGreaterThan(0);
  t.expect(theirExitCode).toBeGreaterThan(0);
  t.expect(ourExitCode).toBe(theirExitCode);
});

t.it("returns same exit code for non-existent file argument", async () => {
  // Format with our implementation for a non-existent file
  const ourExitCode = await fmtCommand(["non-existent-file.ts"], { logLevel: "silent", cwd: oursDir });

  // Format with rust dprint for a non-existent file
  const theirResult = await $`npx dprint fmt --log-level silent non-existent-file.ts`.cwd(theirsDir).nothrow().quiet();
  const theirExitCode = theirResult.exitCode;

  // Both should return error exit code (14 for no files found)
  t.expect(ourExitCode).toBe(14);
  t.expect(theirExitCode).toBe(14);
  t.expect(ourExitCode).toBe(theirExitCode);
});

t.it("returns same exit code with --allow-no-files for non-existent files", async () => {
  // Format with our implementation for a non-existent file with --allow-no-files
  const ourExitCode = await fmtCommand(["non-existent-file.ts"], {
    allowNoFiles: true,
    logLevel: "silent",
    cwd: oursDir,
  });

  // Format with rust dprint for a non-existent file with --allow-no-files
  const theirResult = await $`npx dprint fmt --log-level silent --allow-no-files non-existent-file.ts`.cwd(theirsDir)
    .nothrow().quiet();
  const theirExitCode = theirResult.exitCode;

  // Both should return success with --allow-no-files
  t.expect(ourExitCode).toBe(0);
  t.expect(theirExitCode).toBe(0);
  t.expect(ourExitCode).toBe(theirExitCode);
});
