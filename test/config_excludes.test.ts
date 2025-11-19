import * as t from "bun:test";
import * as fs from "node:fs";
import * as path from "node:path";
import fmtCommand from "../src/commands/fmt.js";

const projectRoot = process.cwd();
const testDir = path.join(projectRoot, "test-tmp-config-excludes");
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

t.it("excludes files matching exclude patterns", async () => {
  const config = {
    includes: ["**/*.ts"],
    excludes: ["**/*.test.ts"],
    plugins: ["@dprint/typescript"],
    typescript: {},
  };
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

  const srcFile = path.join(testDir, "src.ts");
  const testFile = path.join(testDir, "src.test.ts");
  fs.writeFileSync(srcFile, "const   x=1");
  fs.writeFileSync(testFile, "const   y=2");

  await fmtCommand();

  // src.ts should be formatted
  t.expect(fs.readFileSync(srcFile, "utf-8")).toBe("const x = 1;\n");
  // src.test.ts should not be formatted (excluded)
  t.expect(fs.readFileSync(testFile, "utf-8")).toBe("const   y=2");
});

t.it("excludes node_modules directory", async () => {
  const config = {
    includes: ["**/*.ts"],
    excludes: ["**/node_modules"],
    plugins: ["@dprint/typescript"],
    typescript: {},
  };
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

  const nodeModulesDir = path.join(testDir, "node_modules");
  fs.mkdirSync(nodeModulesDir);
  const moduleFile = path.join(nodeModulesDir, "lib.ts");
  const srcFile = path.join(testDir, "src.ts");

  fs.writeFileSync(moduleFile, "const   x=1");
  fs.writeFileSync(srcFile, "const   y=2");

  await fmtCommand();

  // node_modules file should not be formatted
  t.expect(fs.readFileSync(moduleFile, "utf-8")).toBe("const   x=1");
  // src file should be formatted
  t.expect(fs.readFileSync(srcFile, "utf-8")).toBe("const y = 2;\n");
});

t.it("supports multiple exclude patterns", async () => {
  const config = {
    includes: ["**/*.ts"],
    excludes: ["**/test/**", "**/dist/**", "**/*.spec.ts"],
    plugins: ["@dprint/typescript"],
    typescript: {},
  };
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

  const testDir1 = path.join(testDir, "test");
  const distDir = path.join(testDir, "dist");
  fs.mkdirSync(testDir1);
  fs.mkdirSync(distDir);

  const srcFile = path.join(testDir, "src.ts");
  const testFile = path.join(testDir1, "helper.ts");
  const distFile = path.join(distDir, "bundle.ts");
  const specFile = path.join(testDir, "app.spec.ts");

  fs.writeFileSync(srcFile, "const   a=1");
  fs.writeFileSync(testFile, "const   b=2");
  fs.writeFileSync(distFile, "const   c=3");
  fs.writeFileSync(specFile, "const   d=4");

  await fmtCommand();

  t.expect(fs.readFileSync(srcFile, "utf-8")).toBe("const a = 1;\n");
  t.expect(fs.readFileSync(testFile, "utf-8")).toBe("const   b=2");
  t.expect(fs.readFileSync(distFile, "utf-8")).toBe("const   c=3");
  t.expect(fs.readFileSync(specFile, "utf-8")).toBe("const   d=4");
});

t.it("handles empty excludes array", async () => {
  const config = {
    includes: ["**/*.ts"],
    excludes: [],
    plugins: ["@dprint/typescript"],
    typescript: {},
  };
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

  const file = path.join(testDir, "test.ts");
  fs.writeFileSync(file, "const   x=1");

  await fmtCommand();

  // Should format everything
  t.expect(fs.readFileSync(file, "utf-8")).toBe("const x = 1;\n");
});

t.it("excludes take precedence over includes", async () => {
  const config = {
    includes: ["**/*.ts"],
    excludes: ["src/**"],
    plugins: ["@dprint/typescript"],
    typescript: {},
  };
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

  const srcDir = path.join(testDir, "src");
  fs.mkdirSync(srcDir);
  const srcFile = path.join(srcDir, "app.ts");
  const rootFile = path.join(testDir, "index.ts");

  fs.writeFileSync(srcFile, "const   x=1");
  fs.writeFileSync(rootFile, "const   y=2");

  await fmtCommand();

  // src/app.ts should not be formatted (excluded)
  t.expect(fs.readFileSync(srcFile, "utf-8")).toBe("const   x=1");
  // index.ts should be formatted
  t.expect(fs.readFileSync(rootFile, "utf-8")).toBe("const y = 2;\n");
});
