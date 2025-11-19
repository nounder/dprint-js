import * as t from "bun:test";
import { loadPlugins, formatText } from "../src/formatter.js";

t.it("uses spaces when useTabs: false", async () => {
  const config = {
    plugins: ["@dprint/typescript"],
    typescript: {
      useTabs: false,
      indentWidth: 2,
    },
  };

  const loadedPlugins = await loadPlugins(config);
  const formatter = loadedPlugins[0].formatter;

  const input = "function test(){return 1}";
  const output = formatText("test.ts", input, formatter);

  // Should use spaces, not tabs
  t.expect(output).not.toContain("\t");
  t.expect(output).toContain("  return");
});

t.it("uses tabs when useTabs: true", async () => {
  const config = {
    plugins: ["@dprint/typescript"],
    typescript: {
      useTabs: true,
    },
  };

  const loadedPlugins = await loadPlugins(config);
  const formatter = loadedPlugins[0].formatter;

  const input = "function test(){return 1}";
  const output = formatText("test.ts", input, formatter);

  // Should use tabs
  t.expect(output).toContain("\treturn");
});

t.it("applies useTabs to nested structures", async () => {
  const config = {
    plugins: ["@dprint/typescript"],
    typescript: {
      useTabs: true,
    },
  };

  const loadedPlugins = await loadPlugins(config);
  const formatter = loadedPlugins[0].formatter;

  const input = "class Test{constructor(){this.value=1}}";
  const output = formatText("test.ts", input, formatter);

  // Should use tabs for indentation
  t.expect(output).toContain("\tconstructor");
  t.expect(output).toContain("\t\tthis.value");
});

t.it("respects useTabs for JSON", async () => {
  const config = {
    plugins: ["@dprint/json"],
    json: {
      useTabs: true,
      lineWidth: 40, // Force multiline formatting
    },
  };

  const loadedPlugins = await loadPlugins(config);
  const formatter = loadedPlugins[0].formatter;

  const input = '{"nested":{"value":1,"items":["a","b","c"]}}';
  const output = formatText("test.json", input, formatter);

  // Should use tabs - check for tab character in indentation
  const lines = output.split('\n');
  const indentedLine = lines.find(l => l.startsWith('\t') || l.includes('\t"'));
  t.expect(indentedLine).toBeDefined();
  t.expect(output).toContain("\t");
});
