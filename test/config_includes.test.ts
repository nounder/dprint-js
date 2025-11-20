import * as t from "bun:test";
import * as fs from "node:fs";
import * as path from "node:path";
import fmtCommand from "../src/commands/fmt.js";

const projectRoot = process.cwd();
const testDir = path.join(projectRoot, "test-tmp-config-includes");
const configPath = path.join(testDir, "dprint.json");

t.beforeEach(() => {
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }
  process.chdir(testDir);
});

t.afterEach(() => {
  process.chdir(projectRoot);
  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
});

t.it("formats files matching includes patterns", async () => {
  const config = {
    includes: ["**/*.ts"],
    excludes: [],
    plugins: ["@dprint/typescript"],
    typescript: {},
  };
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

  const tsFile = path.join(testDir, "test.ts");
  const jsFile = path.join(testDir, "test.js");
  fs.writeFileSync(tsFile, "const   x=1");
  fs.writeFileSync(jsFile, "const   y=2");

  await fmtCommand();

  // TS file should be formatted
  t.expect(fs.readFileSync(tsFile, "utf-8")).toBe("const x = 1;\n");
  // JS file should not be formatted (not in includes)
  t.expect(fs.readFileSync(jsFile, "utf-8")).toBe("const   y=2");
});

t.it("supports multiple includes patterns", async () => {
  const config = {
    includes: ["**/*.ts", "**/*.json"],
    excludes: [],
    plugins: ["@dprint/typescript", "@dprint/json"],
    typescript: {},
    json: {},
  };
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

  const tsFile = path.join(testDir, "test.ts");
  const jsonFile = path.join(testDir, "test.json");
  const mdFile = path.join(testDir, "test.md");

  fs.writeFileSync(tsFile, "const   x=1");
  fs.writeFileSync(jsonFile, "{\"a\":1}");
  fs.writeFileSync(mdFile, "#   Title");

  await fmtCommand();

  t.expect(fs.readFileSync(tsFile, "utf-8")).toBe("const x = 1;\n");
  t.expect(fs.readFileSync(jsonFile, "utf-8")).toContain("\"a\"");
  t.expect(fs.readFileSync(mdFile, "utf-8")).toBe("#   Title"); // Not formatted
});

t.it("supports glob patterns with braces", async () => {
  const config = {
    includes: ["**/*.{ts,js}"],
    excludes: [],
    plugins: ["@dprint/typescript"],
    typescript: {},
  };
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

  const tsFile = path.join(testDir, "test.ts");
  const jsFile = path.join(testDir, "test.js");
  const jsonFile = path.join(testDir, "test.json");

  fs.writeFileSync(tsFile, "const   x=1");
  fs.writeFileSync(jsFile, "const   y=2");
  fs.writeFileSync(jsonFile, "{\"a\":1}");

  await fmtCommand();

  t.expect(fs.readFileSync(tsFile, "utf-8")).toBe("const x = 1;\n");
  t.expect(fs.readFileSync(jsFile, "utf-8")).toBe("const y = 2;\n");
  t.expect(fs.readFileSync(jsonFile, "utf-8")).toBe("{\"a\":1}");
});

t.it("matches files in subdirectories with **", async () => {
  const config = {
    includes: ["**/*.ts"],
    excludes: [],
    plugins: ["@dprint/typescript"],
    typescript: {},
  };
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

  const subDir = path.join(testDir, "src", "nested");
  fs.mkdirSync(subDir, { recursive: true });
  const nestedFile = path.join(subDir, "file.ts");
  fs.writeFileSync(nestedFile, "const   x=1");

  await fmtCommand();

  t.expect(fs.readFileSync(nestedFile, "utf-8")).toBe("const x = 1;\n");
});

t.it("handles empty includes array", async () => {
  const config = {
    includes: [],
    excludes: [],
    plugins: ["@dprint/typescript"],
    typescript: {},
  };
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

  const tsFile = path.join(testDir, "test.ts");
  fs.writeFileSync(tsFile, "const   x=1");

  await fmtCommand();

  // Should not format anything
  t.expect(fs.readFileSync(tsFile, "utf-8")).toBe("const   x=1");
});

// Exhaustive includes tests

t.it("supports single specific file pattern", async () => {
  const config = {
    includes: ["index.ts"],
    excludes: [],
    plugins: ["@dprint/typescript"],
    typescript: {},
  };
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

  const indexFile = path.join(testDir, "index.ts");
  const otherFile = path.join(testDir, "other.ts");
  fs.writeFileSync(indexFile, "const   x=1");
  fs.writeFileSync(otherFile, "const   y=2");

  await fmtCommand();

  // Only index.ts should be formatted
  t.expect(fs.readFileSync(indexFile, "utf-8")).toBe("const x = 1;\n");
  t.expect(fs.readFileSync(otherFile, "utf-8")).toBe("const   y=2");
});

t.it("supports wildcard in filename", async () => {
  const config = {
    includes: ["test*.ts"],
    excludes: [],
    plugins: ["@dprint/typescript"],
    typescript: {},
  };
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

  const test1File = path.join(testDir, "test1.ts");
  const test2File = path.join(testDir, "test2.ts");
  const appFile = path.join(testDir, "app.ts");
  fs.writeFileSync(test1File, "const   a=1");
  fs.writeFileSync(test2File, "const   b=2");
  fs.writeFileSync(appFile, "const   c=3");

  await fmtCommand();

  t.expect(fs.readFileSync(test1File, "utf-8")).toBe("const a = 1;\n");
  t.expect(fs.readFileSync(test2File, "utf-8")).toBe("const b = 2;\n");
  t.expect(fs.readFileSync(appFile, "utf-8")).toBe("const   c=3");
});

