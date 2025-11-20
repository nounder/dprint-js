import * as t from "bun:test";
import * as fs from "node:fs";
import * as path from "node:path";
import fmtCommand from "../src/commands/fmt.js";

const projectRoot = process.cwd();
const testDir = path.join(projectRoot, "test-tmp-excludes-trailing-slash");

t.beforeEach(() => {
  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
  fs.mkdirSync(testDir, { recursive: true });
});

t.afterEach(() => {
  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
});

t.it("excludes directory with trailing slash", async () => {
  // Create directory structure
  fs.mkdirSync(path.join(testDir, "tree", "nested"), { recursive: true });
  fs.mkdirSync(path.join(testDir, "other"), { recursive: true });

  // Create files
  fs.writeFileSync(path.join(testDir, "file1.ts"), "const x = 1;");
  fs.writeFileSync(path.join(testDir, "tree", "file2.ts"), "const x = 2;");
  fs.writeFileSync(path.join(testDir, "tree", "nested", "file3.ts"), "const x = 3;");
  fs.writeFileSync(path.join(testDir, "other", "file4.ts"), "const x = 4;");

  // Config with trailing slash exclude pattern
  const config = {
    includes: ["**/*.ts"],
    excludes: ["tree/"], // Should exclude tree directory and all contents
    plugins: ["@dprint/typescript"],
    typescript: {},
  };
  fs.writeFileSync(path.join(testDir, "dprint.json"), JSON.stringify(config, null, 2));

  const exitCode = await fmtCommand([], { log_level: "silent", cwd: testDir });

  // Should format file1.ts and other/file4.ts, but NOT tree/file2.ts or tree/nested/file3.ts
  const file1 = fs.readFileSync(path.join(testDir, "file1.ts"), "utf-8");
  const file4 = fs.readFileSync(path.join(testDir, "other", "file4.ts"), "utf-8");
  const file2 = fs.readFileSync(path.join(testDir, "tree", "file2.ts"), "utf-8");
  const file3 = fs.readFileSync(path.join(testDir, "tree", "nested", "file3.ts"), "utf-8");

  // Files outside tree/ should be formatted
  t.expect(file1).toBe("const x = 1;\n");
  t.expect(file4).toBe("const x = 4;\n");

  // Files inside tree/ should NOT be formatted (still malformed)
  t.expect(file2).toBe("const x = 2;");
  t.expect(file3).toBe("const x = 3;");

  t.expect(exitCode).toBe(0);
});

t.it("excludes directory without trailing slash", async () => {
  // Create directory structure
  fs.mkdirSync(path.join(testDir, "build", "dist"), { recursive: true });

  // Create files
  fs.writeFileSync(path.join(testDir, "src.ts"), "const x = 1;");
  fs.writeFileSync(path.join(testDir, "build", "out.ts"), "const x = 2;");
  fs.writeFileSync(path.join(testDir, "build", "dist", "bundle.ts"), "const x = 3;");

  // Config with no trailing slash exclude pattern
  const config = {
    includes: ["**/*.ts"],
    excludes: ["build"], // Should also exclude build directory and all contents
    plugins: ["@dprint/typescript"],
    typescript: {},
  };
  fs.writeFileSync(path.join(testDir, "dprint.json"), JSON.stringify(config, null, 2));

  const exitCode = await fmtCommand([], { log_level: "silent", cwd: testDir });

  const src = fs.readFileSync(path.join(testDir, "src.ts"), "utf-8");
  const out = fs.readFileSync(path.join(testDir, "build", "out.ts"), "utf-8");
  const bundle = fs.readFileSync(path.join(testDir, "build", "dist", "bundle.ts"), "utf-8");

  // src.ts should be formatted
  t.expect(src).toBe("const x = 1;\n");

  // Files in build/ should NOT be formatted
  t.expect(out).toBe("const x = 2;");
  t.expect(bundle).toBe("const x = 3;");

  t.expect(exitCode).toBe(0);
});

t.it("preserves wildcard exclude patterns", async () => {
  // Create files
  fs.writeFileSync(path.join(testDir, "file1.ts"), "const x = 1;");
  fs.writeFileSync(path.join(testDir, "file2.test.ts"), "const x = 2;");
  fs.writeFileSync(path.join(testDir, "file3.spec.ts"), "const x = 3;");

  // Config with wildcard patterns
  const config = {
    includes: ["**/*.ts"],
    excludes: ["*.test.ts", "*.spec.ts"],
    plugins: ["@dprint/typescript"],
    typescript: {},
  };
  fs.writeFileSync(path.join(testDir, "dprint.json"), JSON.stringify(config, null, 2));

  const exitCode = await fmtCommand([], { log_level: "silent", cwd: testDir });

  const file1 = fs.readFileSync(path.join(testDir, "file1.ts"), "utf-8");
  const file2 = fs.readFileSync(path.join(testDir, "file2.test.ts"), "utf-8");
  const file3 = fs.readFileSync(path.join(testDir, "file3.spec.ts"), "utf-8");

  // file1.ts should be formatted
  t.expect(file1).toBe("const x = 1;\n");

  // Test and spec files should NOT be formatted
  t.expect(file2).toBe("const x = 2;");
  t.expect(file3).toBe("const x = 3;");

  t.expect(exitCode).toBe(0);
});

t.it("handles nested directory exclusions with trailing slash", async () => {
  // Create nested structure
  fs.mkdirSync(path.join(testDir, "src", "vendor", "lib"), { recursive: true });

  fs.writeFileSync(path.join(testDir, "src", "app.ts"), "const x = 1;");
  fs.writeFileSync(path.join(testDir, "src", "vendor", "external.ts"), "const x = 2;");
  fs.writeFileSync(path.join(testDir, "src", "vendor", "lib", "deep.ts"), "const x = 3;");

  const config = {
    includes: ["**/*.ts"],
    excludes: ["src/vendor/"], // Exclude vendor and its contents
    plugins: ["@dprint/typescript"],
    typescript: {},
  };
  fs.writeFileSync(path.join(testDir, "dprint.json"), JSON.stringify(config, null, 2));

  const exitCode = await fmtCommand([], { log_level: "silent", cwd: testDir });

  const app = fs.readFileSync(path.join(testDir, "src", "app.ts"), "utf-8");
  const external = fs.readFileSync(path.join(testDir, "src", "vendor", "external.ts"), "utf-8");
  const deep = fs.readFileSync(path.join(testDir, "src", "vendor", "lib", "deep.ts"), "utf-8");

  // app.ts should be formatted
  t.expect(app).toBe("const x = 1;\n");

  // vendor files should NOT be formatted
  t.expect(external).toBe("const x = 2;");
  t.expect(deep).toBe("const x = 3;");

  t.expect(exitCode).toBe(0);
});
