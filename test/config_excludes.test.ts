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

// Exhaustive excludes tests

t.it("excludes hidden directories starting with dot", async () => {
  const config = {
    includes: ["**/*.ts"],
    excludes: [".*/**"],
    plugins: ["@dprint/typescript"],
    typescript: {},
  };
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

  const hiddenDir = path.join(testDir, ".git");
  fs.mkdirSync(hiddenDir, { recursive: true });
  const hiddenFile = path.join(hiddenDir, "config.ts");
  const normalFile = path.join(testDir, "app.ts");

  fs.writeFileSync(hiddenFile, "const   x=1");
  fs.writeFileSync(normalFile, "const   y=2");

  await fmtCommand();

  // Hidden dir file should not be formatted
  t.expect(fs.readFileSync(hiddenFile, "utf-8")).toBe("const   x=1");
  // Normal file should be formatted
  t.expect(fs.readFileSync(normalFile, "utf-8")).toBe("const y = 2;\n");
});

t.it("excludes build output directories", async () => {
  const config = {
    includes: ["**/*.ts"],
    excludes: ["**/dist/**", "**/build/**", "**/out/**"],
    plugins: ["@dprint/typescript"],
    typescript: {},
  };
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

  const distDir = path.join(testDir, "dist");
  const buildDir = path.join(testDir, "build");
  const outDir = path.join(testDir, "out");
  const srcDir = path.join(testDir, "src");

  fs.mkdirSync(distDir, { recursive: true });
  fs.mkdirSync(buildDir, { recursive: true });
  fs.mkdirSync(outDir, { recursive: true });
  fs.mkdirSync(srcDir, { recursive: true });

  const distFile = path.join(distDir, "bundle.ts");
  const buildFile = path.join(buildDir, "compiled.ts");
  const outFile = path.join(outDir, "output.ts");
  const srcFile = path.join(srcDir, "app.ts");

  fs.writeFileSync(distFile, "const   a=1");
  fs.writeFileSync(buildFile, "const   b=2");
  fs.writeFileSync(outFile, "const   c=3");
  fs.writeFileSync(srcFile, "const   d=4");

  await fmtCommand();

  // Build output files should not be formatted
  t.expect(fs.readFileSync(distFile, "utf-8")).toBe("const   a=1");
  t.expect(fs.readFileSync(buildFile, "utf-8")).toBe("const   b=2");
  t.expect(fs.readFileSync(outFile, "utf-8")).toBe("const   c=3");
  // Source file should be formatted
  t.expect(fs.readFileSync(srcFile, "utf-8")).toBe("const d = 4;\n");
});

t.it("excludes lock files and generated files", async () => {
  const config = {
    includes: ["**/*.json"],
    excludes: ["**/*-lock.json", "**/package-lock.json", "**/yarn.lock"],
    plugins: ["@dprint/json"],
    json: {},
  };
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

  const lockFile = path.join(testDir, "package-lock.json");
  const bundleLock = path.join(testDir, "bundle-lock.json");
  const configFile = path.join(testDir, "tsconfig.json");

  fs.writeFileSync(lockFile, "{\"a\":1}");
  fs.writeFileSync(bundleLock, "{\"b\":2}");
  fs.writeFileSync(configFile, "{\"c\":3}");

  await fmtCommand();

  // Lock files should not be formatted
  t.expect(fs.readFileSync(lockFile, "utf-8")).toBe("{\"a\":1}");
  t.expect(fs.readFileSync(bundleLock, "utf-8")).toBe("{\"b\":2}");
  // Config file should be formatted
  t.expect(fs.readFileSync(configFile, "utf-8")).toContain("\"c\"");
});

t.it("excludes coverage and test output directories", async () => {
  const config = {
    includes: ["**/*.ts"],
    excludes: ["**/coverage/**", "**/.nyc_output/**", "**/test-results/**"],
    plugins: ["@dprint/typescript"],
    typescript: {},
  };
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

  const coverageDir = path.join(testDir, "coverage");
  const nycDir = path.join(testDir, ".nyc_output");
  const testResultsDir = path.join(testDir, "test-results");
  const srcDir = path.join(testDir, "src");

  fs.mkdirSync(coverageDir, { recursive: true });
  fs.mkdirSync(nycDir, { recursive: true });
  fs.mkdirSync(testResultsDir, { recursive: true });
  fs.mkdirSync(srcDir, { recursive: true });

  const coverageFile = path.join(coverageDir, "report.ts");
  const nycFile = path.join(nycDir, "data.ts");
  const testFile = path.join(testResultsDir, "output.ts");
  const srcFile = path.join(srcDir, "app.ts");

  fs.writeFileSync(coverageFile, "const   a=1");
  fs.writeFileSync(nycFile, "const   b=2");
  fs.writeFileSync(testFile, "const   c=3");
  fs.writeFileSync(srcFile, "const   d=4");

  await fmtCommand();

  // Coverage files should not be formatted
  t.expect(fs.readFileSync(coverageFile, "utf-8")).toBe("const   a=1");
  t.expect(fs.readFileSync(nycFile, "utf-8")).toBe("const   b=2");
  t.expect(fs.readFileSync(testFile, "utf-8")).toBe("const   c=3");
  // Source file should be formatted
  t.expect(fs.readFileSync(srcFile, "utf-8")).toBe("const d = 4;\n");
});

