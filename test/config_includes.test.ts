import * as t from "bun:test";
import fmtCommand from "../src/commands/fmt.js";
import * as fs from "node:fs";
import * as path from "node:path";

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
  fs.writeFileSync(jsonFile, '{"a":1}');
  fs.writeFileSync(mdFile, "#   Title");

  await fmtCommand();

  t.expect(fs.readFileSync(tsFile, "utf-8")).toBe("const x = 1;\n");
  t.expect(fs.readFileSync(jsonFile, "utf-8")).toContain('"a"');
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
  fs.writeFileSync(jsonFile, '{"a":1}');

  await fmtCommand();

  t.expect(fs.readFileSync(tsFile, "utf-8")).toBe("const x = 1;\n");
  t.expect(fs.readFileSync(jsFile, "utf-8")).toBe("const y = 2;\n");
  t.expect(fs.readFileSync(jsonFile, "utf-8")).toBe('{"a":1}');
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
