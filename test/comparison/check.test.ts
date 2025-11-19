import * as t from "bun:test";
import * as fs from "node:fs";
import * as path from "node:path";
import checkCommand from "../../src/commands/check.js";

const projectRoot = process.cwd();
const testDir = path.join(projectRoot, "test/comparison-tmp-check");
const oursDir = path.join(testDir, "ours");
const theirsDir = path.join(testDir, "theirs");

// Sample malformatted and formatted code
const malformattedTS = `const   x=1;const    y={a:1,b:2};`;
const formattedTS = `const x = 1;\nconst y = { a: 1, b: 2 };\n`;
const malformattedJSON = `{"a":1,"b":2}`;

t.beforeEach(() => {
  // Create test directories
  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
  fs.mkdirSync(oursDir, { recursive: true });
  fs.mkdirSync(theirsDir, { recursive: true });

  // Create config for our implementation (npm-based)
  const ourConfig = {
    lineWidth: 80,
    indentWidth: 2,
    useTabs: false,
    includes: ["**/*.{ts,js,md}", "test.json", "file*.json"],
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
    includes: ["**/*.{ts,js,md}", "test.json", "file*.json"],
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
});

t.afterEach(() => {
  process.chdir(projectRoot);
  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
});

t.it("returns same exit code for formatted files", async () => {
  // Create formatted files
  fs.writeFileSync(path.join(oursDir, "test.ts"), formattedTS);
  fs.writeFileSync(path.join(theirsDir, "test.ts"), formattedTS);

  // Check with our implementation
  process.chdir(oursDir);
  const ourExitCode = await checkCommand([], { log_level: "silent" });

  // Check with rust dprint
  process.chdir(theirsDir);
  const theirResult = await Bun.$`npx dprint check --log-level silent`.nothrow().quiet();
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
  process.chdir(oursDir);
  const ourExitCode = await checkCommand([], { log_level: "silent" });

  // Check with rust dprint
  process.chdir(theirsDir);
  const theirResult = await Bun.$`npx dprint check --log-level silent`.nothrow().quiet();
  const theirExitCode = theirResult.exitCode;

  // Both should return 1 (failure)
  t.expect(ourExitCode).toBe(20);
  t.expect(theirExitCode).toBe(20);
  t.expect(ourExitCode).toBe(theirExitCode);
});

t.it("returns same exit code for no files found", async () => {
  // No files created

  // Check with our implementation
  process.chdir(oursDir);
  const ourExitCode = await checkCommand([], { log_level: "silent" });

  // Check with rust dprint
  process.chdir(theirsDir);
  const theirResult = await Bun.$`npx dprint check --log-level silent`.nothrow().quiet();
  const theirExitCode = theirResult.exitCode;

  // Both should return 14 (no files found)
  t.expect(ourExitCode).toBe(14);
  t.expect(theirExitCode).toBe(14);
  t.expect(ourExitCode).toBe(theirExitCode);
});

t.it("returns same exit code with --allow-no-files", async () => {
  // No files created

  // Check with our implementation
  process.chdir(oursDir);
  const ourExitCode = await checkCommand([], { allow_no_files: true, log_level: "silent" });

  // Check with rust dprint
  process.chdir(theirsDir);
  const theirResult = await Bun.$`npx dprint check --log-level silent --allow-no-files`.nothrow().quiet();
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
  process.chdir(oursDir);
  const ourExitCode = await checkCommand([], { log_level: "silent" });

  // Check with rust dprint
  process.chdir(theirsDir);
  const theirResult = await Bun.$`npx dprint check --log-level silent`.nothrow().quiet();
  const theirExitCode = theirResult.exitCode;

  // Both should return 1 (failure due to unformatted file)
  t.expect(ourExitCode).toBe(20);
  t.expect(theirExitCode).toBe(20);
  t.expect(ourExitCode).toBe(theirExitCode);
});

t.it("respects file patterns identically", async () => {
  // Create files - test.json is in includes, skip.json is not
  fs.writeFileSync(path.join(oursDir, "check.ts"), malformattedTS);
  fs.writeFileSync(path.join(oursDir, "test.json"), malformattedJSON);

  fs.writeFileSync(path.join(theirsDir, "check.ts"), malformattedTS);
  fs.writeFileSync(path.join(theirsDir, "test.json"), malformattedJSON);

  // Check only test.json files with our implementation
  process.chdir(oursDir);
  const ourExitCode = await checkCommand(["test.json"], { log_level: "silent" });

  // Check only test.json files with rust dprint
  process.chdir(theirsDir);
  const theirResult = await Bun.$`npx dprint check --log-level silent test.json`.nothrow().quiet();
  const theirExitCode = theirResult.exitCode;

  // Both should fail because JSON is malformatted and matches includes
  t.expect(ourExitCode).toBe(20);
  t.expect(theirExitCode).toBe(20);
  t.expect(ourExitCode).toBe(theirExitCode);
});

t.it("list-different outputs same file paths", async () => {
  // Create unformatted files
  fs.writeFileSync(path.join(oursDir, "file1.ts"), malformattedTS);
  fs.writeFileSync(path.join(oursDir, "file2.json"), malformattedJSON);

  fs.writeFileSync(path.join(theirsDir, "file1.ts"), malformattedTS);
  fs.writeFileSync(path.join(theirsDir, "file2.json"), malformattedJSON);

  // Check with our implementation using --list-different
  process.chdir(oursDir);
  const ourResult = await Bun.$`bun run ${path.join(projectRoot, "bin/dprint-js.js")} check --list-different --log-level silent 2>&1`.nothrow().quiet();

  // Check with rust dprint using --list-different (outputs to stderr, so capture with 2>&1)
  process.chdir(theirsDir);
  const theirResult = await Bun.$`npx dprint check --list-different 2>&1`.nothrow().quiet();

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

  // Both should find file1.ts and file2.json
  t.expect(ourFiles.length).toBe(2);
  t.expect(theirFiles.length).toBe(2);
  t.expect(ourFiles).toEqual(theirFiles);
  t.expect(ourResult.exitCode).toBe(theirResult.exitCode);
});
