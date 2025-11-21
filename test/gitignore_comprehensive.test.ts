import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import * as fs from "node:fs";
import * as path from "node:path";
import { findFiles, loadGitignorePatterns, filterWithGitignore } from "../src/files.js";

describe("gitignore comprehensive tests", () => {
  let testDir: string;
  let originalCwd: string;

  beforeEach(() => {
    originalCwd = process.cwd();
    testDir = fs.mkdtempSync(path.join(import.meta.dir, "test-gitignore-comp-"));
    process.chdir(testDir);

    // Initialize a git repository
    fs.mkdirSync(path.join(testDir, ".git"));
  });

  afterEach(() => {
    process.chdir(originalCwd);
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  describe("root-anchored patterns", () => {
    test("pattern starting with / only matches at git root", async () => {
      fs.writeFileSync(
        path.join(testDir, ".gitignore"),
        "/build\n",
      );

      // Create files
      fs.mkdirSync(path.join(testDir, "build"));
      fs.writeFileSync(path.join(testDir, "build", "app.js"), "");

      fs.mkdirSync(path.join(testDir, "src"));
      fs.mkdirSync(path.join(testDir, "src", "build"));
      fs.writeFileSync(path.join(testDir, "src", "build", "app.js"), "");

      const config = { includes: ["**/*"] };
      const files = await findFiles(config, [], testDir);

      // /build should match build/ at root
      expect(files).not.toContain("build/app.js");
      // but not src/build/
      expect(files).toContain("src/build/app.js");
    });

    test("pattern without leading / matches anywhere", async () => {
      fs.writeFileSync(
        path.join(testDir, ".gitignore"),
        "build\n",
      );

      // Create files
      fs.mkdirSync(path.join(testDir, "build"));
      fs.writeFileSync(path.join(testDir, "build", "app.js"), "");

      fs.mkdirSync(path.join(testDir, "src"));
      fs.mkdirSync(path.join(testDir, "src", "build"));
      fs.writeFileSync(path.join(testDir, "src", "build", "app.js"), "");

      const config = { includes: ["**/*"] };
      const files = await findFiles(config, [], testDir);

      // build pattern should match both
      expect(files).not.toContain("build/app.js");
      expect(files).not.toContain("src/build/app.js");
    });

    test("root-anchored file pattern", async () => {
      fs.writeFileSync(
        path.join(testDir, ".gitignore"),
        "/config.js\n",
      );

      fs.writeFileSync(path.join(testDir, "config.js"), "");
      fs.mkdirSync(path.join(testDir, "src"));
      fs.writeFileSync(path.join(testDir, "src", "config.js"), "");

      const config = { includes: ["**/*"] };
      const files = await findFiles(config, [], testDir);

      expect(files).not.toContain("config.js");
      expect(files).toContain("src/config.js");
    });
  });

  describe("nested .gitignore with root-anchored patterns", () => {
    test("root-anchored pattern in subdirectory .gitignore", async () => {
      // Root .gitignore
      fs.writeFileSync(path.join(testDir, ".gitignore"), "");

      // Subdirectory .gitignore
      const srcDir = path.join(testDir, "src");
      fs.mkdirSync(srcDir);
      fs.writeFileSync(
        path.join(srcDir, ".gitignore"),
        "/temp\n",
      );

      // Create files
      fs.mkdirSync(path.join(srcDir, "temp"));
      fs.writeFileSync(path.join(srcDir, "temp", "file.js"), "");

      fs.mkdirSync(path.join(srcDir, "lib"));
      fs.mkdirSync(path.join(srcDir, "lib", "temp"));
      fs.writeFileSync(path.join(srcDir, "lib", "temp", "file.js"), "");

      const config = { includes: ["**/*"] };
      const files = await findFiles(config, [], testDir);

      // /temp in src/.gitignore should only match src/temp
      expect(files).not.toContain("src/temp/file.js");
      // but not src/lib/temp
      expect(files).toContain("src/lib/temp/file.js");
    });

    test("non-root-anchored pattern in subdirectory .gitignore", async () => {
      const srcDir = path.join(testDir, "src");
      fs.mkdirSync(srcDir);
      fs.writeFileSync(
        path.join(srcDir, ".gitignore"),
        "temp\n",
      );

      // Create files
      fs.mkdirSync(path.join(srcDir, "temp"));
      fs.writeFileSync(path.join(srcDir, "temp", "file.js"), "");

      fs.mkdirSync(path.join(srcDir, "lib"));
      fs.mkdirSync(path.join(srcDir, "lib", "temp"));
      fs.writeFileSync(path.join(srcDir, "lib", "temp", "file.js"), "");

      const config = { includes: ["**/*"] };
      const files = await findFiles(config, [], testDir);

      // temp pattern should match both
      expect(files).not.toContain("src/temp/file.js");
      expect(files).not.toContain("src/lib/temp/file.js");
    });
  });

  describe("double-star patterns", () => {
    test("**/ pattern matches directories at any depth", async () => {
      fs.writeFileSync(
        path.join(testDir, ".gitignore"),
        "**/build\n",
      );

      fs.mkdirSync(path.join(testDir, "build"));
      fs.writeFileSync(path.join(testDir, "build", "app.js"), "");

      fs.mkdirSync(path.join(testDir, "src"));
      fs.mkdirSync(path.join(testDir, "src", "build"));
      fs.writeFileSync(path.join(testDir, "src", "build", "app.js"), "");

      fs.mkdirSync(path.join(testDir, "src", "lib"));
      fs.mkdirSync(path.join(testDir, "src", "lib", "build"));
      fs.writeFileSync(path.join(testDir, "src", "lib", "build", "app.js"), "");

      const config = { includes: ["**/*"] };
      const files = await findFiles(config, [], testDir);

      expect(files).not.toContain("build/app.js");
      expect(files).not.toContain("src/build/app.js");
      expect(files).not.toContain("src/lib/build/app.js");
    });

    test("**/*.log pattern", async () => {
      fs.writeFileSync(
        path.join(testDir, ".gitignore"),
        "**/*.log\n",
      );

      fs.writeFileSync(path.join(testDir, "app.log"), "");
      fs.mkdirSync(path.join(testDir, "src"));
      fs.writeFileSync(path.join(testDir, "src", "error.log"), "");
      fs.writeFileSync(path.join(testDir, "src", "app.js"), "");

      const config = { includes: ["**/*"] };
      const files = await findFiles(config, [], testDir);

      expect(files).not.toContain("app.log");
      expect(files).not.toContain("src/error.log");
      expect(files).toContain("src/app.js");
    });
  });

  describe("directory patterns", () => {
    test("pattern with trailing slash matches only directories", async () => {
      fs.writeFileSync(
        path.join(testDir, ".gitignore"),
        "build/\n",
      );

      // Create a directory named build
      fs.mkdirSync(path.join(testDir, "build"));
      fs.writeFileSync(path.join(testDir, "build", "app.js"), "");

      // Create a file named build (no extension)
      fs.writeFileSync(path.join(testDir, "build.txt"), "build");

      const config = { includes: ["**/*"] };
      const files = await findFiles(config, [], testDir);

      expect(files).not.toContain("build/app.js");
      expect(files).toContain("build.txt");
    });
  });

  describe("negation patterns", () => {
    test("basic negation pattern", async () => {
      fs.writeFileSync(
        path.join(testDir, ".gitignore"),
        "*.log\n!important.log\n",
      );

      fs.writeFileSync(path.join(testDir, "app.log"), "");
      fs.writeFileSync(path.join(testDir, "important.log"), "");
      fs.writeFileSync(path.join(testDir, "error.log"), "");

      const config = { includes: ["**/*"] };
      const files = await findFiles(config, [], testDir);

      expect(files).not.toContain("app.log");
      expect(files).not.toContain("error.log");
      expect(files).toContain("important.log");
    });

    test("negation pattern for directory (correct usage)", async () => {
      // Note: You cannot re-include a file if a parent directory is excluded
      // The correct way is to exclude contents (build/*) not the directory itself (build/)
      fs.writeFileSync(
        path.join(testDir, ".gitignore"),
        "build/*\n!build/public/\n",
      );

      fs.mkdirSync(path.join(testDir, "build"));
      fs.writeFileSync(path.join(testDir, "build", "app.js"), "");

      fs.mkdirSync(path.join(testDir, "build", "public"));
      fs.writeFileSync(path.join(testDir, "build", "public", "index.html"), "");

      const config = { includes: ["**/*"] };
      const files = await findFiles(config, [], testDir);

      expect(files).not.toContain("build/app.js");
      expect(files).toContain("build/public/index.html");
    });

    test("negation in nested .gitignore", async () => {
      const srcDir = path.join(testDir, "src");
      fs.mkdirSync(srcDir);
      fs.writeFileSync(
        path.join(srcDir, ".gitignore"),
        "*.tmp\n!keep.tmp\n",
      );

      fs.writeFileSync(path.join(srcDir, "test.tmp"), "");
      fs.writeFileSync(path.join(srcDir, "keep.tmp"), "");
      fs.writeFileSync(path.join(srcDir, "app.js"), "");

      const config = { includes: ["**/*"] };
      const files = await findFiles(config, [], testDir);

      expect(files).not.toContain("src/test.tmp");
      expect(files).toContain("src/keep.tmp");
      expect(files).toContain("src/app.js");
    });
  });

  describe("complex glob patterns", () => {
    test("character range pattern", async () => {
      fs.writeFileSync(
        path.join(testDir, ".gitignore"),
        "test[0-9].js\n",
      );

      fs.writeFileSync(path.join(testDir, "test1.js"), "");
      fs.writeFileSync(path.join(testDir, "test2.js"), "");
      fs.writeFileSync(path.join(testDir, "testA.js"), "");
      fs.writeFileSync(path.join(testDir, "app.js"), "");

      const config = { includes: ["**/*"] };
      const files = await findFiles(config, [], testDir);

      expect(files).not.toContain("test1.js");
      expect(files).not.toContain("test2.js");
      expect(files).toContain("testA.js");
      expect(files).toContain("app.js");
    });

    test("multiple extension patterns", async () => {
      // Note: Brace expansion {a,b} is NOT supported in gitignore
      // Use separate patterns instead
      fs.writeFileSync(
        path.join(testDir, ".gitignore"),
        "*.log\n*.tmp\n",
      );

      fs.writeFileSync(path.join(testDir, "app.log"), "");
      fs.writeFileSync(path.join(testDir, "test.tmp"), "");
      fs.writeFileSync(path.join(testDir, "app.js"), "");

      const config = { includes: ["**/*"] };
      const files = await findFiles(config, [], testDir);

      expect(files).not.toContain("app.log");
      expect(files).not.toContain("test.tmp");
      expect(files).toContain("app.js");
    });

    test("question mark pattern", async () => {
      fs.writeFileSync(
        path.join(testDir, ".gitignore"),
        "test?.js\n",
      );

      fs.writeFileSync(path.join(testDir, "test1.js"), "");
      fs.writeFileSync(path.join(testDir, "testA.js"), "");
      fs.writeFileSync(path.join(testDir, "test12.js"), "");
      fs.writeFileSync(path.join(testDir, "app.js"), "");

      const config = { includes: ["**/*"] };
      const files = await findFiles(config, [], testDir);

      expect(files).not.toContain("test1.js");
      expect(files).not.toContain("testA.js");
      expect(files).toContain("test12.js");
      expect(files).toContain("app.js");
    });
  });

  describe("whitespace handling", () => {
    test("trailing whitespace is ignored", async () => {
      fs.writeFileSync(
        path.join(testDir, ".gitignore"),
        "*.log   \n*.tmp\t\n",
      );

      fs.writeFileSync(path.join(testDir, "app.log"), "");
      fs.writeFileSync(path.join(testDir, "test.tmp"), "");

      const config = { includes: ["**/*"] };
      const files = await findFiles(config, [], testDir);

      expect(files).not.toContain("app.log");
      expect(files).not.toContain("test.tmp");
    });

    test("leading spaces are significant", async () => {
      fs.writeFileSync(
        path.join(testDir, ".gitignore"),
        " space.txt\n",
      );

      fs.writeFileSync(path.join(testDir, "space.txt"), "");
      fs.writeFileSync(path.join(testDir, " space.txt"), "");

      const config = { includes: ["**/*"] };
      const files = await findFiles(config, [], testDir);

      // The ignore library treats leading space as significant
      // So " space.txt" pattern should match files with leading space
      expect(files).toContain("space.txt");
    });
  });

  describe("special characters", () => {
    test("escaped hash character", async () => {
      fs.writeFileSync(
        path.join(testDir, ".gitignore"),
        "\\#hashtag\n",
      );

      fs.writeFileSync(path.join(testDir, "#hashtag"), "");
      fs.writeFileSync(path.join(testDir, "hashtag"), "");

      const config = { includes: ["**/*"] };
      const files = await findFiles(config, [], testDir);

      expect(files).not.toContain("#hashtag");
      expect(files).toContain("hashtag");
    });

    test("escaped exclamation mark", async () => {
      fs.writeFileSync(
        path.join(testDir, ".gitignore"),
        "\\!important\n",
      );

      fs.writeFileSync(path.join(testDir, "!important"), "");
      fs.writeFileSync(path.join(testDir, "important"), "");

      const config = { includes: ["**/*"] };
      const files = await findFiles(config, [], testDir);

      expect(files).not.toContain("!important");
      expect(files).toContain("important");
    });
  });

  describe("deeply nested .gitignore files", () => {
    test("multiple nested .gitignore files with different patterns", async () => {
      // Root .gitignore
      fs.writeFileSync(
        path.join(testDir, ".gitignore"),
        "*.log\n",
      );

      // src/.gitignore
      const srcDir = path.join(testDir, "src");
      fs.mkdirSync(srcDir);
      fs.writeFileSync(
        path.join(srcDir, ".gitignore"),
        "*.tmp\n",
      );

      // src/lib/.gitignore
      const libDir = path.join(srcDir, "lib");
      fs.mkdirSync(libDir);
      fs.writeFileSync(
        path.join(libDir, ".gitignore"),
        "*.bak\n",
      );

      // Create files at different levels
      fs.writeFileSync(path.join(testDir, "root.log"), "");
      fs.writeFileSync(path.join(srcDir, "src.log"), "");
      fs.writeFileSync(path.join(srcDir, "src.tmp"), "");
      fs.writeFileSync(path.join(libDir, "lib.log"), "");
      fs.writeFileSync(path.join(libDir, "lib.tmp"), "");
      fs.writeFileSync(path.join(libDir, "lib.bak"), "");
      fs.writeFileSync(path.join(libDir, "lib.js"), "");

      const config = { includes: ["**/*"] };
      const files = await findFiles(config, [], testDir);

      // *.log should be ignored everywhere
      expect(files).not.toContain("root.log");
      expect(files).not.toContain("src/src.log");
      expect(files).not.toContain("src/lib/lib.log");

      // *.tmp should be ignored in src and below
      expect(files).not.toContain("src/src.tmp");
      expect(files).not.toContain("src/lib/lib.tmp");

      // *.bak should be ignored in lib and below
      expect(files).not.toContain("src/lib/lib.bak");

      // .js file should be included
      expect(files).toContain("src/lib/lib.js");
    });
  });

  describe("pattern order and precedence", () => {
    test("later patterns override earlier ones", async () => {
      fs.writeFileSync(
        path.join(testDir, ".gitignore"),
        "*.log\n!important.log\n*.log\n",
      );

      fs.writeFileSync(path.join(testDir, "app.log"), "");
      fs.writeFileSync(path.join(testDir, "important.log"), "");

      const config = { includes: ["**/*"] };
      const files = await findFiles(config, [], testDir);

      // The final *.log should re-ignore important.log
      expect(files).not.toContain("app.log");
      expect(files).not.toContain("important.log");
    });

    test("re-include then re-ignore pattern", async () => {
      // Use build/* instead of build/ to allow re-inclusion
      fs.writeFileSync(
        path.join(testDir, ".gitignore"),
        "build/*\n!build/public/\nbuild/public/secret/\n",
      );

      fs.mkdirSync(path.join(testDir, "build"));
      fs.writeFileSync(path.join(testDir, "build", "app.js"), "");

      fs.mkdirSync(path.join(testDir, "build", "public"), { recursive: true });
      fs.writeFileSync(path.join(testDir, "build", "public", "index.html"), "");

      fs.mkdirSync(path.join(testDir, "build", "public", "secret"), { recursive: true });
      fs.writeFileSync(path.join(testDir, "build", "public", "secret", "key.txt"), "");

      const config = { includes: ["**/*"] };
      const files = await findFiles(config, [], testDir);

      expect(files).not.toContain("build/app.js");
      expect(files).toContain("build/public/index.html");
      expect(files).not.toContain("build/public/secret/key.txt");
    });
  });

  describe("edge cases", () => {
    test("empty .gitignore file", async () => {
      fs.writeFileSync(path.join(testDir, ".gitignore"), "");
      fs.writeFileSync(path.join(testDir, "app.js"), "");

      const config = { includes: ["**/*"] };
      const files = await findFiles(config, [], testDir);

      expect(files).toContain("app.js");
    });

    test(".gitignore with only comments", async () => {
      fs.writeFileSync(
        path.join(testDir, ".gitignore"),
        "# Comment 1\n# Comment 2\n",
      );
      fs.writeFileSync(path.join(testDir, "app.js"), "");

      const config = { includes: ["**/*"] };
      const files = await findFiles(config, [], testDir);

      expect(files).toContain("app.js");
    });

    test(".gitignore with only empty lines", async () => {
      fs.writeFileSync(
        path.join(testDir, ".gitignore"),
        "\n\n\n",
      );
      fs.writeFileSync(path.join(testDir, "app.js"), "");

      const config = { includes: ["**/*"] };
      const files = await findFiles(config, [], testDir);

      expect(files).toContain("app.js");
    });

    test("pattern with just *", async () => {
      fs.writeFileSync(
        path.join(testDir, ".gitignore"),
        "*\n!*.js\n",
      );

      fs.writeFileSync(path.join(testDir, "app.js"), "");
      fs.writeFileSync(path.join(testDir, "app.log"), "");
      fs.writeFileSync(path.join(testDir, "readme.md"), "");

      const config = { includes: ["**/*"] };
      const files = await findFiles(config, [], testDir);

      expect(files).toContain("app.js");
      expect(files).not.toContain("app.log");
      expect(files).not.toContain("readme.md");
    });
  });

  describe("comparison with files relative to subdirectory", () => {
    test("finding files from subdirectory with .gitignore at root", async () => {
      fs.writeFileSync(
        path.join(testDir, ".gitignore"),
        "*.log\n",
      );

      const srcDir = path.join(testDir, "src");
      fs.mkdirSync(srcDir);
      fs.writeFileSync(path.join(srcDir, "app.js"), "");
      fs.writeFileSync(path.join(srcDir, "app.log"), "");

      const config = { includes: ["**/*"] };
      const files = await findFiles(config, [], srcDir);

      expect(files).toContain("app.js");
      expect(files).not.toContain("app.log");
    });
  });
});
