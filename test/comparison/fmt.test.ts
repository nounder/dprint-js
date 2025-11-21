import { $ } from "bun";
import * as t from "bun:test";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import fmtCommand from "../../src/commands/fmt.js";

let testDir;
let oursDir;
let theirsDir;

// Sample malformatted code to test
const malformattedTS = `const   x=1;const    y={a:1,b:2};function    foo(){return    x+y.a;}`;
const malformattedJSON = `{"name":"test","nested":{"value":1,"items":["a","b","c"]}}`;
const malformattedMD = `# Title\n\n\n-  Item 1\n-  Item 2\n\n\n**Bold**and*italic*`;

t.beforeEach(() => {
  // Create unique test directory in /tmp
  testDir = fs.mkdtempSync(path.join(os.tmpdir(), "dprint-test-comparison-fmt-"));
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
    includes: ["**/*.{ts,js,md}", "test.json", "file*.json"],
    excludes: ["**/node_modules", "dprint.json"],
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
    incremental: false,
    includes: ["**/*.{ts,js,md}", "test.json", "file*.json"],
    excludes: ["**/node_modules", "dprint.json"],
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
});

t.afterEach(() => {
  // Clean up test directory
  if (testDir && fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
});

t.it("formats TypeScript identically to rust dprint", async () => {
  // Create test files
  const filename = "test.ts";
  fs.writeFileSync(path.join(oursDir, filename), malformattedTS);
  fs.writeFileSync(path.join(theirsDir, filename), malformattedTS);

  // Format with our implementation
  await fmtCommand([], { logLevel: "silent", cwd: oursDir });

  // Format with rust dprint
  await $`npx dprint fmt --log-level silent`.cwd(theirsDir).quiet();

  // Compare results
  const ourResult = fs.readFileSync(path.join(oursDir, filename), "utf-8");
  const theirResult = fs.readFileSync(path.join(theirsDir, filename), "utf-8");

  t.expect(ourResult).toBe(theirResult);
});

t.it("formats JSON identically to rust dprint", async () => {
  // Create test files
  const filename = "test.json";
  fs.writeFileSync(path.join(oursDir, filename), malformattedJSON);
  fs.writeFileSync(path.join(theirsDir, filename), malformattedJSON);

  // Format with our implementation
  await fmtCommand([], { logLevel: "silent", cwd: oursDir });

  // Format with rust dprint
  await $`npx dprint fmt --log-level silent`.cwd(theirsDir).quiet();

  // Compare results
  const ourResult = fs.readFileSync(path.join(oursDir, filename), "utf-8");
  const theirResult = fs.readFileSync(path.join(theirsDir, filename), "utf-8");

  t.expect(ourResult).toBe(theirResult);
});

t.it("formats Markdown identically to rust dprint", async () => {
  // Create test files
  const filename = "test.md";
  fs.writeFileSync(path.join(oursDir, filename), malformattedMD);
  fs.writeFileSync(path.join(theirsDir, filename), malformattedMD);

  // Format with our implementation
  await fmtCommand([], { logLevel: "silent", cwd: oursDir });

  // Format with rust dprint
  await $`npx dprint fmt --log-level silent`.cwd(theirsDir).quiet();

  // Compare results
  const ourResult = fs.readFileSync(path.join(oursDir, filename), "utf-8");
  const theirResult = fs.readFileSync(path.join(theirsDir, filename), "utf-8");

  t.expect(ourResult).toBe(theirResult);
});

t.it("handles multiple files identically to rust dprint", async () => {
  // Create multiple test files
  fs.writeFileSync(path.join(oursDir, "file1.ts"), malformattedTS);
  fs.writeFileSync(path.join(oursDir, "file2.json"), malformattedJSON);
  fs.writeFileSync(path.join(oursDir, "file3.md"), malformattedMD);

  fs.writeFileSync(path.join(theirsDir, "file1.ts"), malformattedTS);
  fs.writeFileSync(path.join(theirsDir, "file2.json"), malformattedJSON);
  fs.writeFileSync(path.join(theirsDir, "file3.md"), malformattedMD);

  // Format with our implementation
  await fmtCommand([], { logLevel: "silent", cwd: oursDir });

  // Format with rust dprint
  await $`npx dprint fmt --log-level silent`.cwd(theirsDir).quiet();

  // Compare results for all files
  for (const file of ["file1.ts", "file2.json", "file3.md"]) {
    const ourResult = fs.readFileSync(path.join(oursDir, file), "utf-8");
    const theirResult = fs.readFileSync(path.join(theirsDir, file), "utf-8");
    t.expect(ourResult).toBe(theirResult);
  }
});

t.it("respects file patterns identically to rust dprint", async () => {
  // Create test files
  fs.writeFileSync(path.join(oursDir, "format.ts"), malformattedTS);
  fs.writeFileSync(path.join(oursDir, "skip.json"), malformattedJSON);

  fs.writeFileSync(path.join(theirsDir, "format.ts"), malformattedTS);
  fs.writeFileSync(path.join(theirsDir, "skip.json"), malformattedJSON);

  // Format only .ts files with our implementation
  await fmtCommand(["*.ts"], { logLevel: "silent", cwd: oursDir });

  // Format only .ts files with rust dprint
  await $`npx dprint fmt --log-level silent *.ts`.cwd(theirsDir).quiet();

  // TS file should be formatted
  const ourTS = fs.readFileSync(path.join(oursDir, "format.ts"), "utf-8");
  const theirTS = fs.readFileSync(path.join(theirsDir, "format.ts"), "utf-8");
  t.expect(ourTS).toBe(theirTS);

  // JSON file should remain unformatted
  const ourJSON = fs.readFileSync(path.join(oursDir, "skip.json"), "utf-8");
  const theirJSON = fs.readFileSync(path.join(theirsDir, "skip.json"), "utf-8");
  t.expect(ourJSON).toBe(malformattedJSON);
  t.expect(theirJSON).toBe(malformattedJSON);
});

t.it("respects excludes option identically to rust dprint", async () => {
  // Create nested directories
  fs.mkdirSync(path.join(oursDir, "src"), { recursive: true });
  fs.mkdirSync(path.join(oursDir, "excluded"), { recursive: true });
  fs.mkdirSync(path.join(theirsDir, "src"), { recursive: true });
  fs.mkdirSync(path.join(theirsDir, "excluded"), { recursive: true });

  // Create test files
  fs.writeFileSync(path.join(oursDir, "src", "code.ts"), malformattedTS);
  fs.writeFileSync(path.join(oursDir, "excluded", "code.ts"), malformattedTS);
  fs.writeFileSync(path.join(theirsDir, "src", "code.ts"), malformattedTS);
  fs.writeFileSync(path.join(theirsDir, "excluded", "code.ts"), malformattedTS);

  // Format with excludes using our implementation
  await fmtCommand([], { excludes: ["**/excluded/**"], logLevel: "silent", cwd: oursDir });

  // Format with excludes using rust dprint
  await $`npx dprint fmt --log-level silent --excludes "**/excluded/**"`.cwd(theirsDir).quiet();

  // src file should be formatted
  const ourSrc = fs.readFileSync(path.join(oursDir, "src", "code.ts"), "utf-8");
  const theirSrc = fs.readFileSync(path.join(theirsDir, "src", "code.ts"), "utf-8");
  t.expect(ourSrc).toBe(theirSrc);

  // excluded file should remain unformatted
  const ourExcluded = fs.readFileSync(path.join(oursDir, "excluded", "code.ts"), "utf-8");
  const theirExcluded = fs.readFileSync(path.join(theirsDir, "excluded", "code.ts"), "utf-8");
  t.expect(ourExcluded).toBe(malformattedTS);
  t.expect(theirExcluded).toBe(malformattedTS);
});

// Error tests
t.it("returns same exit code when config file is missing", async () => {
  // Remove config files
  fs.unlinkSync(path.join(oursDir, "dprint.json"));
  fs.unlinkSync(path.join(theirsDir, "dprint.json"));

  // Create a test file
  fs.writeFileSync(path.join(oursDir, "test.ts"), malformattedTS);
  fs.writeFileSync(path.join(theirsDir, "test.ts"), malformattedTS);

  // Format with our implementation (disable config discovery to avoid finding parent config)
  const ourExitCode = await fmtCommand([], { logLevel: "silent", configDiscovery: false, cwd: oursDir });

  // Format with rust dprint (use --config to specify non-existent config)
  const theirResult = await $`npx dprint fmt --log-level silent --config dprint.json`.cwd(theirsDir).nothrow().quiet();
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

  // Format with our implementation
  const ourExitCode = await fmtCommand([], { logLevel: "silent", cwd: oursDir });

  // Format with rust dprint
  const theirResult = await $`npx dprint fmt --log-level silent`.cwd(theirsDir).nothrow().quiet();
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

  // Format with our implementation
  const ourExitCode = await fmtCommand([], { logLevel: "silent", cwd: oursDir });

  // Format with rust dprint
  const theirResult = await $`npx dprint fmt --log-level silent`.cwd(theirsDir).nothrow().quiet();
  const theirExitCode = theirResult.exitCode;

  // Both should return error exit code
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
