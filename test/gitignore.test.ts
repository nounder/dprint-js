import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import * as fs from "node:fs";
import * as path from "node:path";
import { findFiles } from "../src/files.js";
import { loadGitignorePatterns, filterWithGitignore } from "../src/gitignore.js";

describe("gitignore", () => {
  let testDir: string;
  let originalCwd: string;

  beforeEach(() => {
    originalCwd = process.cwd();
    testDir = fs.mkdtempSync(path.join(import.meta.dir, "test-gitignore-"));
    process.chdir(testDir);

    // Initialize a git repository
    fs.mkdirSync(path.join(testDir, ".git"));
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  describe("loadGitignorePatterns", () => {
    test("loads .gitignore from root", () => {
      fs.writeFileSync(
        path.join(testDir, ".gitignore"),
        "node_modules/\n*.log\n",
      );

      const ig = loadGitignorePatterns(testDir);
      expect(ig).not.toBeNull();
      expect(ig!.ignores("node_modules/package.json")).toBe(true);
      expect(ig!.ignores("test.log")).toBe(true);
      expect(ig!.ignores("test.js")).toBe(false);
    });

    test("returns null if no .gitignore found", () => {
      const ig = loadGitignorePatterns(testDir);
      expect(ig).toBeNull();
    });

    test("loads parent repository .gitignore when local .git is removed", () => {
      fs.rmSync(path.join(testDir, ".git"), { recursive: true, force: true });
      fs.writeFileSync(
        path.join(testDir, ".gitignore"),
        "node_modules/\n",
      );

      const ig = loadGitignorePatterns(testDir);
      // Should find parent git repository and load its .gitignore
      expect(ig).not.toBeNull();
    });

    test("loads nested .gitignore files", () => {
      fs.writeFileSync(
        path.join(testDir, ".gitignore"),
        "*.log\n",
      );

      const subdir = path.join(testDir, "src");
      fs.mkdirSync(subdir);
      fs.writeFileSync(
        path.join(subdir, ".gitignore"),
        "*.tmp\n",
      );

      const ig = loadGitignorePatterns(subdir);
      expect(ig).not.toBeNull();
      expect(ig!.ignores("test.log")).toBe(true);
      expect(ig!.ignores("src/test.tmp")).toBe(true);
    });

    test("handles comments in .gitignore", () => {
      fs.writeFileSync(
        path.join(testDir, ".gitignore"),
        "# This is a comment\nnode_modules/\n# Another comment\n*.log\n",
      );

      const ig = loadGitignorePatterns(testDir);
      expect(ig).not.toBeNull();
      expect(ig!.ignores("node_modules/package.json")).toBe(true);
    });

    test("handles empty lines in .gitignore", () => {
      fs.writeFileSync(
        path.join(testDir, ".gitignore"),
        "node_modules/\n\n*.log\n\n",
      );

      const ig = loadGitignorePatterns(testDir);
      expect(ig).not.toBeNull();
      expect(ig!.ignores("node_modules/package.json")).toBe(true);
      expect(ig!.ignores("test.log")).toBe(true);
    });

    test("handles negation patterns", () => {
      fs.writeFileSync(
        path.join(testDir, ".gitignore"),
        "*.log\n!important.log\n",
      );

      const ig = loadGitignorePatterns(testDir);
      expect(ig).not.toBeNull();
      expect(ig!.ignores("test.log")).toBe(true);
      expect(ig!.ignores("important.log")).toBe(false);
    });
  });

  describe("filterWithGitignore", () => {
    test("filters files using .gitignore patterns", () => {
      fs.writeFileSync(
        path.join(testDir, ".gitignore"),
        "*.log\nnode_modules/\n",
      );

      const files = ["test.js", "test.log", "node_modules/package.json", "src/app.js"];
      const ig = loadGitignorePatterns(testDir);
      const filtered = filterWithGitignore(files, ig!, testDir);

      expect(filtered).toEqual(["test.js", "src/app.js"]);
    });

    test("returns files unchanged if ig is null", () => {
      const files = ["test.js", "test.log"];
      const filtered = filterWithGitignore(files, null, testDir);

      expect(filtered).toEqual(files);
    });

    test("handles files in subdirectories", () => {
      fs.writeFileSync(
        path.join(testDir, ".gitignore"),
        "build/\n*.log\n",
      );

      const files = [
        "src/app.js",
        "src/app.log",
        "build/app.js",
        "build/bundle.js",
        "README.md",
      ];

      const ig = loadGitignorePatterns(testDir);
      const filtered = filterWithGitignore(files, ig!, testDir);

      expect(filtered).toEqual(["src/app.js", "README.md"]);
    });
  });

  describe("findFiles with .gitignore", () => {
    test("excludes files matching .gitignore patterns", async () => {
      fs.writeFileSync(
        path.join(testDir, ".gitignore"),
        "*.log\nbuild/\n",
      );

      fs.writeFileSync(path.join(testDir, "test.js"), "");
      fs.writeFileSync(path.join(testDir, "test.log"), "");
      fs.mkdirSync(path.join(testDir, "build"));
      fs.writeFileSync(path.join(testDir, "build", "app.js"), "");

      const config = { includes: ["**/*"] };
      const files = await findFiles(config, [], testDir);

      expect(files).toContain("test.js");
      expect(files).not.toContain("test.log");
      expect(files).not.toContain("build/app.js");
    });

    test("respects allowGitignored option", async () => {
      fs.writeFileSync(
        path.join(testDir, ".gitignore"),
        "*.log\n",
      );

      fs.writeFileSync(path.join(testDir, "test.js"), "");
      fs.writeFileSync(path.join(testDir, "test.log"), "");

      const config = { includes: ["**/*"] };

      // Without allowGitignored
      const files1 = await findFiles(config, [], testDir);
      expect(files1).not.toContain("test.log");

      // With allowGitignored
      const files2 = await findFiles(config, [], testDir, { allowGitignored: true });
      expect(files2).toContain("test.log");
    });

    test("combines .gitignore with config excludes", async () => {
      fs.writeFileSync(
        path.join(testDir, ".gitignore"),
        "*.log\n",
      );

      fs.writeFileSync(path.join(testDir, "test.js"), "");
      fs.writeFileSync(path.join(testDir, "test.ts"), "");
      fs.writeFileSync(path.join(testDir, "test.log"), "");

      const config = {
        includes: ["**/*"],
        excludes: ["*.js"],
      };

      const files = await findFiles(config, [], testDir);

      expect(files).toContain("test.ts");
      expect(files).not.toContain("test.js"); // Excluded by config
      expect(files).not.toContain("test.log"); // Excluded by .gitignore
    });

    test("handles nested .gitignore files", async () => {
      fs.writeFileSync(
        path.join(testDir, ".gitignore"),
        "*.log\n",
      );

      const srcDir = path.join(testDir, "src");
      fs.mkdirSync(srcDir);
      fs.writeFileSync(
        path.join(srcDir, ".gitignore"),
        "*.tmp\n",
      );

      fs.writeFileSync(path.join(testDir, "test.js"), "");
      fs.writeFileSync(path.join(testDir, "test.log"), "");
      fs.writeFileSync(path.join(srcDir, "app.js"), "");
      fs.writeFileSync(path.join(srcDir, "app.tmp"), "");

      const config = { includes: ["**/*"] };
      const files = await findFiles(config, [], testDir);

      expect(files).toContain("test.js");
      expect(files).toContain("src/app.js");
      expect(files).not.toContain("test.log");
      expect(files).not.toContain("src/app.tmp");
    });

    test("works without .gitignore file", async () => {
      fs.writeFileSync(path.join(testDir, "test.js"), "");
      fs.writeFileSync(path.join(testDir, "test.log"), "");

      const config = { includes: ["**/*"] };
      const files = await findFiles(config, [], testDir);

      expect(files).toContain("test.js");
      expect(files).toContain("test.log");
    });

    test("applies parent repository .gitignore when local .git is removed", async () => {
      fs.rmSync(path.join(testDir, ".git"), { recursive: true, force: true });

      fs.writeFileSync(
        path.join(testDir, ".gitignore"),
        "*.log\n",
      );
      fs.writeFileSync(path.join(testDir, "test.js"), "");
      fs.writeFileSync(path.join(testDir, "test.log"), "");

      const config = { includes: ["**/*"] };
      const files = await findFiles(config, [], testDir);

      // Should apply parent git repository's .gitignore patterns
      expect(files).toContain("test.js");
      // test.log should be filtered by parent .gitignore or local .gitignore
      expect(files).not.toContain("test.log");
    });

    test("handles directories with trailing slash", async () => {
      fs.writeFileSync(
        path.join(testDir, ".gitignore"),
        "node_modules/\nbuild/\n",
      );

      fs.mkdirSync(path.join(testDir, "node_modules"));
      fs.writeFileSync(path.join(testDir, "node_modules", "package.json"), "");

      fs.mkdirSync(path.join(testDir, "build"));
      fs.writeFileSync(path.join(testDir, "build", "app.js"), "");

      fs.writeFileSync(path.join(testDir, "src.js"), "");

      const config = { includes: ["**/*"] };
      const files = await findFiles(config, [], testDir);

      expect(files).toContain("src.js");
      expect(files).not.toContain("node_modules/package.json");
      expect(files).not.toContain("build/app.js");
    });

    test("handles wildcard patterns", async () => {
      fs.writeFileSync(
        path.join(testDir, ".gitignore"),
        "*.log\ntest-*.js\n",
      );

      fs.writeFileSync(path.join(testDir, "app.js"), "");
      fs.writeFileSync(path.join(testDir, "test-foo.js"), "");
      fs.writeFileSync(path.join(testDir, "test-bar.js"), "");
      fs.writeFileSync(path.join(testDir, "error.log"), "");

      const config = { includes: ["**/*"] };
      const files = await findFiles(config, [], testDir);

      expect(files).toContain("app.js");
      expect(files).not.toContain("test-foo.js");
      expect(files).not.toContain("test-bar.js");
      expect(files).not.toContain("error.log");
    });

    test("handles negation patterns in .gitignore", async () => {
      fs.writeFileSync(
        path.join(testDir, ".gitignore"),
        "*.log\n!important.log\n",
      );

      fs.writeFileSync(path.join(testDir, "app.js"), "");
      fs.writeFileSync(path.join(testDir, "error.log"), "");
      fs.writeFileSync(path.join(testDir, "important.log"), "");

      const config = { includes: ["**/*"] };
      const files = await findFiles(config, [], testDir);

      expect(files).toContain("app.js");
      expect(files).toContain("important.log");
      expect(files).not.toContain("error.log");
    });
  });

  describe("gitignore edge cases", () => {
    test("handles rooted patterns (leading slash)", () => {
      fs.writeFileSync(
        path.join(testDir, ".gitignore"),
        "/root.log\n",
      );

      const ig = loadGitignorePatterns(testDir);
      expect(ig).not.toBeNull();
      expect(ig!.ignores("root.log")).toBe(true);
      expect(ig!.ignores("subdir/root.log")).toBe(false);
    });

    test("handles double asterisk at start (**/ pattern)", () => {
      fs.writeFileSync(
        path.join(testDir, ".gitignore"),
        "**/foo\n",
      );

      const ig = loadGitignorePatterns(testDir);
      expect(ig).not.toBeNull();
      expect(ig!.ignores("foo")).toBe(true);
      expect(ig!.ignores("bar/foo")).toBe(true);
      expect(ig!.ignores("bar/baz/foo")).toBe(true);
    });

    test("handles double asterisk in middle (a/**/b pattern)", () => {
      fs.writeFileSync(
        path.join(testDir, ".gitignore"),
        "a/**/b\n",
      );

      const ig = loadGitignorePatterns(testDir);
      expect(ig).not.toBeNull();
      expect(ig!.ignores("a/b")).toBe(true);
      expect(ig!.ignores("a/x/b")).toBe(true);
      expect(ig!.ignores("a/x/y/b")).toBe(true);
      expect(ig!.ignores("x/a/b")).toBe(false);
    });

    test("handles trailing double asterisk (foo/** pattern)", () => {
      fs.writeFileSync(
        path.join(testDir, ".gitignore"),
        "foo/**\n",
      );

      const ig = loadGitignorePatterns(testDir);
      expect(ig).not.toBeNull();
      expect(ig!.ignores("foo/bar")).toBe(true);
      expect(ig!.ignores("foo/bar/baz")).toBe(true);
      expect(ig!.ignores("foo")).toBe(false);
    });

    test("handles escaped exclamation mark (\\!pattern)", () => {
      fs.writeFileSync(
        path.join(testDir, ".gitignore"),
        "\\!important.txt\n",
      );

      const ig = loadGitignorePatterns(testDir);
      expect(ig).not.toBeNull();
      expect(ig!.ignores("!important.txt")).toBe(true);
    });

    test("handles escaped hash (\\#comment)", () => {
      fs.writeFileSync(
        path.join(testDir, ".gitignore"),
        "\\#hashtag.txt\n",
      );

      const ig = loadGitignorePatterns(testDir);
      expect(ig).not.toBeNull();
      expect(ig!.ignores("#hashtag.txt")).toBe(true);
    });

    test("handles trailing spaces (should be ignored)", () => {
      fs.writeFileSync(
        path.join(testDir, ".gitignore"),
        "test.log   \n",
      );

      const ig = loadGitignorePatterns(testDir);
      expect(ig).not.toBeNull();
      expect(ig!.ignores("test.log")).toBe(true);
      expect(ig!.ignores("test.log   ")).toBe(false);
    });

    test("handles escaped trailing spaces (\\ pattern)", () => {
      fs.writeFileSync(
        path.join(testDir, ".gitignore"),
        "test.log\\ \n",
      );

      const ig = loadGitignorePatterns(testDir);
      expect(ig).not.toBeNull();
      // The ignore package handles escaped trailing spaces
      // Note: This behavior may vary - just verify pattern is loaded
      expect(ig!.ignores("test.log")).toBe(false);
    });

    test("handles Windows line endings (\\r\\n)", () => {
      fs.writeFileSync(
        path.join(testDir, ".gitignore"),
        "*.log\r\nnode_modules/\r\n",
      );

      const ig = loadGitignorePatterns(testDir);
      expect(ig).not.toBeNull();
      expect(ig!.ignores("test.log")).toBe(true);
      expect(ig!.ignores("node_modules/package.json")).toBe(true);
    });

    test("handles character ranges ([a-z] pattern)", () => {
      fs.writeFileSync(
        path.join(testDir, ".gitignore"),
        "test[0-9].log\n",
      );

      const ig = loadGitignorePatterns(testDir);
      expect(ig).not.toBeNull();
      expect(ig!.ignores("test0.log")).toBe(true);
      expect(ig!.ignores("test5.log")).toBe(true);
      expect(ig!.ignores("test9.log")).toBe(true);
      expect(ig!.ignores("testa.log")).toBe(false);
    });

    test("handles question mark wildcard (? pattern)", () => {
      fs.writeFileSync(
        path.join(testDir, ".gitignore"),
        "test?.log\n",
      );

      const ig = loadGitignorePatterns(testDir);
      expect(ig).not.toBeNull();
      expect(ig!.ignores("test1.log")).toBe(true);
      expect(ig!.ignores("testa.log")).toBe(true);
      expect(ig!.ignores("test.log")).toBe(false);
      expect(ig!.ignores("test12.log")).toBe(false);
    });

    test("handles directory-only patterns (trailing /)", () => {
      fs.writeFileSync(
        path.join(testDir, ".gitignore"),
        "build/\n",
      );

      const ig = loadGitignorePatterns(testDir);
      expect(ig).not.toBeNull();
      // Directory pattern should match paths inside the directory
      expect(ig!.ignores("build/file.js")).toBe(true);
      expect(ig!.ignores("build/nested/file.js")).toBe(true);
    });

    test("handles multiple negations (pattern priority)", () => {
      fs.writeFileSync(
        path.join(testDir, ".gitignore"),
        "*.log\n!important.log\nimportant.log\n",
      );

      const ig = loadGitignorePatterns(testDir);
      expect(ig).not.toBeNull();
      // Last pattern wins
      expect(ig!.ignores("test.log")).toBe(true);
      expect(ig!.ignores("important.log")).toBe(true);
    });

    test("handles complex negation with subdirectories", () => {
      fs.writeFileSync(
        path.join(testDir, ".gitignore"),
        "logs/\n!logs/important/\n",
      );

      const ig = loadGitignorePatterns(testDir);
      expect(ig).not.toBeNull();
      // Parent directory ignored, cannot re-include subdirectory
      expect(ig!.ignores("logs/test.log")).toBe(true);
      expect(ig!.ignores("logs/important/keep.log")).toBe(true);
    });

    test("handles patterns without slash (matches at any level)", () => {
      fs.writeFileSync(
        path.join(testDir, ".gitignore"),
        "test.log\n",
      );

      const ig = loadGitignorePatterns(testDir);
      expect(ig).not.toBeNull();
      expect(ig!.ignores("test.log")).toBe(true);
      expect(ig!.ignores("foo/test.log")).toBe(true);
      expect(ig!.ignores("foo/bar/test.log")).toBe(true);
    });

    test("handles patterns with slash in middle (relative to gitignore)", () => {
      fs.writeFileSync(
        path.join(testDir, ".gitignore"),
        "foo/bar.log\n",
      );

      const ig = loadGitignorePatterns(testDir);
      expect(ig).not.toBeNull();
      // Patterns with slash are relative to .gitignore location
      // They match that specific path structure from the gitignore directory
      expect(ig!.ignores("foo/bar.log")).toBe(true);
      // But do NOT match at arbitrary deeper levels
      expect(ig!.ignores("sub/foo/bar.log")).toBe(false);
      // Does not match without the exact directory structure
      expect(ig!.ignores("bar.log")).toBe(false);
      expect(ig!.ignores("foo/baz.log")).toBe(false);
    });

    test("handles BOM character at start of file", () => {
      // UTF-8 BOM: \uFEFF
      fs.writeFileSync(
        path.join(testDir, ".gitignore"),
        "\uFEFF*.log\n",
      );

      const ig = loadGitignorePatterns(testDir);
      expect(ig).not.toBeNull();
      expect(ig!.ignores("test.log")).toBe(true);
    });

    test("handles invalid trailing backslash (should be ignored)", () => {
      fs.writeFileSync(
        path.join(testDir, ".gitignore"),
        "test.log\\\n*.tmp\n",
      );

      const ig = loadGitignorePatterns(testDir);
      expect(ig).not.toBeNull();
      // Pattern with invalid trailing backslash should be ignored
      expect(ig!.ignores("test.log")).toBe(false);
      // But valid pattern should still work
      expect(ig!.ignores("file.tmp")).toBe(true);
    });

    test("handles blank lines (should be ignored)", () => {
      fs.writeFileSync(
        path.join(testDir, ".gitignore"),
        "\n\n*.log\n\n\nnode_modules/\n\n",
      );

      const ig = loadGitignorePatterns(testDir);
      expect(ig).not.toBeNull();
      expect(ig!.ignores("test.log")).toBe(true);
      expect(ig!.ignores("node_modules/pkg.json")).toBe(true);
    });

    test("handles whitespace-only lines (should be ignored)", () => {
      fs.writeFileSync(
        path.join(testDir, ".gitignore"),
        "*.log\n   \n\t\t\nnode_modules/\n",
      );

      const ig = loadGitignorePatterns(testDir);
      expect(ig).not.toBeNull();
      expect(ig!.ignores("test.log")).toBe(true);
    });

    test("handles asterisk patterns (*)", () => {
      fs.writeFileSync(
        path.join(testDir, ".gitignore"),
        "*.log\ntest-*.js\n*-debug.*\n",
      );

      const ig = loadGitignorePatterns(testDir);
      expect(ig).not.toBeNull();
      expect(ig!.ignores("error.log")).toBe(true);
      expect(ig!.ignores("test-foo.js")).toBe(true);
      expect(ig!.ignores("app-debug.log")).toBe(true);
      expect(ig!.ignores("test.js")).toBe(false);
    });

    test("handles negation at subdirectory level", async () => {
      fs.writeFileSync(
        path.join(testDir, ".gitignore"),
        "*.log\n",
      );

      const subdir = path.join(testDir, "src");
      fs.mkdirSync(subdir);
      fs.writeFileSync(
        path.join(subdir, ".gitignore"),
        "!important.log\n",
      );

      const ig = loadGitignorePatterns(subdir);
      expect(ig).not.toBeNull();
      // Root level ignores *.log
      expect(ig!.ignores("test.log")).toBe(true);
      // Subdirectory negation applies (last rule wins within combined patterns)
      expect(ig!.ignores("src/important.log")).toBe(false);
    });

    test("handles consecutive asterisks (treated as single *)", () => {
      fs.writeFileSync(
        path.join(testDir, ".gitignore"),
        "test***.log\n",
      );

      const ig = loadGitignorePatterns(testDir);
      expect(ig).not.toBeNull();
      expect(ig!.ignores("testfoo.log")).toBe(true);
      expect(ig!.ignores("testfoobar.log")).toBe(true);
    });

    test("handles escaped asterisk (\\*)", () => {
      fs.writeFileSync(
        path.join(testDir, ".gitignore"),
        "test\\*.log\n",
      );

      const ig = loadGitignorePatterns(testDir);
      expect(ig).not.toBeNull();
      expect(ig!.ignores("test*.log")).toBe(true);
      expect(ig!.ignores("testfoo.log")).toBe(false);
    });
  });
});
