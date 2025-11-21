import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import * as fs from "node:fs";
import * as path from "node:path";
import { findFiles } from "../src/files.js";

describe("gitignore recursive pattern fix", () => {
  let testDir: string;
  let originalCwd: string;

  beforeEach(() => {
    originalCwd = process.cwd();
    testDir = fs.mkdtempSync(path.join(import.meta.dir, "test-recursive-"));
    process.chdir(testDir);
    fs.mkdirSync(path.join(testDir, ".git"));
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  test("nested .gitignore with *.log pattern matches at all depths", async () => {
    const srcDir = path.join(testDir, "src");
    const subdirDir = path.join(srcDir, "subdir");
    const deepDir = path.join(subdirDir, "deep");

    fs.mkdirSync(srcDir);
    fs.mkdirSync(subdirDir);
    fs.mkdirSync(deepDir);

    // src/.gitignore contains *.log
    fs.writeFileSync(path.join(srcDir, ".gitignore"), "*.log\n");

    // Create log files at different depths
    fs.writeFileSync(path.join(testDir, "root.log"), "");
    fs.writeFileSync(path.join(srcDir, "app.log"), "");
    fs.writeFileSync(path.join(subdirDir, "debug.log"), "");
    fs.writeFileSync(path.join(deepDir, "trace.log"), "");

    // Create non-log files
    fs.writeFileSync(path.join(srcDir, "app.js"), "");
    fs.writeFileSync(path.join(subdirDir, "helper.js"), "");

    const config = { includes: ["**/*"] };
    const files = await findFiles(config, [], testDir);

    // Root log should NOT be ignored (not in src/)
    expect(files).toContain("root.log");

    // All .log files under src/ at ANY depth should be ignored
    expect(files).not.toContain("src/app.log");
    expect(files).not.toContain("src/subdir/debug.log");
    expect(files).not.toContain("src/subdir/deep/trace.log");

    // Non-log files should be included
    expect(files).toContain("src/app.js");
    expect(files).toContain("src/subdir/helper.js");
  });

  test("nested .gitignore with temp pattern matches directory at all depths", async () => {
    const srcDir = path.join(testDir, "src");
    const subdirDir = path.join(srcDir, "subdir");

    fs.mkdirSync(srcDir);
    fs.mkdirSync(subdirDir);

    // src/.gitignore contains temp (no slash)
    fs.writeFileSync(path.join(srcDir, ".gitignore"), "temp\n");

    // Create temp files/dirs at different depths
    fs.mkdirSync(path.join(testDir, "temp"));
    fs.writeFileSync(path.join(testDir, "temp", "file.txt"), "");

    fs.mkdirSync(path.join(srcDir, "temp"));
    fs.writeFileSync(path.join(srcDir, "temp", "cache.txt"), "");

    fs.mkdirSync(path.join(subdirDir, "temp"));
    fs.writeFileSync(path.join(subdirDir, "temp", "data.txt"), "");

    fs.writeFileSync(path.join(srcDir, "app.js"), "");

    const config = { includes: ["**/*"] };
    const files = await findFiles(config, [], testDir);

    // Root temp should NOT be ignored
    expect(files).toContain("temp/file.txt");

    // All temp under src/ at ANY depth should be ignored
    expect(files).not.toContain("src/temp/cache.txt");
    expect(files).not.toContain("src/subdir/temp/data.txt");

    // Other files should be included
    expect(files).toContain("src/app.js");
  });

  test("nested .gitignore with build/dist pattern only matches at src/build/dist", async () => {
    const srcDir = path.join(testDir, "src");
    const subdirDir = path.join(srcDir, "subdir");

    fs.mkdirSync(srcDir);
    fs.mkdirSync(subdirDir);

    // src/.gitignore contains build/dist (has slash - anchored)
    fs.writeFileSync(path.join(srcDir, ".gitignore"), "build/dist\n");

    // Create build/dist at different locations
    fs.mkdirSync(path.join(testDir, "build"));
    fs.mkdirSync(path.join(testDir, "build", "dist"));
    fs.writeFileSync(path.join(testDir, "build", "dist", "bundle.js"), "");

    fs.mkdirSync(path.join(srcDir, "build"));
    fs.mkdirSync(path.join(srcDir, "build", "dist"));
    fs.writeFileSync(path.join(srcDir, "build", "dist", "app.js"), "");

    fs.mkdirSync(path.join(subdirDir, "build"));
    fs.mkdirSync(path.join(subdirDir, "build", "dist"));
    fs.writeFileSync(path.join(subdirDir, "build", "dist", "sub.js"), "");

    const config = { includes: ["**/*"] };
    const files = await findFiles(config, [], testDir);

    // Root build/dist should NOT be ignored
    expect(files).toContain("build/dist/bundle.js");

    // src/build/dist should be ignored (anchored to src/)
    expect(files).not.toContain("src/build/dist/app.js");

    // src/subdir/build/dist should NOT be ignored (pattern has slash so not recursive)
    expect(files).toContain("src/subdir/build/dist/sub.js");
  });

  test("nested .gitignore with !important.log negation works recursively", async () => {
    fs.writeFileSync(
      path.join(testDir, ".gitignore"),
      "*.log\n",
    );

    const srcDir = path.join(testDir, "src");
    const subdirDir = path.join(srcDir, "subdir");

    fs.mkdirSync(srcDir);
    fs.mkdirSync(subdirDir);

    // src/.gitignore un-ignores important.log recursively
    fs.writeFileSync(path.join(srcDir, ".gitignore"), "!important.log\n");

    fs.writeFileSync(path.join(testDir, "root.log"), "");
    fs.writeFileSync(path.join(srcDir, "app.log"), "");
    fs.writeFileSync(path.join(srcDir, "important.log"), "");
    fs.writeFileSync(path.join(subdirDir, "debug.log"), "");
    fs.writeFileSync(path.join(subdirDir, "important.log"), "");

    const config = { includes: ["**/*"] };
    const files = await findFiles(config, [], testDir);

    // All .log files should be ignored by root .gitignore
    expect(files).not.toContain("root.log");
    expect(files).not.toContain("src/app.log");
    expect(files).not.toContain("src/subdir/debug.log");

    // important.log under src/ at any depth should be un-ignored
    expect(files).toContain("src/important.log");
    expect(files).toContain("src/subdir/important.log");
  });
});
