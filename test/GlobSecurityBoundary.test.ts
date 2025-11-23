import * as t from "bun:test";
import * as Glob from "../src/Glob.js";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

t.describe("Glob security boundary enforcement", () => {
  let tempRoot: string;
  let projectDir: string;
  let siblingDir: string;

  t.beforeEach(() => {
    // Create structure:
    // /tmp/test-root/
    //   ├── project/      (our cwd)
    //   │   └── safe.ts
    //   └── sibling/      (should never be accessed)
    //       └── secret.ts
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "dprint-boundary-"));
    projectDir = path.join(tempRoot, "project");
    siblingDir = path.join(tempRoot, "sibling");

    fs.mkdirSync(projectDir);
    fs.mkdirSync(siblingDir);

    fs.writeFileSync(path.join(projectDir, "safe.ts"), "// safe file in project");
    fs.writeFileSync(path.join(siblingDir, "secret.ts"), "// secret file outside project");
  });

  t.afterEach(() => {
    if (tempRoot && fs.existsSync(tempRoot)) {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  t.it("should never return files from sibling directories", async () => {
    // Try various patterns that would trigger Bun glob bug
    const maliciousPatterns = [
      ".*/**/*.ts",
      ".?/**/*.ts",
      ".+/**/*.ts",
      ".*/*",
      ".*/**",
    ];

    for (const pattern of maliciousPatterns) {
      const files = Glob.findMatchingFiles([pattern], [], projectDir);

      // Should not find the secret file
      for (const file of files) {
        const absolutePath = path.join(projectDir, file);
        t.expect(absolutePath).not.toContain("sibling");
        t.expect(absolutePath).not.toContain("secret.ts");
      }
    }
  });

  t.it("should never return files from parent directories", async () => {
    // Create a file in parent (tempRoot)
    fs.writeFileSync(path.join(tempRoot, "parent-file.ts"), "// parent file");

    const patterns = [".*/**/*.ts", "**/*.ts", ".?/**/*"];

    for (const pattern of patterns) {
      const files = Glob.findMatchingFiles([pattern], [], projectDir);

      // Should not find the parent file
      for (const file of files) {
        t.expect(file).not.toContain("parent-file.ts");
      }
    }
  });

  t.it("should only return files within cwd boundary", async () => {
    // Create files at various levels
    fs.mkdirSync(path.join(projectDir, "src"));
    fs.writeFileSync(path.join(projectDir, "src", "app.ts"), "// app");
    fs.writeFileSync(path.join(projectDir, "index.ts"), "// index");

    const files = Glob.findMatchingFiles(["**/*.ts"], [], projectDir);

    // Should only find files in project
    t.expect(files.length).toBe(3); // safe.ts, app.ts, index.ts

    // All files should be within project
    for (const file of files) {
      const absolutePath = path.join(projectDir, file);
      t.expect(absolutePath.startsWith(projectDir)).toBe(true);
    }
  });

  t.it("should reject paths starting with ../", async () => {
    const patterns = [".*/**/*.ts", "**/*.ts"];

    for (const pattern of patterns) {
      const files = Glob.findMatchingFiles([pattern], [], projectDir);

      // None should start with ../
      for (const file of files) {
        t.expect(file.startsWith("../")).toBe(false);
      }
    }
  });

  t.it("should reject paths containing /../", async () => {
    const patterns = [".*/**/*.ts", "**/*.ts"];

    for (const pattern of patterns) {
      const files = Glob.findMatchingFiles([pattern], [], projectDir);

      // None should contain /../
      for (const file of files) {
        t.expect(file.includes("/../")).toBe(false);
      }
    }
  });

  t.it("should handle deeply nested structure without escaping", async () => {
    // Create deep nesting in project
    const deepPath = path.join(projectDir, "a", "b", "c", "d", "e");
    fs.mkdirSync(deepPath, { recursive: true });
    fs.writeFileSync(path.join(deepPath, "deep.ts"), "// deep");

    const files = Glob.findMatchingFiles(["**/*.ts"], [], projectDir);

    // Should find deep file
    const deepFile = files.find((f) => f.includes("deep.ts"));
    t.expect(deepFile).toBeDefined();
    t.expect(deepFile).toBe("a/b/c/d/e/deep.ts");

    // Should not escape
    for (const file of files) {
      t.expect(file).not.toStartWith("../");
      t.expect(file).not.toContain("/../");
    }
  });

  t.it("should prevent access to system directories", async () => {
    // Patterns that might try to access system dirs
    const patterns = [".*/**/*", ".?/**/*"];

    for (const pattern of patterns) {
      const files = Glob.findMatchingFiles([pattern], [], projectDir);

      // Should not contain any system paths
      for (const file of files) {
        t.expect(file).not.toContain("/etc/");
        t.expect(file).not.toContain("/usr/");
        t.expect(file).not.toContain("/System/");
        t.expect(file).not.toContain("/var/");
        t.expect(file).not.toStartWith("/");
      }
    }
  });

  t.it("should handle multiple include patterns without escaping", async () => {
    fs.mkdirSync(path.join(projectDir, ".config"));
    fs.writeFileSync(path.join(projectDir, ".config", "app.ts"), "// config");

    const files = Glob.findMatchingFiles(
      ["**/*.ts", ".*/**/*.ts", ".config/**/*"],
      [],
      projectDir
    );

    // Should find files but not escape
    t.expect(files.length).toBeGreaterThan(0);

    for (const file of files) {
      const absolutePath = path.join(projectDir, file);
      t.expect(absolutePath.startsWith(projectDir)).toBe(true);
      t.expect(file).not.toStartWith("../");
      t.expect(file).not.toContain("/../");
    }
  });

  t.it("should enforce boundary even with symlinks present", async () => {
    // Create a symlink to sibling directory
    const linkPath = path.join(projectDir, "link-to-sibling");

    try {
      fs.symlinkSync(siblingDir, linkPath, "dir");

      // Even with symlink, should not follow it (followSymlinks: false)
      const files = Glob.findMatchingFiles(["**/*.ts"], [], projectDir);

      // Should not find secret.ts through symlink
      for (const file of files) {
        t.expect(file).not.toContain("secret.ts");
      }
    } catch (error) {
      // Skip test if symlinks not supported
      if (error.code === "EPERM" || error.code === "ENOENT") {
        console.log("Skipping symlink test (not supported on this system)");
      } else {
        throw error;
      }
    }
  });

  t.it("should return empty array when all paths are filtered", async () => {
    // Use a pattern that would only match parent dirs (if bug existed)
    const files = Glob.findMatchingFiles([".*/**/*.nonexistent"], [], projectDir);

    // Should return empty array, not error
    t.expect(Array.isArray(files)).toBe(true);
    t.expect(files.length).toBe(0);
  });
});
