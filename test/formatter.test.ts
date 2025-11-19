import { describe, expect, test, beforeAll, afterAll } from "bun:test";
import { loadPlugin, loadPlugins, getFormatterForFile, formatText, formatFile } from "../src/formatter.js";
import * as fs from "node:fs";
import * as path from "node:path";

    test("loads @dprint/typescript plugin successfully", async () => {
      const result = await loadPlugin("@dprint/typescript");

      expect(result).toBeDefined();
      expect(result.formatter).toBeDefined();
      expect(result.fileMatchingInfo).toBeDefined();
      expect(result.fileMatchingInfo.fileExtensions).toContain("ts");
      expect(result.fileMatchingInfo.fileExtensions).toContain("js");
    });

    test("loads @dprint/json plugin successfully", async () => {
      const result = await loadPlugin("@dprint/json");

      expect(result).toBeDefined();
      expect(result.formatter).toBeDefined();
      expect(result.fileMatchingInfo.fileExtensions).toContain("json");
    });

    test("loads @dprint/markdown plugin successfully", async () => {
      const result = await loadPlugin("@dprint/markdown");

      expect(result).toBeDefined();
      expect(result.formatter).toBeDefined();
      expect(result.fileMatchingInfo.fileExtensions).toContain("md");
      expect(result.fileMatchingInfo.fileExtensions).toContain("markdown");
    });

    test("throws error for non-existent plugin", async () => {
      expect(async () => {
        await loadPlugin("@dprint/nonexistent");
      }).toThrow();
    });

    test("throws error for invalid plugin package", async () => {
      expect(async () => {
        await loadPlugin("invalid-plugin-name");
      }).toThrow();
    });
  });

  describe("loadPlugins", () => {
    test("loads all plugins from config", async () => {
      const config = {
        plugins: ["@dprint/typescript", "@dprint/json", "@dprint/markdown"],
        typescript: {},
        json: {},
        markdown: {},
      };

      const plugins = await loadPlugins(config);

      expect(plugins.length).toBe(3);
      expect(plugins[0].name).toBe("@dprint/typescript");
      expect(plugins[1].name).toBe("@dprint/json");
      expect(plugins[2].name).toBe("@dprint/markdown");
    });

    test("handles missing plugin gracefully", async () => {
      const config = {
        plugins: ["@dprint/typescript", "@dprint/nonexistent", "@dprint/json"],
        typescript: {},
        json: {},
      };

      const plugins = await loadPlugins(config);

      // Should load 2 plugins (typescript and json), skip the nonexistent one
      expect(plugins.length).toBe(2);
    });

    test("returns empty array when no plugins specified", async () => {
      const config = { plugins: [] };
      const plugins = await loadPlugins(config);

      expect(plugins.length).toBe(0);
    });

    test("returns empty array when plugins key missing", async () => {
      const config = {};
      const plugins = await loadPlugins(config);

      expect(plugins.length).toBe(0);
    });
  });

  describe("getFormatterForFile", () => {
    let loadedPlugins: any[];

    beforeAll(async () => {
      const config = {
        plugins: ["@dprint/typescript", "@dprint/json", "@dprint/markdown"],
        typescript: {},
        json: {},
        markdown: {},
      };
      loadedPlugins = await loadPlugins(config);
    });

    test("returns typescript formatter for .ts files", () => {
      const formatter = getFormatterForFile("test.ts", loadedPlugins);
      expect(formatter).toBeDefined();
    });

    test("returns typescript formatter for .js files", () => {
      const formatter = getFormatterForFile("test.js", loadedPlugins);
      expect(formatter).toBeDefined();
    });

    test("returns typescript formatter for .tsx files", () => {
      const formatter = getFormatterForFile("test.tsx", loadedPlugins);
      expect(formatter).toBeDefined();
    });

    test("returns json formatter for .json files", () => {
      const formatter = getFormatterForFile("test.json", loadedPlugins);
      expect(formatter).toBeDefined();
    });

    test("returns markdown formatter for .md files", () => {
      const formatter = getFormatterForFile("test.md", loadedPlugins);
      expect(formatter).toBeDefined();
    });

    test("returns markdown formatter for .markdown files", () => {
      const formatter = getFormatterForFile("test.markdown", loadedPlugins);
      expect(formatter).toBeDefined();
    });

    test("returns null for unsupported file types", () => {
      const formatter = getFormatterForFile("test.txt", loadedPlugins);
      expect(formatter).toBeNull();
    });

    test("returns null for files without extension", () => {
      const formatter = getFormatterForFile("README", loadedPlugins);
      expect(formatter).toBeNull();
    });
  });

  describe("formatText", () => {
    let loadedPlugins: any[];

    beforeAll(async () => {
      const config = {
        plugins: ["@dprint/typescript", "@dprint/json"],
        typescript: {},
        json: {},
      };
      loadedPlugins = await loadPlugins(config);
    });

    test("formats TypeScript code correctly", () => {
      const formatter = getFormatterForFile("test.ts", loadedPlugins);
      const input = "const   x=1";
      const output = formatText("test.ts", input, formatter!);

      expect(output).toBe("const x = 1;\n");
    });

    test("formats JSON correctly", () => {
      const formatter = getFormatterForFile("test.json", loadedPlugins);
      const input = '{"a":1,"b":2}';
      const output = formatText("test.json", input, formatter!);

      expect(output).toContain('"a"');
      expect(output).toContain('"b"');
      // JSON should be formatted with proper spacing
      expect(output.length).toBeGreaterThan(input.length);
    });

    test("returns same text if already formatted", () => {
      const formatter = getFormatterForFile("test.ts", loadedPlugins);
      const input = "const x = 1;\n";
      const output = formatText("test.ts", input, formatter!);

      expect(output).toBe(input);
    });
  });

  describe("formatFile with actual/expected data files", () => {
    const testDir = path.join(process.cwd(), "test-tmp-formatter");
    const dataDir = path.join(process.cwd(), "test/fixtures");
    let loadedPlugins: any[];
    const config = {
      plugins: ["@dprint/typescript", "@dprint/json", "@dprint/markdown"],
      typescript: {},
      json: {},
      markdown: {},
    };

    beforeAll(async () => {
      loadedPlugins = await loadPlugins(config);
      if (!fs.existsSync(testDir)) {
        fs.mkdirSync(testDir, { recursive: true });
      }
    });

    afterAll(() => {
      if (fs.existsSync(testDir)) {
        fs.rmSync(testDir, { recursive: true, force: true });
      }
    });

    test("formats Async.ts to match expected output", async () => {
      const actualPath = path.join(dataDir, "Async.actual.ts");
      const expectedPath = path.join(dataDir, "Async.expected.ts");
      const tempPath = path.join(testDir, "Async.ts");

      // Copy actual to temp
      fs.copyFileSync(actualPath, tempPath);

      // Format the file
      const result = await formatFile(tempPath, loadedPlugins, config, false);

      expect(result.formatted).toBe(true);
      expect(result.error).toBeNull();

      // Compare with expected
      const formatted = fs.readFileSync(tempPath, "utf-8");
      const expected = fs.readFileSync(expectedPath, "utf-8");
      expect(formatted).toBe(expected);
    });

    test("formats Classes.ts to match expected output", async () => {
      const actualPath = path.join(dataDir, "Classes.actual.ts");
      const expectedPath = path.join(dataDir, "Classes.expected.ts");
      const tempPath = path.join(testDir, "Classes.ts");

      fs.copyFileSync(actualPath, tempPath);
      const result = await formatFile(tempPath, loadedPlugins, config, false);

      expect(result.formatted).toBe(true);
      const formatted = fs.readFileSync(tempPath, "utf-8");
      const expected = fs.readFileSync(expectedPath, "utf-8");
      expect(formatted).toBe(expected);
    });

    test("formats Sample.ts to match expected output", async () => {
      const actualPath = path.join(dataDir, "Sample.actual.ts");
      const expectedPath = path.join(dataDir, "Sample.expected.ts");
      const tempPath = path.join(testDir, "Sample.ts");

      fs.copyFileSync(actualPath, tempPath);
      const result = await formatFile(tempPath, loadedPlugins, config, false);

      expect(result.formatted).toBe(true);
      const formatted = fs.readFileSync(tempPath, "utf-8");
      const expected = fs.readFileSync(expectedPath, "utf-8");
      expect(formatted).toBe(expected);
    });

    test("formats Config.json to match expected output", async () => {
      const actualPath = path.join(dataDir, "Config.actual.json");
      const expectedPath = path.join(dataDir, "Config.expected.json");
      const tempPath = path.join(testDir, "Config.json");

      fs.copyFileSync(actualPath, tempPath);
      const result = await formatFile(tempPath, loadedPlugins, config, false);

      expect(result.formatted).toBe(true);
      const formatted = fs.readFileSync(tempPath, "utf-8");
      const expected = fs.readFileSync(expectedPath, "utf-8");
      expect(formatted).toBe(expected);
    });

    test("formats Users.json to match expected output", async () => {
      const actualPath = path.join(dataDir, "Users.actual.json");
      const expectedPath = path.join(dataDir, "Users.expected.json");
      const tempPath = path.join(testDir, "Users.json");

      fs.copyFileSync(actualPath, tempPath);
      const result = await formatFile(tempPath, loadedPlugins, config, false);

      expect(result.formatted).toBe(true);
      const formatted = fs.readFileSync(tempPath, "utf-8");
      const expected = fs.readFileSync(expectedPath, "utf-8");
      expect(formatted).toBe(expected);
    });

    test("formats Sample.json to match expected output", async () => {
      const actualPath = path.join(dataDir, "Sample.actual.json");
      const expectedPath = path.join(dataDir, "Sample.expected.json");
      const tempPath = path.join(testDir, "Sample.json");

      fs.copyFileSync(actualPath, tempPath);
      const result = await formatFile(tempPath, loadedPlugins, config, false);

      expect(result.formatted).toBe(true);
      const formatted = fs.readFileSync(tempPath, "utf-8");
      const expected = fs.readFileSync(expectedPath, "utf-8");
      expect(formatted).toBe(expected);
    });

    test("formats Api.md to match expected output", async () => {
      const actualPath = path.join(dataDir, "Api.actual.md");
      const expectedPath = path.join(dataDir, "Api.expected.md");
      const tempPath = path.join(testDir, "Api.md");

      fs.copyFileSync(actualPath, tempPath);
      const result = await formatFile(tempPath, loadedPlugins, config, false);

      expect(result.formatted).toBe(true);
      const formatted = fs.readFileSync(tempPath, "utf-8");
      const expected = fs.readFileSync(expectedPath, "utf-8");
      expect(formatted).toBe(expected);
    });

    test("formats Guide.md to match expected output", async () => {
      const actualPath = path.join(dataDir, "Guide.actual.md");
      const expectedPath = path.join(dataDir, "Guide.expected.md");
      const tempPath = path.join(testDir, "Guide.md");

      fs.copyFileSync(actualPath, tempPath);
      const result = await formatFile(tempPath, loadedPlugins, config, false);

      expect(result.formatted).toBe(true);
      const formatted = fs.readFileSync(tempPath, "utf-8");
      const expected = fs.readFileSync(expectedPath, "utf-8");
      expect(formatted).toBe(expected);
    });

    test("formats Sample.md to match expected output", async () => {
      const actualPath = path.join(dataDir, "Sample.actual.md");
      const expectedPath = path.join(dataDir, "Sample.expected.md");
      const tempPath = path.join(testDir, "Sample.md");

      fs.copyFileSync(actualPath, tempPath);
      const result = await formatFile(tempPath, loadedPlugins, config, false);

      expect(result.formatted).toBe(true);
      const formatted = fs.readFileSync(tempPath, "utf-8");
      const expected = fs.readFileSync(expectedPath, "utf-8");
      expect(formatted).toBe(expected);
    });
  });