t.it("excludes with wildcard in filename", async () => {
  const config = {
    includes: ["**/*.ts"],
    excludes: ["**/*.test.ts", "**/*.spec.ts", "**/*.d.ts"],
    plugins: ["@dprint/typescript"],
    typescript: {},
  };
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

  const testFile = path.join(testDir, "app.test.ts");
  const specFile = path.join(testDir, "util.spec.ts");
  const dtsFile = path.join(testDir, "types.d.ts");
  const srcFile = path.join(testDir, "app.ts");

  fs.writeFileSync(testFile, "const   a=1");
  fs.writeFileSync(specFile, "const   b=2");
  fs.writeFileSync(dtsFile, "const   c=3");
  fs.writeFileSync(srcFile, "const   d=4");

  await fmtCommand();

  // Test/spec/definition files should not be formatted
  t.expect(fs.readFileSync(testFile, "utf-8")).toBe("const   a=1");
  t.expect(fs.readFileSync(specFile, "utf-8")).toBe("const   b=2");
  t.expect(fs.readFileSync(dtsFile, "utf-8")).toBe("const   c=3");
  // Regular source file should be formatted
  t.expect(fs.readFileSync(srcFile, "utf-8")).toBe("const d = 4;\n");
});

t.it("excludes nested directories at any level", async () => {
  const config = {
    includes: ["**/*.ts"],
    excludes: ["**/vendor/**", "**/third-party/**"],
    plugins: ["@dprint/typescript"],
    typescript: {},
  };
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

  const vendorDir = path.join(testDir, "lib", "vendor");
  const thirdPartyDir = path.join(testDir, "src", "third-party");
  const srcDir = path.join(testDir, "src");

  fs.mkdirSync(vendorDir, { recursive: true });
  fs.mkdirSync(thirdPartyDir, { recursive: true });
  fs.mkdirSync(srcDir, { recursive: true });

  const vendorFile = path.join(vendorDir, "lib.ts");
  const thirdPartyFile = path.join(thirdPartyDir, "external.ts");
  const srcFile = path.join(srcDir, "app.ts");

  fs.writeFileSync(vendorFile, "const   a=1");
  fs.writeFileSync(thirdPartyFile, "const   b=2");
  fs.writeFileSync(srcFile, "const   c=3");

  await fmtCommand();

  // Vendor files should not be formatted
  t.expect(fs.readFileSync(vendorFile, "utf-8")).toBe("const   a=1");
  t.expect(fs.readFileSync(thirdPartyFile, "utf-8")).toBe("const   b=2");
  // Source file should be formatted
  t.expect(fs.readFileSync(srcFile, "utf-8")).toBe("const c = 3;\n");
});

t.it("excludes with brace expansion patterns", async () => {
  const config = {
    includes: ["**/*.ts"],
    excludes: ["**/*.{test,spec,mock}.ts"],
    plugins: ["@dprint/typescript"],
    typescript: {},
  };
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

  const testFile = path.join(testDir, "app.test.ts");
  const specFile = path.join(testDir, "util.spec.ts");
  const mockFile = path.join(testDir, "data.mock.ts");
  const srcFile = path.join(testDir, "app.ts");

  fs.writeFileSync(testFile, "const   a=1");
  fs.writeFileSync(specFile, "const   b=2");
  fs.writeFileSync(mockFile, "const   c=3");
  fs.writeFileSync(srcFile, "const   d=4");

  await fmtCommand();

  // Test/spec/mock files should not be formatted
  t.expect(fs.readFileSync(testFile, "utf-8")).toBe("const   a=1");
  t.expect(fs.readFileSync(specFile, "utf-8")).toBe("const   b=2");
  t.expect(fs.readFileSync(mockFile, "utf-8")).toBe("const   c=3");
  // Source file should be formatted
  t.expect(fs.readFileSync(srcFile, "utf-8")).toBe("const d = 4;\n");
});

t.it("excludes with single directory name without wildcards", async () => {
  const config = {
    includes: ["**/*.ts"],
    excludes: ["temp/**"],
    plugins: ["@dprint/typescript"],
    typescript: {},
  };
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

  const tempDir = path.join(testDir, "temp");
  fs.mkdirSync(tempDir, { recursive: true });
  const tempFile = path.join(tempDir, "cache.ts");
  const rootFile = path.join(testDir, "app.ts");

  fs.writeFileSync(tempFile, "const   a=1");
  fs.writeFileSync(rootFile, "const   b=2");

  await fmtCommand();

  // Temp file should not be formatted
  t.expect(fs.readFileSync(tempFile, "utf-8")).toBe("const   a=1");
  // Root file should be formatted
  t.expect(fs.readFileSync(rootFile, "utf-8")).toBe("const b = 2;\n");
});

t.it("excludes deeply nested paths correctly", async () => {
  const config = {
    includes: ["**/*.ts"],
    excludes: ["**/node_modules/**", "**/fixtures/**"],
    plugins: ["@dprint/typescript"],
    typescript: {},
  };
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

  const deepNested = path.join(testDir, "src", "lib", "node_modules", "pkg");
  const deepFixtures = path.join(testDir, "test", "unit", "fixtures");
  const srcDir = path.join(testDir, "src");

  fs.mkdirSync(deepNested, { recursive: true });
  fs.mkdirSync(deepFixtures, { recursive: true });
  fs.mkdirSync(srcDir, { recursive: true });

  const nestedFile = path.join(deepNested, "index.ts");
  const fixtureFile = path.join(deepFixtures, "data.ts");
  const srcFile = path.join(srcDir, "app.ts");

  fs.writeFileSync(nestedFile, "const   a=1");
  fs.writeFileSync(fixtureFile, "const   b=2");
  fs.writeFileSync(srcFile, "const   c=3");

  await fmtCommand();

  // Excluded files should not be formatted
  t.expect(fs.readFileSync(nestedFile, "utf-8")).toBe("const   a=1");
  t.expect(fs.readFileSync(fixtureFile, "utf-8")).toBe("const   b=2");
  // Source file should be formatted
  t.expect(fs.readFileSync(srcFile, "utf-8")).toBe("const c = 3;\n");
});
