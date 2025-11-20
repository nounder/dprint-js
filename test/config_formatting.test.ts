import * as t from "bun:test";
import { formatText, loadPlugins } from "../src/formatter.js";

// Tests for global formatting options (lineWidth, indentWidth, useTabs)
// These are passed to all formatters. We're verifying they are respected,
// not exhaustively testing every value with every plugin.

t.it("respects lineWidth option", async () => {
  const config = {
    plugins: ["@dprint/typescript"],
    typescript: {
      lineWidth: 40,
    },
  };

  const loadedPlugins = await loadPlugins(config);
  const formatter = loadedPlugins[0].formatter;

  const input = "const longVariable = \"this is a very long string that should wrap\";";
  const output = formatText("test.ts", input, formatter);

  // With lineWidth 40, the line should be broken
  t.expect(output.split("\n").length).toBeGreaterThan(1);
});

t.it("respects indentWidth option", async () => {
  const config = {
    plugins: ["@dprint/typescript"],
    typescript: {
      indentWidth: 4,
    },
  };

  const loadedPlugins = await loadPlugins(config);
  const formatter = loadedPlugins[0].formatter;

  const input = "function test(){return 1}";
  const output = formatText("test.ts", input, formatter);

  // Should use 4 spaces for indentation
  t.expect(output).toContain("    return");
});

t.it("respects useTabs: false option", async () => {
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

t.it("respects useTabs: true option", async () => {
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

t.it("formatting options work together", async () => {
  const config = {
    plugins: ["@dprint/typescript"],
    typescript: {
      lineWidth: 40,
      indentWidth: 4,
      useTabs: false,
    },
  };

  const loadedPlugins = await loadPlugins(config);
  const formatter = loadedPlugins[0].formatter;

  const input = "function test(){const x={a:1,b:2,c:3,d:4,e:5};return x;}";
  const output = formatText("test.ts", input, formatter);

  // Should use spaces for indentation
  t.expect(output).not.toContain("\t");
  // Should respect indentWidth and lineWidth
  t.expect(output).toContain("    ");
  t.expect(output.split("\n").length).toBeGreaterThan(1);
});