t.it("supports directory-specific patterns", async () => {
  const config = {
    includes: ["src/**/*.ts"],
    excludes: [],
    plugins: ["@dprint/typescript"],
    typescript: {},
  };
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

  const srcDir = path.join(testDir, "src");
  const libDir = path.join(testDir, "lib");
  fs.mkdirSync(srcDir, { recursive: true });
  fs.mkdirSync(libDir, { recursive: true });

  const srcFile = path.join(srcDir, "app.ts");
  const libFile = path.join(libDir, "util.ts");
  const rootFile = path.join(testDir, "index.ts");

  fs.writeFileSync(srcFile, "const   a=1");
  fs.writeFileSync(libFile, "const   b=2");
  fs.writeFileSync(rootFile, "const   c=3");

  await fmtCommand();

  // Only files in src/ should be formatted
  t.expect(fs.readFileSync(srcFile, "utf-8")).toBe("const a = 1;\n");
  t.expect(fs.readFileSync(libFile, "utf-8")).toBe("const   b=2");
  t.expect(fs.readFileSync(rootFile, "utf-8")).toBe("const   c=3");
});

t.it("supports complex glob patterns with multiple wildcards", async () => {
  const config = {
    includes: ["src/**/components/*.{ts,tsx}"],
    excludes: [],
    plugins: ["@dprint/typescript"],
    typescript: {},
  };
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

  const componentDir = path.join(testDir, "src", "ui", "components");
  const utilsDir = path.join(testDir, "src", "utils");
  fs.mkdirSync(componentDir, { recursive: true });
  fs.mkdirSync(utilsDir, { recursive: true });

  const componentFile = path.join(componentDir, "Button.tsx");
  const utilFile = path.join(utilsDir, "helper.ts");

  fs.writeFileSync(componentFile, "const   x=1");
  fs.writeFileSync(utilFile, "const   y=2");

  await fmtCommand();

  // Only component file should be formatted
  t.expect(fs.readFileSync(componentFile, "utf-8")).toBe("const x = 1;\n");
  t.expect(fs.readFileSync(utilFile, "utf-8")).toBe("const   y=2");
});

t.it("handles multiple overlapping patterns", async () => {
  const config = {
    includes: ["**/*.ts", "src/**/*.js"],
    excludes: [],
    plugins: ["@dprint/typescript"],
    typescript: {},
  };
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

  const srcDir = path.join(testDir, "src");
  fs.mkdirSync(srcDir, { recursive: true });

  const tsFile = path.join(testDir, "app.ts");
  const jsFile = path.join(srcDir, "util.js");
  const rootJsFile = path.join(testDir, "index.js");

  fs.writeFileSync(tsFile, "const   a=1");
  fs.writeFileSync(jsFile, "const   b=2");
  fs.writeFileSync(rootJsFile, "const   c=3");

  await fmtCommand();

  // TS file and src JS file should be formatted
  t.expect(fs.readFileSync(tsFile, "utf-8")).toBe("const a = 1;\n");
  t.expect(fs.readFileSync(jsFile, "utf-8")).toBe("const b = 2;\n");
  // Root JS file should not be formatted (not in src/)
  t.expect(fs.readFileSync(rootJsFile, "utf-8")).toBe("const   c=3");
});

t.it("supports includes patterns without directory prefixes", async () => {
  const config = {
    includes: ["*.ts"],
    excludes: [],
    plugins: ["@dprint/typescript"],
    typescript: {},
  };
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

  const srcDir = path.join(testDir, "src");
  fs.mkdirSync(srcDir, { recursive: true });

  const rootFile = path.join(testDir, "index.ts");
  const nestedFile = path.join(srcDir, "app.ts");

  fs.writeFileSync(rootFile, "const   a=1");
  fs.writeFileSync(nestedFile, "const   b=2");

  await fmtCommand();

  // Only root-level file should be formatted
  t.expect(fs.readFileSync(rootFile, "utf-8")).toBe("const a = 1;\n");
  t.expect(fs.readFileSync(nestedFile, "utf-8")).toBe("const   b=2");
});

t.it("matches deeply nested files correctly", async () => {
  const config = {
    includes: ["**/*.ts"],
    excludes: [],
    plugins: ["@dprint/typescript"],
    typescript: {},
  };
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

  const deepDir = path.join(testDir, "a", "b", "c", "d");
  fs.mkdirSync(deepDir, { recursive: true });
  const deepFile = path.join(deepDir, "file.ts");
  fs.writeFileSync(deepFile, "const   x=1");

  await fmtCommand();

  t.expect(fs.readFileSync(deepFile, "utf-8")).toBe("const x = 1;\n");
});

t.it("handles includes with dot in directory names", async () => {
  const config = {
    includes: ["**/*.ts", ".*/**/*.ts"],
    excludes: [],
    plugins: ["@dprint/typescript"],
    typescript: {},
  };
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

  const dotDir = path.join(testDir, ".config");
  fs.mkdirSync(dotDir, { recursive: true });
  const dotFile = path.join(dotDir, "settings.ts");
  const regularFile = path.join(testDir, "app.ts");
  fs.writeFileSync(dotFile, "const   x=1");
  fs.writeFileSync(regularFile, "const   y=2");

  await fmtCommand();

  // Both hidden and regular files should be formatted when explicitly included
  t.expect(fs.readFileSync(dotFile, "utf-8")).toBe("const x = 1;\n");
  t.expect(fs.readFileSync(regularFile, "utf-8")).toBe("const y = 2;\n");
});
