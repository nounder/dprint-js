import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import * as fs from "node:fs";
import * as path from "node:path";
import { findFiles } from "../src/files.js";
import { loadGitignorePatterns, filterWithGitignore } from "../src/gitignore.js";

describe("gitignore - extensive tests", () => {
  let testDir: string;
  let originalCwd: string;

  beforeEach(() => {
    originalCwd = process.cwd();
    testDir = fs.mkdtempSync(path.join(import.meta.dir, "test-gitignore-ext-"));
    process.chdir(testDir);

    // Initialize a git repository
    fs.mkdirSync(path.join(testDir, ".git"));
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  describe("rooted patterns (starting with /)", () => {
    test("root .gitignore with rooted pattern", async () => {
      fs.writeFileSync(
        path.join(testDir, ".gitignore"),
        "/build\n",
      );

      fs.mkdirSync(path.join(testDir, "build"));
      fs.writeFileSync(path.join(testDir, "build", "app.js"), "");

      fs.mkdirSync(path.join(testDir, "src"));
      fs.mkdirSync(path.join(testDir, "src", "build"));
      fs.writeFileSync(path.join(testDir, "src", "build", "app.js"), "");

      const config = { includes: ["**/*"] };
      const files = await findFiles(config, [], testDir);

      // /build should only match root build directory
      expect(files).not.toContain("build/app.js");
      // src/build should NOT be ignored (rooted patterns don't match subdirs)
      expect(files).toContain("src/build/app.js");
    });

    test("nested .gitignore with rooted pattern", async () => {
      const srcDir = path.join(testDir, "src");
      fs.mkdirSync(srcDir);
      fs.writeFileSync(
        path.join(srcDir, ".gitignore"),
        "/build\n",
      );

      fs.mkdirSync(path.join(testDir, "build"));
      fs.writeFileSync(path.join(testDir, "build", "app.js"), "");

      fs.mkdirSync(path.join(srcDir, "build"));
      fs.writeFileSync(path.join(srcDir, "build", "app.js"), "");

      fs.mkdirSync(path.join(srcDir, "components"));
      fs.mkdirSync(path.join(srcDir, "components", "build"));
      fs.writeFileSync(path.join(srcDir, "components", "build", "app.js"), "");

      const config = { includes: ["**/*"] };
      const files = await findFiles(config, [], testDir);

      // Root build should not be ignored (not in src/.gitignore scope)
      expect(files).toContain("build/app.js");
      // src/build should be ignored (rooted pattern in src/.gitignore)
      expect(files).not.toContain("src/build/app.js");
      // src/components/build should NOT be ignored (rooted pattern only matches at src/ level)
      expect(files).toContain("src/components/build/app.js");
    });

    test("rooted pattern with wildcard", async () => {
      fs.writeFileSync(
        path.join(testDir, ".gitignore"),
        "/test-*.js\n",
      );

      fs.writeFileSync(path.join(testDir, "test-foo.js"), "");

      fs.mkdirSync(path.join(testDir, "src"));
      fs.writeFileSync(path.join(testDir, "src", "test-bar.js"), "");

      const config = { includes: ["**/*"] };
      const files = await findFiles(config, [], testDir);

      expect(files).not.toContain("test-foo.js");
      // Rooted pattern shouldn't match in subdirectories
      expect(files).toContain("src/test-bar.js");
    });
  });

  describe("directory-only patterns (ending with /)", () => {
    test("directory pattern only matches directories", async () => {
      fs.writeFileSync(
        path.join(testDir, ".gitignore"),
        "build/\n",
      );

      // Create a directory named build
      fs.mkdirSync(path.join(testDir, "build"));
      fs.writeFileSync(path.join(testDir, "build", "app.js"), "");

      // Create a file named build
      fs.writeFileSync(path.join(testDir, "build.txt"), "build content");

      const config = { includes: ["**/*"] };
      const files = await findFiles(config, [], testDir);

      // Directory contents should be ignored
      expect(files).not.toContain("build/app.js");
      // File with same name should not be ignored
      expect(files).toContain("build.txt");
    });

    test("rooted directory pattern", async () => {
      fs.writeFileSync(
        path.join(testDir, ".gitignore"),
        "/dist/\n",
      );

      fs.mkdirSync(path.join(testDir, "dist"));
      fs.writeFileSync(path.join(testDir, "dist", "bundle.js"), "");

      fs.mkdirSync(path.join(testDir, "src"));
      fs.mkdirSync(path.join(testDir, "src", "dist"));
      fs.writeFileSync(path.join(testDir, "src", "dist", "bundle.js"), "");

      const config = { includes: ["**/*"] };
      const files = await findFiles(config, [], testDir);

      expect(files).not.toContain("dist/bundle.js");
      // Rooted pattern shouldn't match subdirectories
      expect(files).toContain("src/dist/bundle.js");
    });
  });

  describe("double asterisk patterns", () => {
    test("**/ matches any depth of directories", async () => {
      fs.writeFileSync(
        path.join(testDir, ".gitignore"),
        "**/temp\n",
      );

      fs.mkdirSync(path.join(testDir, "temp"));
      fs.writeFileSync(path.join(testDir, "temp", "file.txt"), "");

      fs.mkdirSync(path.join(testDir, "src"));
      fs.mkdirSync(path.join(testDir, "src", "temp"));
      fs.writeFileSync(path.join(testDir, "src", "temp", "file.txt"), "");

      fs.mkdirSync(path.join(testDir, "src", "components"));
      fs.mkdirSync(path.join(testDir, "src", "components", "temp"));
      fs.writeFileSync(path.join(testDir, "src", "components", "temp", "file.txt"), "");

      const config = { includes: ["**/*"] };
      const files = await findFiles(config, [], testDir);

      expect(files).not.toContain("temp/file.txt");
      expect(files).not.toContain("src/temp/file.txt");
      expect(files).not.toContain("src/components/temp/file.txt");
    });

    test("**/*.log matches .log files at any depth", async () => {
      fs.writeFileSync(
        path.join(testDir, ".gitignore"),
        "**/*.log\n",
      );

      fs.writeFileSync(path.join(testDir, "error.log"), "");

      fs.mkdirSync(path.join(testDir, "src"));
      fs.writeFileSync(path.join(testDir, "src", "debug.log"), "");
      fs.writeFileSync(path.join(testDir, "src", "app.js"), "");

      fs.mkdirSync(path.join(testDir, "src", "utils"));
      fs.writeFileSync(path.join(testDir, "src", "utils", "trace.log"), "");

      const config = { includes: ["**/*"] };
      const files = await findFiles(config, [], testDir);

      expect(files).not.toContain("error.log");
      expect(files).not.toContain("src/debug.log");
      expect(files).not.toContain("src/utils/trace.log");
      expect(files).toContain("src/app.js");
    });

    test("logs/**/*.log matches .log files only in logs directory", async () => {
      fs.writeFileSync(
        path.join(testDir, ".gitignore"),
        "logs/**/*.log\n",
      );

      fs.writeFileSync(path.join(testDir, "error.log"), "");

      fs.mkdirSync(path.join(testDir, "logs"));
      fs.writeFileSync(path.join(testDir, "logs", "app.log"), "");

      fs.mkdirSync(path.join(testDir, "logs", "2024"));
      fs.writeFileSync(path.join(testDir, "logs", "2024", "jan.log"), "");

      fs.mkdirSync(path.join(testDir, "src"));
      fs.writeFileSync(path.join(testDir, "src", "debug.log"), "");

      const config = { includes: ["**/*"] };
      const files = await findFiles(config, [], testDir);

      // Root log should not be ignored
      expect(files).toContain("error.log");
      // src log should not be ignored
      expect(files).toContain("src/debug.log");
      // logs directory logs should be ignored
      expect(files).not.toContain("logs/app.log");
      expect(files).not.toContain("logs/2024/jan.log");
    });
  });

  describe("negation patterns", () => {
    test("negation with rooted pattern", async () => {
      fs.writeFileSync(
        path.join(testDir, ".gitignore"),
        "*.log\n!/important.log\n",
      );

      fs.writeFileSync(path.join(testDir, "error.log"), "");
      fs.writeFileSync(path.join(testDir, "important.log"), "");

      fs.mkdirSync(path.join(testDir, "src"));
      fs.writeFileSync(path.join(testDir, "src", "important.log"), "");
      fs.writeFileSync(path.join(testDir, "src", "debug.log"), "");

      const config = { includes: ["**/*"] };
      const files = await findFiles(config, [], testDir);

      expect(files).toContain("important.log");
      expect(files).not.toContain("error.log");
      // Rooted negation should only apply to root
      expect(files).not.toContain("src/important.log");
      expect(files).not.toContain("src/debug.log");
    });

    test("negation in nested .gitignore", async () => {
      fs.writeFileSync(
        path.join(testDir, ".gitignore"),
        "*.log\n",
      );

      const srcDir = path.join(testDir, "src");
      fs.mkdirSync(srcDir);
      fs.writeFileSync(
        path.join(srcDir, ".gitignore"),
        "!important.log\n",
      );

      fs.writeFileSync(path.join(testDir, "error.log"), "");
      fs.writeFileSync(path.join(srcDir, "debug.log"), "");
      fs.writeFileSync(path.join(srcDir, "important.log"), "");

      const config = { includes: ["**/*"] };
      const files = await findFiles(config, [], testDir);

      expect(files).not.toContain("error.log");
      expect(files).not.toContain("src/debug.log");
      // Nested .gitignore negates the parent rule
      expect(files).toContain("src/important.log");
    });

    test("negation with directory pattern", async () => {
      fs.writeFileSync(
        path.join(testDir, ".gitignore"),
        "build/\n!build/important/\n",
      );

      fs.mkdirSync(path.join(testDir, "build"));
      fs.writeFileSync(path.join(testDir, "build", "app.js"), "");

      fs.mkdirSync(path.join(testDir, "build", "important"));
      fs.writeFileSync(path.join(testDir, "build", "important", "config.js"), "");

      fs.mkdirSync(path.join(testDir, "build", "temp"));
      fs.writeFileSync(path.join(testDir, "build", "temp", "cache.js"), "");

      const config = { includes: ["**/*"] };
      const files = await findFiles(config, [], testDir);

      // Git limitation: Once a directory is ignored, you cannot un-ignore
      // a subdirectory. The negation !build/important/ has no effect because
      // git doesn't descend into build/ at all.
      // All build files should be ignored
      expect(files).not.toContain("build/important/config.js");
      expect(files).not.toContain("build/app.js");
      expect(files).not.toContain("build/temp/cache.js");
    });
  });

  describe("whitespace handling", () => {
    test("trailing whitespace is ignored", async () => {
      fs.writeFileSync(
        path.join(testDir, ".gitignore"),
        "*.log   \n*.tmp\t\n",
      );

      fs.writeFileSync(path.join(testDir, "error.log"), "");
      fs.writeFileSync(path.join(testDir, "temp.tmp"), "");
      fs.writeFileSync(path.join(testDir, "app.js"), "");

      const config = { includes: ["**/*"] };
      const files = await findFiles(config, [], testDir);

      expect(files).not.toContain("error.log");
      expect(files).not.toContain("temp.tmp");
      expect(files).toContain("app.js");
    });

    test("patterns with spaces", async () => {
      fs.writeFileSync(
        path.join(testDir, ".gitignore"),
        "my logs/\n",
      );

      fs.mkdirSync(path.join(testDir, "my logs"));
      fs.writeFileSync(path.join(testDir, "my logs", "error.log"), "");
      fs.writeFileSync(path.join(testDir, "app.js"), "");

      const config = { includes: ["**/*"] };
      const files = await findFiles(config, [], testDir);

      expect(files).not.toContain("my logs/error.log");
      expect(files).toContain("app.js");
    });
  });

  describe("special characters", () => {
    test("bracket expressions", async () => {
      fs.writeFileSync(
        path.join(testDir, ".gitignore"),
        "test[0-9].js\n",
      );

      fs.writeFileSync(path.join(testDir, "test0.js"), "");
      fs.writeFileSync(path.join(testDir, "test5.js"), "");
      fs.writeFileSync(path.join(testDir, "test9.js"), "");
      fs.writeFileSync(path.join(testDir, "testA.js"), "");
      fs.writeFileSync(path.join(testDir, "test.js"), "");

      const config = { includes: ["**/*"] };
      const files = await findFiles(config, [], testDir);

      expect(files).not.toContain("test0.js");
      expect(files).not.toContain("test5.js");
      expect(files).not.toContain("test9.js");
      expect(files).toContain("testA.js");
      expect(files).toContain("test.js");
    });

    test("question mark pattern", async () => {
      fs.writeFileSync(
        path.join(testDir, ".gitignore"),
        "test?.js\n",
      );

      fs.writeFileSync(path.join(testDir, "test1.js"), "");
      fs.writeFileSync(path.join(testDir, "testA.js"), "");
      fs.writeFileSync(path.join(testDir, "test.js"), "");
      fs.writeFileSync(path.join(testDir, "test12.js"), "");

      const config = { includes: ["**/*"] };
      const files = await findFiles(config, [], testDir);

      expect(files).not.toContain("test1.js");
      expect(files).not.toContain("testA.js");
      expect(files).toContain("test.js");
      expect(files).toContain("test12.js");
    });

    test("escaped characters", async () => {
      // Create a file with a hash in the name
      fs.writeFileSync(
        path.join(testDir, ".gitignore"),
        "\\#important.txt\n",
      );

      fs.writeFileSync(path.join(testDir, "#important.txt"), "");
      fs.writeFileSync(path.join(testDir, "important.txt"), "");

      const config = { includes: ["**/*"] };
      const files = await findFiles(config, [], testDir);

      expect(files).not.toContain("#important.txt");
      expect(files).toContain("important.txt");
    });
  });

  describe("pattern precedence and ordering", () => {
    test("later patterns override earlier ones", async () => {
      fs.writeFileSync(
        path.join(testDir, ".gitignore"),
        "*.log\n!important.log\nimportant.log\n",
      );

      fs.writeFileSync(path.join(testDir, "error.log"), "");
      fs.writeFileSync(path.join(testDir, "important.log"), "");

      const config = { includes: ["**/*"] };
      const files = await findFiles(config, [], testDir);

      expect(files).not.toContain("error.log");
      // Last rule wins - important.log is ignored again
      expect(files).not.toContain("important.log");
    });

    test("nested .gitignore overrides parent patterns", async () => {
      fs.writeFileSync(
        path.join(testDir, ".gitignore"),
        "*.tmp\n",
      );

      const srcDir = path.join(testDir, "src");
      fs.mkdirSync(srcDir);
      fs.writeFileSync(
        path.join(srcDir, ".gitignore"),
        "!cache.tmp\n",
      );

      fs.writeFileSync(path.join(testDir, "root.tmp"), "");
      fs.writeFileSync(path.join(srcDir, "file.tmp"), "");
      fs.writeFileSync(path.join(srcDir, "cache.tmp"), "");

      const config = { includes: ["**/*"] };
      const files = await findFiles(config, [], testDir);

      expect(files).not.toContain("root.tmp");
      expect(files).not.toContain("src/file.tmp");
      // Negation in src/.gitignore should allow cache.tmp
      expect(files).toContain("src/cache.tmp");
    });
  });

  describe("edge cases", () => {
    test("empty .gitignore file", async () => {
      fs.writeFileSync(path.join(testDir, ".gitignore"), "");

      fs.writeFileSync(path.join(testDir, "test.js"), "");
      fs.writeFileSync(path.join(testDir, "test.log"), "");

      const config = { includes: ["**/*"] };
      const files = await findFiles(config, [], testDir);

      expect(files).toContain("test.js");
      expect(files).toContain("test.log");
    });

    test(".gitignore with only comments", async () => {
      fs.writeFileSync(
        path.join(testDir, ".gitignore"),
        "# Comment 1\n# Comment 2\n",
      );

      fs.writeFileSync(path.join(testDir, "test.js"), "");

      const config = { includes: ["**/*"] };
      const files = await findFiles(config, [], testDir);

      expect(files).toContain("test.js");
    });

    test("pattern with only asterisks", async () => {
      fs.writeFileSync(
        path.join(testDir, ".gitignore"),
        "*\n",
      );

      fs.writeFileSync(path.join(testDir, "test.js"), "");

      fs.mkdirSync(path.join(testDir, "src"));
      fs.writeFileSync(path.join(testDir, "src", "app.js"), "");

      const config = { includes: ["**/*"] };
      const files = await findFiles(config, [], testDir);

      // * matches everything including directory names
      // Since it matches "src", everything under src/ is also ignored
      expect(files).not.toContain("test.js");
      expect(files).not.toContain("src/app.js");
    });

    test("multiple nested .gitignore files with complex patterns", async () => {
      fs.writeFileSync(
        path.join(testDir, ".gitignore"),
        "*.log\nbuild/\n",
      );

      const srcDir = path.join(testDir, "src");
      fs.mkdirSync(srcDir);
      fs.writeFileSync(
        path.join(srcDir, ".gitignore"),
        "*.tmp\n!important.tmp\n",
      );

      const testsDir = path.join(srcDir, "tests");
      fs.mkdirSync(testsDir);
      fs.writeFileSync(
        path.join(testsDir, ".gitignore"),
        "*.test.js\n",
      );

      // Root level
      fs.writeFileSync(path.join(testDir, "error.log"), "");
      fs.mkdirSync(path.join(testDir, "build"));
      fs.writeFileSync(path.join(testDir, "build", "app.js"), "");

      // src level
      fs.writeFileSync(path.join(srcDir, "file.tmp"), "");
      fs.writeFileSync(path.join(srcDir, "important.tmp"), "");
      fs.writeFileSync(path.join(srcDir, "app.js"), "");

      // tests level
      fs.writeFileSync(path.join(testsDir, "app.test.js"), "");
      fs.writeFileSync(path.join(testsDir, "helper.js"), "");

      const config = { includes: ["**/*"] };
      const files = await findFiles(config, [], testDir);

      // Root patterns
      expect(files).not.toContain("error.log");
      expect(files).not.toContain("build/app.js");

      // src patterns
      expect(files).not.toContain("src/file.tmp");
      expect(files).toContain("src/important.tmp");
      expect(files).toContain("src/app.js");

      // tests patterns
      expect(files).not.toContain("src/tests/app.test.js");
      expect(files).toContain("src/tests/helper.js");
    });
  });

  describe("running from subdirectory", () => {
    test("gitignore applies correctly when cwd is subdirectory", async () => {
      fs.writeFileSync(
        path.join(testDir, ".gitignore"),
        "*.log\nbuild/\n",
      );

      const srcDir = path.join(testDir, "src");
      fs.mkdirSync(srcDir);

      fs.writeFileSync(path.join(testDir, "root.log"), "");
      fs.writeFileSync(path.join(srcDir, "app.js"), "");
      fs.writeFileSync(path.join(srcDir, "debug.log"), "");

      fs.mkdirSync(path.join(srcDir, "build"));
      fs.writeFileSync(path.join(srcDir, "build", "bundle.js"), "");

      // Change to src directory
      process.chdir(srcDir);

      const config = { includes: ["**/*"] };
      const files = await findFiles(config, [], srcDir);

      expect(files).toContain("app.js");
      expect(files).not.toContain("debug.log");
      expect(files).not.toContain("build/bundle.js");
    });

    test("nested .gitignore works when cwd is deeply nested", async () => {
      fs.writeFileSync(
        path.join(testDir, ".gitignore"),
        "*.log\n",
      );

      const srcDir = path.join(testDir, "src");
      fs.mkdirSync(srcDir);

      const componentsDir = path.join(srcDir, "components");
      fs.mkdirSync(componentsDir);

      fs.writeFileSync(
        path.join(componentsDir, ".gitignore"),
        "*.tmp\n",
      );

      fs.writeFileSync(path.join(testDir, "root.log"), "");
      fs.writeFileSync(path.join(componentsDir, "Button.js"), "");
      fs.writeFileSync(path.join(componentsDir, "cache.tmp"), "");
      fs.writeFileSync(path.join(componentsDir, "debug.log"), "");

      process.chdir(componentsDir);

      const config = { includes: ["**/*"] };
      const files = await findFiles(config, [], componentsDir);

      expect(files).toContain("Button.js");
      expect(files).not.toContain("cache.tmp");
      expect(files).not.toContain("debug.log");
    });
  });

  describe("pattern format edge cases", () => {
    test("pattern with leading slash removed by accident", async () => {
      fs.writeFileSync(
        path.join(testDir, ".gitignore"),
        "/build\n/dist\n",
      );

      fs.mkdirSync(path.join(testDir, "build"));
      fs.writeFileSync(path.join(testDir, "build", "app.js"), "");

      fs.mkdirSync(path.join(testDir, "dist"));
      fs.writeFileSync(path.join(testDir, "dist", "bundle.js"), "");

      const config = { includes: ["**/*"] };
      const files = await findFiles(config, [], testDir);

      expect(files).not.toContain("build/app.js");
      expect(files).not.toContain("dist/bundle.js");
    });

    test("pattern with multiple slashes", async () => {
      fs.writeFileSync(
        path.join(testDir, ".gitignore"),
        "src/components/build/\n",
      );

      fs.mkdirSync(path.join(testDir, "src"));
      fs.mkdirSync(path.join(testDir, "src", "components"));
      fs.mkdirSync(path.join(testDir, "src", "components", "build"));
      fs.writeFileSync(path.join(testDir, "src", "components", "build", "app.js"), "");

      fs.mkdirSync(path.join(testDir, "src", "utils"));
      fs.mkdirSync(path.join(testDir, "src", "utils", "build"));
      fs.writeFileSync(path.join(testDir, "src", "utils", "build", "helper.js"), "");

      const config = { includes: ["**/*"] };
      const files = await findFiles(config, [], testDir);

      expect(files).not.toContain("src/components/build/app.js");
      expect(files).toContain("src/utils/build/helper.js");
    });

    test("Windows-style paths in .gitignore (should not work)", async () => {
      fs.writeFileSync(
        path.join(testDir, ".gitignore"),
        "src\\build\n",
      );

      fs.mkdirSync(path.join(testDir, "src"));
      fs.mkdirSync(path.join(testDir, "src", "build"));
      fs.writeFileSync(path.join(testDir, "src", "build", "app.js"), "");

      const config = { includes: ["**/*"] };
      const files = await findFiles(config, [], testDir);

      // Windows-style paths should not be processed correctly
      // The file should NOT be ignored (backslash is not a valid separator in .gitignore)
      expect(files).toContain("src/build/app.js");
    });
  });

  describe("complex real-world scenarios", () => {
    test("typical JavaScript project structure", async () => {
      fs.writeFileSync(
        path.join(testDir, ".gitignore"),
        "node_modules/\ndist/\nbuild/\n*.log\n.env\n.DS_Store\ncoverage/\n",
      );

      // node_modules
      fs.mkdirSync(path.join(testDir, "node_modules"));
      fs.writeFileSync(path.join(testDir, "node_modules", "package.json"), "");

      // dist and build
      fs.mkdirSync(path.join(testDir, "dist"));
      fs.writeFileSync(path.join(testDir, "dist", "bundle.js"), "");
      fs.mkdirSync(path.join(testDir, "build"));
      fs.writeFileSync(path.join(testDir, "build", "app.js"), "");

      // logs and env
      fs.writeFileSync(path.join(testDir, "error.log"), "");
      fs.writeFileSync(path.join(testDir, ".env"), "");
      fs.writeFileSync(path.join(testDir, ".DS_Store"), "");

      // coverage
      fs.mkdirSync(path.join(testDir, "coverage"));
      fs.writeFileSync(path.join(testDir, "coverage", "index.html"), "");

      // Valid source files
      fs.mkdirSync(path.join(testDir, "src"));
      fs.writeFileSync(path.join(testDir, "src", "index.js"), "");
      fs.writeFileSync(path.join(testDir, "package.json"), "");
      fs.writeFileSync(path.join(testDir, "README.md"), "");

      const config = { includes: ["**/*"] };
      const files = await findFiles(config, [], testDir);

      // Should include source files
      expect(files).toContain("src/index.js");
      expect(files).toContain("package.json");
      expect(files).toContain("README.md");

      // Should exclude generated/ignored files
      expect(files).not.toContain("node_modules/package.json");
      expect(files).not.toContain("dist/bundle.js");
      expect(files).not.toContain("build/app.js");
      expect(files).not.toContain("error.log");
      expect(files).not.toContain(".env");
      expect(files).not.toContain(".DS_Store");
      expect(files).not.toContain("coverage/index.html");
    });

    test("monorepo with multiple nested .gitignore files", async () => {
      fs.writeFileSync(
        path.join(testDir, ".gitignore"),
        "node_modules/\n*.log\n",
      );

      const packagesDir = path.join(testDir, "packages");
      fs.mkdirSync(packagesDir);

      const pkg1Dir = path.join(packagesDir, "pkg1");
      fs.mkdirSync(pkg1Dir);
      fs.writeFileSync(
        path.join(pkg1Dir, ".gitignore"),
        "dist/\n",
      );

      const pkg2Dir = path.join(packagesDir, "pkg2");
      fs.mkdirSync(pkg2Dir);
      fs.writeFileSync(
        path.join(pkg2Dir, ".gitignore"),
        "build/\n*.tmp\n",
      );

      // pkg1 files
      fs.mkdirSync(path.join(pkg1Dir, "src"));
      fs.writeFileSync(path.join(pkg1Dir, "src", "index.js"), "");
      fs.mkdirSync(path.join(pkg1Dir, "dist"));
      fs.writeFileSync(path.join(pkg1Dir, "dist", "bundle.js"), "");
      fs.writeFileSync(path.join(pkg1Dir, "error.log"), "");

      // pkg2 files
      fs.mkdirSync(path.join(pkg2Dir, "src"));
      fs.writeFileSync(path.join(pkg2Dir, "src", "index.js"), "");
      fs.mkdirSync(path.join(pkg2Dir, "build"));
      fs.writeFileSync(path.join(pkg2Dir, "build", "app.js"), "");
      fs.writeFileSync(path.join(pkg2Dir, "cache.tmp"), "");
      fs.writeFileSync(path.join(pkg2Dir, "debug.log"), "");

      const config = { includes: ["**/*"] };
      const files = await findFiles(config, [], testDir);

      // pkg1
      expect(files).toContain("packages/pkg1/src/index.js");
      expect(files).not.toContain("packages/pkg1/dist/bundle.js");
      expect(files).not.toContain("packages/pkg1/error.log");

      // pkg2
      expect(files).toContain("packages/pkg2/src/index.js");
      expect(files).not.toContain("packages/pkg2/build/app.js");
      expect(files).not.toContain("packages/pkg2/cache.tmp");
      expect(files).not.toContain("packages/pkg2/debug.log");
    });
  });
});
