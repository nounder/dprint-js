import * as t from "bun:test";
import * as Formatter from "../src/Formatter.js";

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

  const { plugins } = await Formatter.loadPlugins(config);
  const formatter = plugins[0].formatter;

  const input = "const longVariable = \"this is a very long string that should wrap\";";
  const output = Formatter.formatText("test.ts", input, formatter);

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

  const { plugins } = await Formatter.loadPlugins(config);
  const formatter = plugins[0].formatter;

  const input = "function test(){return 1}";
  const output = Formatter.formatText("test.ts", input, formatter);

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

  const { plugins } = await Formatter.loadPlugins(config);
  const formatter = plugins[0].formatter;

  const input = "function test(){return 1}";
  const output = Formatter.formatText("test.ts", input, formatter);

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

  const { plugins } = await Formatter.loadPlugins(config);
  const formatter = plugins[0].formatter;

  const input = "function test(){return 1}";
  const output = Formatter.formatText("test.ts", input, formatter);

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

  const { plugins } = await Formatter.loadPlugins(config);
  const formatter = plugins[0].formatter;

  const input = "function test(){const x={a:1,b:2,c:3,d:4,e:5};return x;}";
  const output = Formatter.formatText("test.ts", input, formatter);

  // Should use spaces for indentation
  t.expect(output).not.toContain("\t");
  // Should respect indentWidth and lineWidth
  t.expect(output).toContain("    ");
  t.expect(output.split("\n").length).toBeGreaterThan(1);
});

t.it("respects newLineKind: lf option", async () => {
  const config = {
    plugins: ["@dprint/typescript"],
    typescript: {
      newLineKind: "lf",
    },
  };

  const { plugins } = await Formatter.loadPlugins(config);
  const formatter = plugins[0].formatter;

  const input = "function test(){\nreturn 1;\n}";
  const output = Formatter.formatText("test.ts", input, formatter);

  // Should use LF line endings (no CRLF)
  t.expect(output).not.toContain("\r\n");
  t.expect(output).toContain("\n");
});

t.it("respects newLineKind: crlf option", async () => {
  const config = {
    plugins: ["@dprint/typescript"],
    typescript: {
      newLineKind: "crlf",
    },
  };

  const { plugins } = await Formatter.loadPlugins(config);
  const formatter = plugins[0].formatter;

  const input = "function test(){\nreturn 1;\n}";
  const output = Formatter.formatText("test.ts", input, formatter);

  // Should use CRLF line endings
  t.expect(output).toContain("\r\n");
});

// Tests for global-level options (set at root of config, not plugin-specific)
t.it("respects global lineWidth option", async () => {
  const config = {
    lineWidth: 40,
    plugins: ["@dprint/typescript"],
    typescript: {},
  };

  const { plugins } = await Formatter.loadPlugins(config);
  const formatter = plugins[0].formatter;

  const input = "const longVariable = \"this is a very long string that should wrap\";";
  const output = Formatter.formatText("test.ts", input, formatter);

  // With lineWidth 40, the line should be broken
  t.expect(output.split("\n").length).toBeGreaterThan(1);
});

t.it("respects global indentWidth option", async () => {
  const config = {
    indentWidth: 4,
    plugins: ["@dprint/typescript"],
    typescript: {},
  };

  const { plugins } = await Formatter.loadPlugins(config);
  const formatter = plugins[0].formatter;

  const input = "function test(){return 1}";
  const output = Formatter.formatText("test.ts", input, formatter);

  // Should use 4 spaces for indentation
  t.expect(output).toContain("    return");
});

t.it("respects global newLineKind option", async () => {
  const config = {
    newLineKind: "crlf",
    plugins: ["@dprint/typescript"],
    typescript: {},
  };

  const { plugins } = await Formatter.loadPlugins(config);
  const formatter = plugins[0].formatter;

  const input = "function test(){\nreturn 1;\n}";
  const output = Formatter.formatText("test.ts", input, formatter);

  // Should use CRLF line endings from global config
  t.expect(output).toContain("\r\n");
});

t.it("plugin-specific options override global options", async () => {
  const config = {
    lineWidth: 80,
    indentWidth: 2,
    plugins: ["@dprint/typescript"],
    typescript: {
      lineWidth: 40, // Should override global
      indentWidth: 4, // Should override global
    },
  };

  const { plugins } = await Formatter.loadPlugins(config);
  const formatter = plugins[0].formatter;

  const input = "function test(){const longVariable = \"this is a very long string that should wrap\"; return 1;}";
  const output = Formatter.formatText("test.ts", input, formatter);

  // Should use plugin-specific indentWidth (4)
  t.expect(output).toContain("    ");
  // Should use plugin-specific lineWidth (40) causing more wrapping
  const lines = output.split("\n");
  t.expect(lines.length).toBeGreaterThan(2);
});
